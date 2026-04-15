/**
 * DeepBrain - Memory Operation DSL
 *
 * Inspired by Text2Mem. Provides a structured operation language
 * for manipulating memories beyond simple CRUD.
 *
 * Operations: STORE, MERGE, PROMOTE, DEMOTE, EXPIRE, LOCK, SPLIT, LINK
 */

import type { Brain } from './core/brain.js';
import type { Page } from './core/types.js';

// ── Types ─────────────────────────────────────────────────────────

export type OpType = 'STORE' | 'MERGE' | 'PROMOTE' | 'DEMOTE' | 'EXPIRE' | 'LOCK' | 'SPLIT' | 'LINK';

export interface MemoryOp {
  type: OpType;
  args: Record<string, string | string[] | number | boolean>;
}

export interface OpResult {
  op: OpType;
  success: boolean;
  message: string;
  affected: string[];  // slugs affected
}

// ── Parser ────────────────────────────────────────────────────────

/**
 * Parse a DSL string into a MemoryOp.
 *
 * Syntax examples:
 *   STORE content:"My new fact" type:note tags:ai,ml
 *   MERGE topic:AI topic:ML into:ai-and-ml
 *   PROMOTE slug:my-page importance:9
 *   DEMOTE slug:old-fact importance:2
 *   EXPIRE slug:temp-note days:30
 *   LOCK slug:critical-fact
 *   SPLIT slug:big-topic into:sub1,sub2,sub3
 *   LINK from:topic-a to:topic-b context:"related research"
 */
export function parseOp(input: string): MemoryOp {
  const trimmed = input.trim();
  const firstSpace = trimmed.indexOf(' ');
  if (firstSpace === -1) {
    return { type: trimmed.toUpperCase() as OpType, args: {} };
  }

  const type = trimmed.slice(0, firstSpace).toUpperCase() as OpType;
  const rest = trimmed.slice(firstSpace + 1);

  const args: Record<string, string | string[]> = {};

  // Parse key:value and key:"quoted value" pairs
  const regex = /(\w+):(?:"([^"]*)"|([\S]+))/g;
  let match;
  const matchedParts: string[] = [];

  while ((match = regex.exec(rest)) !== null) {
    const key = match[1];
    const value = match[2] ?? match[3];

    // If key already exists, make it an array (for multi-value like topic:AI topic:ML)
    if (args[key]) {
      const existing = args[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        args[key] = [existing as string, value];
      }
    } else {
      // Check if value contains commas → array
      if (value.includes(',')) {
        args[key] = value.split(',').map(v => v.trim());
      } else {
        args[key] = value;
      }
    }
    matchedParts.push(match[0]);
  }

  // If no structured args found, treat rest as content
  if (Object.keys(args).length === 0) {
    args['content'] = rest;
  }

  return { type, args };
}

// ── Executor ──────────────────────────────────────────────────────

export async function executeOp(brain: Brain, op: MemoryOp): Promise<OpResult> {
  switch (op.type) {
    case 'STORE':   return execStore(brain, op);
    case 'MERGE':   return execMerge(brain, op);
    case 'PROMOTE': return execPromote(brain, op);
    case 'DEMOTE':  return execDemote(brain, op);
    case 'EXPIRE':  return execExpire(brain, op);
    case 'LOCK':    return execLock(brain, op);
    case 'SPLIT':   return execSplit(brain, op);
    case 'LINK':    return execLink(brain, op);
    default:
      return { op: op.type, success: false, message: `Unknown operation: ${op.type}`, affected: [] };
  }
}

async function execStore(brain: Brain, op: MemoryOp): Promise<OpResult> {
  const content = str(op.args['content']) || str(op.args['text']) || '';
  const type = str(op.args['type']) || 'note';
  const title = str(op.args['title']) || content.slice(0, 60) || 'Untitled';
  const slug = str(op.args['slug']) || slugify(title);

  await brain.put(slug, { type, title, compiled_truth: content });

  // Handle tags
  const tags = op.args['tags'];
  if (tags) {
    const tagList = Array.isArray(tags) ? tags : (tags as string).split(',');
    for (const t of tagList) {
      await brain.tag(slug, t.trim());
    }
  }

  return { op: 'STORE', success: true, message: `Stored "${slug}"`, affected: [slug] };
}

async function execMerge(brain: Brain, op: MemoryOp): Promise<OpResult> {
  // Get topics/slugs to merge
  const topics = op.args['topic'] || op.args['slug'];
  const slugs = Array.isArray(topics) ? topics : [topics as string];
  const intoSlug = str(op.args['into']) || slugs.map(s => slugify(s as string)).join('-and-');

  if (slugs.length < 2) {
    return { op: 'MERGE', success: false, message: 'MERGE requires at least 2 topics', affected: [] };
  }

  // Search for pages matching each topic
  const pages: Page[] = [];
  for (const s of slugs) {
    const slug = slugify(s as string);
    const page = await brain.get(slug);
    if (page) {
      pages.push(page);
    } else {
      // Try search
      const results = await brain.search(s as string, { limit: 1 });
      if (results.length > 0) {
        const found = await brain.get(results[0].slug);
        if (found) pages.push(found);
      }
    }
  }

  if (pages.length < 2) {
    return { op: 'MERGE', success: false, message: `Could only find ${pages.length} of ${slugs.length} topics`, affected: [] };
  }

  // Merge content
  const mergedContent = pages.map(p => `## ${p.title}\n${p.compiled_truth}`).join('\n\n');
  const mergedTitle = pages.map(p => p.title).join(' + ');

  await brain.put(intoSlug, {
    type: pages[0].type,
    title: mergedTitle,
    compiled_truth: mergedContent,
  });

  // Link merged page back to originals
  for (const p of pages) {
    await brain.link(intoSlug, p.slug, 'merged from', 'merged');
  }

  return {
    op: 'MERGE',
    success: true,
    message: `Merged ${pages.length} pages into "${intoSlug}"`,
    affected: [intoSlug, ...pages.map(p => p.slug)],
  };
}

