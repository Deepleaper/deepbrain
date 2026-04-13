/**
 * DeepBrain — Yuque (语雀) Importer
 *
 * Import from Yuque Markdown/Lakebook export.
 * Supports: .md files, .lakebook (JSON), nested directories (知识库结构).
 *
 * Usage:
 *   import { importYuque } from 'deepbrain/import';
 *   const pages = await importYuque('/path/to/yuque-export/');
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, extname, basename, relative } from 'path';

// ── Types ──────────────────────────────────────────────────────────

export interface YuqueImportOptions {
  /** Root directory of Yuque export */
  dir: string;
  /** Include nested directories (default: true) */
  recursive?: boolean;
  /** Progress callback */
  onProgress?: (current: number, total: number, file: string) => void;
}

export interface ImportedPage {
  slug: string;
  title: string;
  body: string;
  tags: string[];
  metadata: Record<string, string>;
  source: string;  // original file path
}

// ── Lakebook Parser ────────────────────────────────────────────────

interface LakebookDoc {
  title?: string;
  slug?: string;
  body?: string;
  body_html?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

function parseLakebook(content: string): LakebookDoc[] {
  try {
    const data = JSON.parse(content);
    if (Array.isArray(data)) return data;
    if (data.docs) return data.docs;
    if (data.data) return Array.isArray(data.data) ? data.data : [data.data];
    return [data];
  } catch {
    return [];
  }
}

// ── Yuque Markdown Cleanup ────────────────────────────────────────

function cleanYuqueMarkdown(md: string): string {
  let cleaned = md;

  // Remove Yuque-specific HTML tags
  cleaned = cleaned.replace(/<a name="[^"]*"><\/a>/g, '');

  // Convert Yuque card links to regular links
  // [文档名](https://www.yuque.com/xxx/yyy/zzz)
  cleaned = cleaned.replace(/\[([^\]]+)\]\(https:\/\/www\.yuque\.com\/[^)]+\)/g, '[[$1]]');

  // Remove Yuque image sizing params
  cleaned = cleaned.replace(/(!\[[^\]]*\]\([^)]+)\?[^)]+(\))/g, '$1$2');

  // Clean Yuque-specific admonitions
  cleaned = cleaned.replace(/:::tips\n/g, '> **💡 提示**\n> ');
  cleaned = cleaned.replace(/:::warning\n/g, '> **⚠️ 警告**\n> ');
  cleaned = cleaned.replace(/:::danger\n/g, '> **🔴 危险**\n> ');
  cleaned = cleaned.replace(/:::info\n/g, '> **ℹ️ 信息**\n> ');
  cleaned = cleaned.replace(/:::/g, '');

  return cleaned.trim();
}

// ── Extract Title ─────────────────────────────────────────────────

function extractTitle(md: string, filename: string): string {
  // Try H1
  const h1Match = md.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();

  // Try YAML frontmatter title
  const fmMatch = md.match(/^---\n[\s\S]*?^title:\s*(.+)$/m);
  if (fmMatch) return fmMatch[1].trim().replace(/^["']|["']$/g, '');

  // Fallback to filename
  return basename(filename, extname(filename));
}

// ── Extract Tags ──────────────────────────────────────────────────

function extractTags(md: string): string[] {
  const tags: string[] = [];

  // YAML frontmatter tags
  const fmMatch = md.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const tagsMatch = fmMatch[1].match(/^tags:\s*\[([^\]]*)\]/m);
    if (tagsMatch) {
      tags.push(...tagsMatch[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, '')).filter(Boolean));
    }
    // YAML list format
    const listMatch = fmMatch[1].match(/^tags:\s*\n((?:\s*-\s+.+\n?)*)/m);
    if (listMatch) {
      tags.push(...listMatch[1].split('\n').map(l => l.replace(/^\s*-\s+/, '').trim()).filter(Boolean));
    }
  }

  // Inline #tags (including Chinese)
  const inlineTags = md.match(/(^|\s)#([\w\u4e00-\u9fff\u3400-\u4dbf]+)/g);
  if (inlineTags) {
    tags.push(...inlineTags.map(t => t.trim().replace(/^#/, '')));
  }

  return [...new Set(tags)];
}

// ── Slug Generation ───────────────────────────────────────────────

function toSlug(filename: string, prefix?: string): string {
  const base = basename(filename, extname(filename))
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\u4e00-\u9fff\u3400-\u4dbf-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return prefix ? `${prefix}/${base}` : base;
}

// ── Strip Frontmatter ─────────────────────────────────────────────

function stripFrontmatter(md: string): string {
  return md.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
}

// ── Extract Metadata from Frontmatter ─────────────────────────────

function extractMetadata(md: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const fmMatch = md.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return meta;

  for (const line of fmMatch[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)/);
    if (kv && !['tags'].includes(kv[1])) {
      meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return meta;
}

// ── Main Import ───────────────────────────────────────────────────

export async function importYuque(options: YuqueImportOptions): Promise<ImportedPage[]> {
  const { dir, recursive = true, onProgress } = options;
  const pages: ImportedPage[] = [];

  // Collect files
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

    if (ext === '.md' || ext === '.markdown') {
      const content = await readFile(filePath, 'utf-8');
      const cleaned = cleanYuqueMarkdown(content);
      const body = stripFrontmatter(cleaned);

      pages.push({
        slug: toSlug(basename(filePath), prefix),
        title: extractTitle(content, filePath),
        body,
        tags: extractTags(content),
        metadata: { ...extractMetadata(content), source_platform: 'yuque' },
        source: relPath,
      });
    } else if (ext === '.lakebook' || ext === '.json') {
      const content = await readFile(filePath, 'utf-8');
      const docs = parseLakebook(content);

      for (const doc of docs) {
        if (!doc.body && !doc.body_html) continue;
        pages.push({
          slug: doc.slug ?? toSlug(doc.title ?? 'untitled', prefix),
          title: doc.title ?? 'Untitled',
          body: doc.body ?? doc.body_html ?? '',
          tags: doc.tags ?? [],
          metadata: {
            source_platform: 'yuque',
            ...(doc.created_at ? { created_at: doc.created_at } : {}),
            ...(doc.updated_at ? { updated_at: doc.updated_at } : {}),
          },
          source: relPath,
        });
      }
    }
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
      if (['.md', '.markdown', '.lakebook', '.json'].includes(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}
