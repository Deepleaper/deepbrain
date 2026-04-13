/**
 * DeepBrain — OneNote Importer
 *
 * Import from OneNote export (HTML or Markdown files).
 * OneNote exports via "Export" → HTML or through third-party converters.
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname, basename, relative } from 'path';
import type { ImportedPage } from './yuque.js';

export interface OneNoteImportOptions {
  dir: string;
  recursive?: boolean;
  onProgress?: (current: number, total: number, file: string) => void;
}

function cleanOneNoteHtml(html: string): string {
  let content = html;

  // Remove OneNote-specific elements
  content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[\s\S]*?<\/style>/gi, '');

  // Convert HTML to markdown
  content = content.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
  content = content.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
  content = content.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
  content = content.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  content = content.replace(/<br\s*\/?>/gi, '\n');
  content = content.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  content = content.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  content = content.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  content = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  content = content.replace(/<\/?[ou]l[^>]*>/gi, '\n');
  content = content.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_match: string, table: string) => {
    return table.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_m: string, row: string) => {
      const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) ?? [];
      return cells.map((c: string) => c.replace(/<[^>]+>/g, '').trim()).join(' | ') + '\n';
    });
  });

  content = content.replace(/<[^>]+>/g, '');
  content = content.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
  content = content.replace(/\n{3,}/g, '\n\n');

  return content.trim();
}

function extractTitle(content: string, filename: string): string {
  const titleTag = content.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleTag) return titleTag[1].trim();
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return basename(filename, extname(filename));
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'untitled';
}

function extractTags(md: string): string[] {
  const tags: string[] = [];
  const matches = md.matchAll(/(^|\s)#([\w\u4e00-\u9fff]+)/g);
  for (const m of matches) tags.push(m[2]);
  return [...new Set(tags)];
}

export async function importOneNote(options: OneNoteImportOptions): Promise<ImportedPage[]> {
  const { dir, recursive = true, onProgress } = options;
  const pages: ImportedPage[] = [];
  const files = await collectFiles(dir, recursive);

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const relPath = relative(dir, filePath);
    const ext = extname(filePath).toLowerCase();
    onProgress?.(i + 1, files.length, relPath);

    const raw = await readFile(filePath, 'utf-8');
    const body = ['.html', '.htm'].includes(ext) ? cleanOneNoteHtml(raw) : raw.trim();

    // Derive section/notebook from directory structure
    const parts = relPath.split(/[/\\]/);
    const section = parts.length > 1 ? parts.slice(0, -1).join('/') : undefined;

    pages.push({
      slug: toSlug(basename(filePath, ext)),
      title: extractTitle(raw, filePath),
      body,
      tags: extractTags(body),
      metadata: {
        source_platform: 'onenote',
        ...(section ? { section } : {}),
      },
      source: relPath,
    });
  }

  return pages;
}

async function collectFiles(dir: string, recursive: boolean): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && recursive) results.push(...await collectFiles(fullPath, true));
    else if (entry.isFile() && ['.md', '.html', '.htm', '.txt'].includes(extname(entry.name).toLowerCase())) results.push(fullPath);
  }
  return results;
}