async function execPromote(brain: Brain, op: MemoryOp): Promise<OpResult> {
  const slug = str(op.args['slug']) || '';
  const importance = parseInt(str(op.args['importance']) || '8');

  const page = await brain.get(slug);
  if (!page) return { op: 'PROMOTE', success: false, message: `Page not found: ${slug}`, affected: [] };

  const fm = { ...page.frontmatter, importance, tier: 'core', promoted_at: new Date().toISOString() };
  await brain.put(slug, { ...page, frontmatter: fm });

  return { op: 'PROMOTE', success: true, message: `Promoted "${slug}" to core (importance=${importance})`, affected: [slug] };
}

async function execDemote(brain: Brain, op: MemoryOp): Promise<OpResult> {
  const slug = str(op.args['slug']) || '';
  const importance = parseInt(str(op.args['importance']) || '2');

  const page = await brain.get(slug);
  if (!page) return { op: 'DEMOTE', success: false, message: `Page not found: ${slug}`, affected: [] };

  const fm = { ...page.frontmatter, importance, tier: 'archival', demoted_at: new Date().toISOString() };
  await brain.put(slug, { ...page, frontmatter: fm });

  return { op: 'DEMOTE', success: true, message: `Demoted "${slug}" to archival (importance=${importance})`, affected: [slug] };
}

async function execExpire(brain: Brain, op: MemoryOp): Promise<OpResult> {
  const slug = str(op.args['slug']) || '';
  const days = parseInt(str(op.args['days']) || '30');

  const page = await brain.get(slug);
  if (!page) return { op: 'EXPIRE', success: false, message: `Page not found: ${slug}`, affected: [] };

  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
  const fm = { ...page.frontmatter, expires_at: expiresAt };
  await brain.put(slug, { ...page, frontmatter: fm });

  return { op: 'EXPIRE', success: true, message: `Set expiry on "${slug}": ${expiresAt}`, affected: [slug] };
}

async function execLock(brain: Brain, op: MemoryOp): Promise<OpResult> {
  const slug = str(op.args['slug']) || '';

  const page = await brain.get(slug);
  if (!page) return { op: 'LOCK', success: false, message: `Page not found: ${slug}`, affected: [] };

  const fm = { ...page.frontmatter, locked: true, locked_at: new Date().toISOString() };
  await brain.put(slug, { ...page, frontmatter: fm });

  return { op: 'LOCK', success: true, message: `Locked "${slug}" — protected from modification`, affected: [slug] };
}

async function execSplit(brain: Brain, op: MemoryOp): Promise<OpResult> {
  const slug = str(op.args['slug']) || '';
  const into = op.args['into'];
  const subNames = Array.isArray(into) ? into : (into as string || '').split(',').map(s => s.trim()).filter(Boolean);

  const page = await brain.get(slug);
  if (!page) return { op: 'SPLIT', success: false, message: `Page not found: ${slug}`, affected: [] };

  if (subNames.length === 0) {
    // Auto-split by sections
    const sections = page.compiled_truth.split(/^## /m).filter(Boolean);
    const created: string[] = [];
    for (let i = 0; i < sections.length; i++) {
      const lines = sections[i].split('\n');
      const title = lines[0].trim() || `${page.title} - Part ${i + 1}`;
      const subSlug = slugify(title);
      const content = lines.slice(1).join('\n').trim();
      await brain.put(subSlug, { type: page.type, title, compiled_truth: content });
      await brain.link(slug, subSlug, 'split into', 'parent');
      created.push(subSlug);
    }
    return { op: 'SPLIT', success: true, message: `Split "${slug}" into ${created.length} sub-pages`, affected: [slug, ...created] };
  }

  // Split evenly by named sub-items
  const chunks = splitEvenly(page.compiled_truth, subNames.length);
  const created: string[] = [];
  for (let i = 0; i < subNames.length; i++) {
    const subSlug = slugify(subNames[i]);
    await brain.put(subSlug, {
      type: page.type,
      title: subNames[i],
      compiled_truth: chunks[i] || '',
    });
    await brain.link(slug, subSlug, 'split into', 'parent');
    created.push(subSlug);
  }

  return { op: 'SPLIT', success: true, message: `Split "${slug}" into ${created.length} sub-pages`, affected: [slug, ...created] };
}

async function execLink(brain: Brain, op: MemoryOp): Promise<OpResult> {
  const from = str(op.args['from']) || '';
  const to = str(op.args['to']) || '';
  const context = str(op.args['context']) || '';
  const linkType = str(op.args['type']) || 'related';

  if (!from || !to) {
    return { op: 'LINK', success: false, message: 'LINK requires from and to', affected: [] };
  }

  await brain.link(from, to, context, linkType);
  return { op: 'LINK', success: true, message: `Linked "${from}" → "${to}"`, affected: [from, to] };
}

// ── Helpers ───────────────────────────────────────────────────────

function str(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v[0]?.toString() || '';
  return v.toString();
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function splitEvenly(text: string, n: number): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const result: string[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < paragraphs.length; i++) {
    result[i % n].push(paragraphs[i]);
  }
  return result.map(parts => parts.join('\n\n'));
}
