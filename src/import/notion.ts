/**
 * DeepBrain — Notion Importer
 *
 * Import pages from Notion export (Markdown + CSV).
 * Supports: Notion HTML export, Notion Markdown export, Notion CSV database export.
 *
 * Usage:
 *   deepbrain import notion ./notion-export/
 *   deepbrain import notion ./notion-export/my-page.md
 *
 * Programmatic:
 *   import { importNotion } from 'deepbrain/import';
 *   const result = await importNotion(brain, './notion-export/');
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename, extname, relative } from 'node:path';
import type { Brain } from '../core/brain.js';

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ file: string; error: string }>;
  pages: string[];
}

export interface ImportOptions {
  /** Override page type (default: auto-detect) */
  type?: string;
  /** Prefix for slugs (e.g. "notion/") */
  prefix?: string;
  /** Dry run — don't actually import */
  dryRun?: boolean;
  /** Progress callback */
  onProgress?: (current: number, total: number, file: string) => void;
}

/**
 * Import from a Notion export directory or single file.
 */
export async function importNotion(
  brain: Brain,
  path: string,
  opts: ImportOptions = {},
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [], pages: [] };

  if (!existsSync(path)) {
    throw new Error(`Path not found: ${path}`);
  }

  const stat = statSync(path);
  const files: string[] = [];

  if (stat.isFile()) {
    files.push(path);
  } else if (stat.isDirectory()) {
    collectFiles(path, files);
  }

  const total = files.length;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    opts.onProgress?.(i + 1, total, file);

    try {
      const ext = extname(file).toLowerCase();
      if (ext === '.md' || ext === '.markdown') {
        await importMarkdownFile(brain, file, path, opts, result);
      } else if (ext === '.html' || ext === '.htm') {
        await importHtmlFile(brain, file, path, opts, result);
      } else if (ext === '.csv') {
        await importCsvFile(brain, file, path, opts, result);
      } else {
        result.skipped++;
      }
    } catch (e: any) {
      result.errors.push({ file, error: e.message });
    }
  }

  return result;
}

function collectFiles(dir: string, out: string[]): void {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, out);
    } else {
      const ext = extname(entry.name).toLowerCase();
      if (['.md', '.markdown', '.html', '.htm', '.csv'].includes(ext)) {
        out.push(full);
      }
    }
  }
}

async function importMarkdownFile(
  brain: Brain,
  file: string,
  basePath: string,
  opts: ImportOptions,
  result: ImportResult,
): Promise<void> {
  const content = readFileSync(file, 'utf8');
  if (content.trim().length < 10) { result.skipped++; return; }

  const { title, body, metadata } = parseMarkdown(content);
  const slug = makeSlug(file, basePath, opts.prefix);

  if (opts.dryRun) {
    result.pages.push(slug);
    result.imported++;
    return;
  }

  await brain.put(slug, {
    type: opts.type ?? metadata.type ?? 'note',
    title: title || basename(file, extname(file)),
    compiled_truth: body,
  });

  // Import tags from Notion metadata
  if (metadata.tags) {
    for (const tag of metadata.tags) {
      await brain.tag(slug, tag);
    }
  }

  result.pages.push(slug);
  result.imported++;
}

async function importHtmlFile(
  brain: Brain,
  file: string,
  basePath: string,
  opts: ImportOptions,
  result: ImportResult,
): Promise<void> {
  const html = readFileSync(file, 'utf8');
  if (html.trim().length < 20) { result.skipped++; return; }

  // Strip HTML tags for plain text (basic)
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (text.length < 10) { result.skipped++; return; }

  // Extract title from <title> or <h1>
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
    || html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const title = titleMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || basename(file, extname(file));

  const slug = makeSlug(file, basePath, opts.prefix);

  if (opts.dryRun) {
    result.pages.push(slug);
    result.imported++;
    return;
  }

  await brain.put(slug, {
    type: opts.type ?? 'note',
    title,
    compiled_truth: text,
  });

  result.pages.push(slug);
  result.imported++;
}

async function importCsvFile(
  brain: Brain,
  file: string,
  basePath: string,
  opts: ImportOptions,
  result: ImportResult,
): Promise<void> {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) { result.skipped++; return; }

  const headers = parseCsvLine(lines[0]);
  const nameCol = headers.findIndex(h =>
    /^(name|title|名称|标题)$/i.test(h.trim())
  );
  if (nameCol === -1) { result.skipped++; return; }

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const name = cols[nameCol]?.trim();
    if (!name) continue;

    const slug = (opts.prefix ?? '') + slugify(name);
    const compiled_truth = headers
      .map((h, j) => cols[j]?.trim() ? `**${h.trim()}:** ${cols[j].trim()}` : '')
      .filter(Boolean)
      .join('\n');

    if (opts.dryRun) {
      result.pages.push(slug);
      result.imported++;
      continue;
    }

    try {
      await brain.put(slug, {
        type: opts.type ?? 'note',
        title: name,
        compiled_truth,
      });
      result.pages.push(slug);
      result.imported++;
    } catch (e: any) {
      result.errors.push({ file: `${file}:row${i + 1}`, error: e.message });
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function parseMarkdown(content: string): { title: string; body: string; metadata: Record<string, any> } {
  let title = '';
  let body = content;
  const metadata: Record<string, any> = {};

  // Parse YAML frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (fmMatch) {
    const fm = fmMatch[1];
    body = fmMatch[2];
    for (const line of fm.split('\n')) {
      const [key, ...rest] = line.split(':');
      if (key && rest.length) {
        const val = rest.join(':').trim();
        if (key.trim() === 'tags') {
          metadata.tags = val.replace(/[\[\]]/g, '').split(',').map(t => t.trim()).filter(Boolean);
        } else if (key.trim() === 'type') {
          metadata.type = val;
        } else if (key.trim() === 'title') {
          title = val;
        }
      }
    }
  }

  // Extract title from first H1
  if (!title) {
    const h1Match = body.match(/^#\s+(.+)/m);
    if (h1Match) {
      title = h1Match[1].trim();
    }
  }

  return { title, body: body.trim(), metadata };
}

function makeSlug(file: string, basePath: string, prefix?: string): string {
  const stat = statSync(basePath);
  const rel = stat.isDirectory() ? relative(basePath, file) : basename(file);
  const raw = rel
    .replace(/\\/g, '/')
    .replace(/\.[^.]+$/, '') // remove extension
    .replace(/\s+/g, '-')
    .toLowerCase();
  return (prefix ?? '') + slugify(raw);
}

function slugify(text: string): string {
  return text
    .replace(/[^\w\u4e00-\u9fff\-/]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuote = false;
  for (const char of line) {
    if (char === '"') {
      inQuote = !inQuote;
    } else if (char === ',' && !inQuote) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
