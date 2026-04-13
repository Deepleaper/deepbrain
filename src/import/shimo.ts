/**
 * DeepBrain — Shimo (石墨文档) Importer
 *
 * Import from Shimo Markdown/HTML/DOCX export.
 * Supports: .md, .html, nested directories.
 *
 * Usage:
 *   import { importShimo } from 'deepbrain/import';
 *   const pages = await importShimo({ dir: '/path/to/shimo-export/' });
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname, basename, relative } from 'path';
import type { ImportedPage } from './yuque.js';

// ── Types ──────────────────────────────────────────────────────────

export interface ShimoImportOptions {
  dir: string;
  recursive?: boolean;
  onProgress?: (current: number, total: number, file: string) => void;
}

// ── HTML to Markdown (lightweight) ────────────────────────────────

function htmlToMarkdown(html: string): string {
  let md = html;

  // Remove scripts and styles
  md = md.replace(/<script[\s\S]*?<\/script>/gi, '');
  md = md.replace(/<style[\s\S]*?<\/style>/gi, '');

  // Headers
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n');

  // Paragraphs and breaks
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');

  // Lists
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<\/?[ou]l[^>]*>/gi, '\n');

  // Bold and italic
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');

  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Images
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // Code
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '```\n$1\n```\n');

  // Blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n');

  // Strip remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&nbsp;/g, ' ');

  // Clean up whitespace
  md = md.replace(/\n{3,}/g, '\n\n');

  return md.trim();
}

// ── Helpers ───────────────────────────────────────────────────────

function extractTitle(content: string, filename: string): string {
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  // HTML title
  const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();
  return basename(filename, extname(filename));
}

function extractTags(md: string): string[] {
  const tags: string[] = [];
  const inlineTags = md.match(/(^|\s)#([\w\u4e00-\u9fff\u3400-\u4dbf]+)/g);
  if (inlineTags) tags.push(...inlineTags.map(t => t.trim().replace(/^#/, '')));
  return [...new Set(tags)];
}

function toSlug(filename: string, prefix?: string): string {
  const base = basename(filename, extname(filename))
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\u4e00-\u9fff\u3400-\u4dbf-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return prefix ? `${prefix}/${base}` : base;
}

// ── Main Import ───────────────────────────────────────────────────

export async function importShimo(options: ShimoImportOptions): Promise<ImportedPage[]> {
  const { dir, recursive = true, onProgress } = options;
  const pages: ImportedPage[] = [];
  const files = await collectFiles(dir, recursive);
  let current = 0;

  for (const filePath of files) {
    current++;
    const ext = extname(filePath).toLowerCase();
    const relPath = relative(dir, filePath);
    const prefix = relPath.includes('/') || relPath.includes('\\')
      ? relPath.split(/[/\\]/).slice(0, -1).join('/').toLowerCase()
      : undefined;

    onProgress?.(current, files.length, relPath);

    const raw = await readFile(filePath, 'utf-8');
    let body: string;

    if (ext === '.html' || ext === '.htm') {
      body = htmlToMarkdown(raw);
    } else {
      body = raw;
    }

    // Strip frontmatter
    body = body.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();

    pages.push({
      slug: toSlug(basename(filePath), prefix),
      title: extractTitle(raw, filePath),
      body,
      tags: extractTags(body),
      metadata: { source_platform: 'shimo' },
      source: relPath,
    });
  }

  return pages;
}

// ── File Collection ───────────────────────────────────────────────

async function collectFiles(dir: string, recursive: boolean): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && recursive) {
      results.push(...await collectFiles(fullPath, true));
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (['.md', '.markdown', '.html', '.htm'].includes(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}
