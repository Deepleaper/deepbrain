#!/usr/bin/env node

/**
 * DeepBrain — MCP Server
 *
 * Model Context Protocol server that exposes DeepBrain as a tool
 * for Claude, Cursor, OpenClaw, and any MCP-compatible client.
 *
 * Tools:
 *   brain_put       — Store knowledge
 *   brain_get       — Read a page
 *   brain_query     — Semantic search
 *   brain_search    — Keyword search
 *   brain_link      — Link two pages
 *   brain_unlink    — Remove a link
 *   brain_tag       — Tag a page
 *   brain_timeline  — Add timeline entry
 *   brain_stats     — Brain statistics
 *   brain_list      — List pages
 *   brain_delete    — Delete a page
 *   brain_dream     — Run Dream Cycle
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Brain } from './core/brain.js';
import { dream } from './dream/index.js';
import type { DeepBrainConfig } from './core/types.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const CONFIG_FILE = process.env.DEEPBRAIN_CONFIG || 'deepbrain.json';

function loadConfig(): Partial<DeepBrainConfig> {
  const configPath = resolve(CONFIG_FILE);
  if (existsSync(configPath)) {
    return JSON.parse(readFileSync(configPath, 'utf8'));
  }
  return {};
}

const TOOLS = [
  {
    name: 'brain_put',
    description: 'Store or update knowledge in your brain. Overwrites compiled_truth, appends timeline.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: { type: 'string', description: 'Unique identifier (e.g. "john-doe", "meeting-2026-04")' },
        title: { type: 'string', description: 'Page title' },
        content: { type: 'string', description: 'Knowledge content (compiled truth)' },
        type: { type: 'string', description: 'Page type (e.g. person, company, note, project). Any string.', default: 'note' },
        timeline: { type: 'string', description: 'Timeline entry to append (optional)' },
      },
      required: ['slug', 'title', 'content'],
    },
  },
  {
    name: 'brain_get',
    description: 'Read a specific knowledge page by slug.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: { type: 'string', description: 'Page slug to retrieve' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'brain_query',
    description: 'Semantic search across your brain. Uses hybrid search (vector + keyword + RRF fusion).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'Natural language query' },
        limit: { type: 'number', description: 'Max results (default 10)', default: 10 },
        type: { type: 'string', description: 'Filter by page type (optional)' },
      },
      required: ['text'],
    },
  },
  {
    name: 'brain_search',
    description: 'Keyword search across your brain.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        keyword: { type: 'string', description: 'Keyword to search' },
        limit: { type: 'number', description: 'Max results (default 10)', default: 10 },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'brain_link',
    description: 'Create a link between two knowledge pages.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        from: { type: 'string', description: 'Source page slug' },
        to: { type: 'string', description: 'Target page slug' },
        context: { type: 'string', description: 'Relationship context (e.g. "founder of", "works at")' },
        link_type: { type: 'string', description: 'Link type (default "related")', default: 'related' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'brain_unlink',
    description: 'Remove a link between two pages.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        from: { type: 'string', description: 'Source page slug' },
        to: { type: 'string', description: 'Target page slug' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'brain_tag',
    description: 'Add a tag to a page.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: { type: 'string', description: 'Page slug' },
        tag: { type: 'string', description: 'Tag to add' },
      },
      required: ['slug', 'tag'],
    },
  },
  {
    name: 'brain_timeline',
    description: 'Add a timeline entry to a page (append-only historical record).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: { type: 'string', description: 'Page slug' },
        date: { type: 'string', description: 'Date (YYYY-MM-DD). Defaults to today.' },
        summary: { type: 'string', description: 'Event summary' },
        detail: { type: 'string', description: 'Event detail (optional)' },
      },
      required: ['slug', 'summary'],
    },
  },
  {
    name: 'brain_stats',
    description: 'Get brain statistics (page count, chunks, links, tags, etc.).',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'brain_list',
    description: 'List pages in the brain.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        type: { type: 'string', description: 'Filter by type (optional)' },
        limit: { type: 'number', description: 'Max results (default 50)', default: 50 },
      },
    },
  },
  {
    name: 'brain_delete',
    description: 'Delete a knowledge page and all its links/tags.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: { type: 'string', description: 'Page slug to delete' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'brain_dream',
    description: 'Run Dream Cycle — automated brain maintenance (re-embed stale pages, find orphans, fix dead links).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        tasks: {
          type: 'array',
          items: { type: 'string', enum: ['stale', 'orphan', 'links', 'stats'] },
          description: 'Specific tasks to run (default: all)',
        },
      },
    },
  },
];

async function main() {
  const config = loadConfig();
  const brain = new Brain(config);
  await brain.connect();

  const server = new Server(
    { name: 'deepbrain', version: '1.4.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      switch (name) {
        case 'brain_put': {
          const page = await brain.put(args.slug as string, {
            type: (args.type as string) || 'note',
            title: args.title as string,
            compiled_truth: args.content as string,
            timeline: args.timeline as string,
          });
          return { content: [{ type: 'text', text: `✅ Saved "${page.title}" (${page.type}) — ${(args.content as string).length} chars, auto-chunked & embedded.` }] };
        }

        case 'brain_get': {
          const page = await brain.get(args.slug as string);
          if (!page) return { content: [{ type: 'text', text: `Page not found: ${args.slug}` }] };

          const tags = await brain.getTags(page.slug);
          const links = await brain.getLinks(page.slug);
          const backlinks = await brain.getBacklinks(page.slug);

          let text = `# ${page.title}\n\nType: ${page.type} | Updated: ${page.updated_at}\n`;
          if (tags.length) text += `Tags: ${tags.join(', ')}\n`;
          if (links.length) text += `Links: ${links.map(l => `→ ${l.to_slug} (${l.link_type})`).join(', ')}\n`;
          if (backlinks.length) text += `Backlinks: ${backlinks.map(l => `← ${l.from_slug} (${l.link_type})`).join(', ')}\n`;
          text += `\n---\n\n${page.compiled_truth}`;
          if (page.timeline) text += `\n\n---\n## Timeline\n${page.timeline}`;

          return { content: [{ type: 'text', text }] };
        }

        case 'brain_query': {
          const results = await brain.query(args.text as string, {
            limit: (args.limit as number) || 10,
            type: args.type as string,
          });
          if (!results.length) return { content: [{ type: 'text', text: 'No results found.' }] };

          const text = results.map((r, i) =>
            `${i + 1}. **${r.slug}** (${r.type}) — score: ${r.score.toFixed(4)}\n   ${r.chunk_text.slice(0, 200)}`
          ).join('\n\n');
          return { content: [{ type: 'text', text: `🔍 ${results.length} results for "${args.text}":\n\n${text}` }] };
        }

        case 'brain_search': {
          const results = await brain.search(args.keyword as string, {
            limit: (args.limit as number) || 10,
          });
          if (!results.length) return { content: [{ type: 'text', text: 'No results found.' }] };

          const text = results.map((r, i) =>
            `${i + 1}. **${r.slug}** (${r.type}) — score: ${r.score.toFixed(4)}\n   ${r.chunk_text.slice(0, 200)}`
          ).join('\n\n');
          return { content: [{ type: 'text', text: `🔑 ${results.length} results for "${args.keyword}":\n\n${text}` }] };
        }

        case 'brain_link': {
          await brain.link(args.from as string, args.to as string, (args.context as string) || '', (args.link_type as string) || 'related');
          return { content: [{ type: 'text', text: `🔗 ${args.from} → ${args.to}` }] };
        }

        case 'brain_unlink': {
          await brain.unlink(args.from as string, args.to as string);
          return { content: [{ type: 'text', text: `❌ Unlinked ${args.from} → ${args.to}` }] };
        }

        case 'brain_tag': {
          await brain.tag(args.slug as string, args.tag as string);
          return { content: [{ type: 'text', text: `🏷️ Tagged "${args.slug}" with "${args.tag}"` }] };
        }

        case 'brain_timeline': {
          await brain.addTimeline(args.slug as string, {
            date: (args.date as string) || new Date().toISOString().split('T')[0],
            summary: args.summary as string,
            detail: (args.detail as string) || '',
          });
          return { content: [{ type: 'text', text: `📅 Timeline added to "${args.slug}"` }] };
        }

        case 'brain_stats': {
          const s = await brain.stats();
          return {
            content: [{
              type: 'text',
              text: `🧠 DeepBrain Stats\n\nPages: ${s.page_count}\nChunks: ${s.chunk_count} (${s.embedded_count} embedded)\nLinks: ${s.link_count}\nTags: ${s.tag_count}\nTimeline: ${s.timeline_entry_count}\nBy type: ${JSON.stringify(s.pages_by_type)}`,
            }],
          };
        }

        case 'brain_list': {
          const pages = await brain.list({
            type: args.type as string,
            limit: (args.limit as number) || 50,
          });
          const text = pages.map(p => `• ${p.slug} (${p.type}) — ${p.title}`).join('\n');
          return { content: [{ type: 'text', text: `📋 ${pages.length} pages:\n\n${text}` }] };
        }

        case 'brain_delete': {
          await brain.delete(args.slug as string);
          return { content: [{ type: 'text', text: `🗑️ Deleted "${args.slug}"` }] };
        }

        case 'brain_dream': {
          const report = await dream(brain, { tasks: args.tasks as any });
          return {
            content: [{
              type: 'text',
              text: `💤 Dream Cycle complete\n\nRefreshed: ${report.stale_refreshed}\nOrphans: ${report.orphans_found}\nDead links removed: ${report.dead_links_removed}\nErrors: ${report.errors.length ? report.errors.join('; ') : 'none'}`,
            }],
          };
        }

        default:
          return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
      }
    } catch (e: any) {
      return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(e => {
  console.error('MCP Server error:', e);
  process.exit(1);
});
