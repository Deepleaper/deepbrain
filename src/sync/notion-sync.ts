/**
 * DeepBrain — Notion Live Sync
 *
 * Incremental sync from a Notion database via the official API.
 * Stores a cursor (last_edited_time) for efficient delta fetches.
 *
 * CLI: deepbrain sync notion --token <token> --database <id>
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Brain } from '../core/brain.js';

export interface NotionSyncOptions {
  /** Notion integration token */
  token: string;
  /** Notion database ID */
  databaseId: string;
  /** Slug prefix (default: 'notion/') */
  prefix?: string;
  /** State file path for cursor persistence */
  stateFile?: string;
  /** Progress callback */
  onProgress?: (msg: string) => void;
  /** Page type override */
  type?: string;
}

export interface NotionSyncResult {
  synced: number;
  skipped: number;
  errors: Array<{ pageId: string; error: string }>;
  cursor: string | null;
}

interface NotionSyncState {
  lastSyncTime: string | null;
  cursor: string | null;
  syncedPages: Record<string, string>; // pageId → last_edited_time
}

const DEFAULT_STATE: NotionSyncState = {
  lastSyncTime: null,
  cursor: null,
  syncedPages: {},
};

/**
 * Sync pages from a Notion database incrementally.
 */
export async function syncNotion(
  brain: Brain,
  opts: NotionSyncOptions,
): Promise<NotionSyncResult> {
  const prefix = opts.prefix ?? 'notion/';
  const stateFile = opts.stateFile ?? '.deepbrain-notion-sync.json';
  const result: NotionSyncResult = { synced: 0, skipped: 0, errors: [], cursor: null };

  // Load sync state
  const state = loadState(stateFile);

  opts.onProgress?.(`🔄 Syncing Notion database ${opts.databaseId}...`);
  if (state.lastSyncTime) {
    opts.onProgress?.(`   Last sync: ${state.lastSyncTime}`);
  }

  try {
    // Query database for pages, filtered by last_edited_time if we have a cursor
    let hasMore = true;
    let startCursor: string | undefined;

    while (hasMore) {
      const queryBody: any = {
        database_id: opts.databaseId,
        page_size: 100,
        sorts: [{ timestamp: 'last_edited_time', direction: 'ascending' }],
      };

      if (startCursor) {
        queryBody.start_cursor = startCursor;
      }

      // Filter by last_edited_time if we have a previous sync
      if (state.lastSyncTime) {
        queryBody.filter = {
          timestamp: 'last_edited_time',
          last_edited_time: { after: state.lastSyncTime },
        };
      }

      const response = await notionFetch(
        'https://api.notion.com/v1/databases/' + opts.databaseId + '/query',
        opts.token,
        'POST',
        queryBody,
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Notion API error ${response.status}: ${errText}`);
      }

      const data = await response.json();

      for (const page of data.results ?? []) {
        const pageId = page.id;
        const lastEdited = page.last_edited_time;

        // Skip if not modified since last sync
        if (state.syncedPages[pageId] === lastEdited) {
          result.skipped++;
          continue;
        }

        try {
          // Fetch page content (blocks)
          const content = await fetchPageContent(page, opts.token);
          const title = extractTitle(page);
          const slug = prefix + slugify(title || pageId);
          const tags = extractTags(page);

          opts.onProgress?.(`   📄 ${title || pageId}`);

          await brain.put(slug, {
            type: opts.type ?? 'note',
            title: title || pageId,
            compiled_truth: content,
            frontmatter: {
              notion_id: pageId,
              notion_url: page.url,
              last_edited_time: lastEdited,
              source: 'notion-sync',
            },
          });

          // Apply tags
          for (const tag of tags) {
            await brain.tag(slug, tag);
          }

          state.syncedPages[pageId] = lastEdited;
          result.synced++;
        } catch (e: any) {
          result.errors.push({ pageId, error: e.message });
        }
      }

      hasMore = data.has_more === true;
      startCursor = data.next_cursor ?? undefined;
    }

    // Update state
    state.lastSyncTime = new Date().toISOString();
    state.cursor = startCursor ?? state.cursor;
    result.cursor = state.cursor;
    saveState(stateFile, state);

    opts.onProgress?.(`✅ Sync complete: ${result.synced} synced, ${result.skipped} skipped, ${result.errors.length} errors`);
  } catch (e: any) {
    // Save partial state even on error
    saveState(stateFile, state);
    throw e;
  }

  return result;
}

// ── Notion API helpers ───────────────────────────────────────────

async function notionFetch(url: string, token: string, method: string = 'GET', body?: any): Promise<Response> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  return fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function fetchPageContent(page: any, token: string): Promise<string> {
  const pageId = page.id;
  const blocks: string[] = [];

  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore) {
    const url = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100${startCursor ? `&start_cursor=${startCursor}` : ''}`;
    const response = await notionFetch(url, token);

    if (!response.ok) {
      // Fall back to properties if blocks fail
      return extractPropertiesAsText(page);
    }

    const data = await response.json();

    for (const block of data.results ?? []) {
      const text = blockToText(block);
      if (text) blocks.push(text);
    }

    hasMore = data.has_more === true;
    startCursor = data.next_cursor ?? undefined;
  }

  return blocks.join('\n\n') || extractPropertiesAsText(page);
}

function blockToText(block: any): string {
  const type = block.type;
  if (!type) return '';

  const content = block[type];
  if (!content) return '';

  // Extract rich text
  const richText = content.rich_text ?? content.text ?? [];
  const text = richText.map((t: any) => t.plain_text ?? '').join('');

  switch (type) {
    case 'paragraph': return text;
    case 'heading_1': return `# ${text}`;
    case 'heading_2': return `## ${text}`;
    case 'heading_3': return `### ${text}`;
    case 'bulleted_list_item': return `- ${text}`;
    case 'numbered_list_item': return `1. ${text}`;
    case 'to_do': return `- [${content.checked ? 'x' : ' '}] ${text}`;
    case 'toggle': return `> ${text}`;
    case 'code': return `\`\`\`${content.language ?? ''}\n${text}\n\`\`\``;
    case 'quote': return `> ${text}`;
    case 'callout': return `> ${content.icon?.emoji ?? '💡'} ${text}`;
    case 'divider': return '---';
    case 'image': return `![image](${content.file?.url ?? content.external?.url ?? ''})`;
    default: return text;
  }
}

function extractTitle(page: any): string {
  const properties = page.properties ?? {};
  for (const [_, prop] of Object.entries(properties) as [string, any][]) {
    if (prop.type === 'title' && prop.title) {
      return prop.title.map((t: any) => t.plain_text ?? '').join('');
    }
  }
  return '';
}

function extractTags(page: any): string[] {
  const tags: string[] = [];
  const properties = page.properties ?? {};

  for (const [key, prop] of Object.entries(properties) as [string, any][]) {
    if (prop.type === 'multi_select') {
      for (const opt of prop.multi_select ?? []) {
        tags.push(opt.name);
      }
    } else if (prop.type === 'select' && prop.select) {
      tags.push(prop.select.name);
    }
  }

  return tags;
}

function extractPropertiesAsText(page: any): string {
  const properties = page.properties ?? {};
  const lines: string[] = [];

  for (const [key, prop] of Object.entries(properties) as [string, any][]) {
    const val = propertyToText(prop);
    if (val) lines.push(`**${key}:** ${val}`);
  }

  return lines.join('\n');
}

function propertyToText(prop: any): string {
  switch (prop.type) {
    case 'title': return (prop.title ?? []).map((t: any) => t.plain_text).join('');
    case 'rich_text': return (prop.rich_text ?? []).map((t: any) => t.plain_text).join('');
    case 'number': return prop.number != null ? String(prop.number) : '';
    case 'select': return prop.select?.name ?? '';
    case 'multi_select': return (prop.multi_select ?? []).map((s: any) => s.name).join(', ');
    case 'date': return prop.date?.start ?? '';
    case 'checkbox': return prop.checkbox ? '✅' : '❌';
    case 'url': return prop.url ?? '';
    case 'email': return prop.email ?? '';
    case 'phone_number': return prop.phone_number ?? '';
    default: return '';
  }
}

// ── State persistence ────────────────────────────────────────────

function loadState(path: string): NotionSyncState {
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch { /* ignore corrupt state */ }
  }
  return { ...DEFAULT_STATE, syncedPages: {} };
}

function saveState(path: string, state: NotionSyncState): void {
  writeFileSync(path, JSON.stringify(state, null, 2));
}

function slugify(text: string): string {
  return text
    .replace(/[^\w\u4e00-\u9fff\-/]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 80);
}
