/**
 * DeepBrain — Apple Notes Importer
 *
 * Import from Apple Notes export (HTML files from macOS/iOS export or third-party tools).
 * Also supports iCloud.com export as HTML.
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname, basename, relative } from 'path';
import type { ImportedPage } from './yuque.js';

export interface AppleNotesImportOptions {
  dir: string;
  recursive?: boolean;
  onProgress?: (current: number, total: number, file: string) => void;
}

function cleanAppleNotesHtml(html: string): string {
  let md = html;
  md = md.replace(/<style[\s\S]*?<\/style>/gi, '');
  md = md.replace(/<script[\s\S]*?<\/script>/gi, '');

  // Apple Notes checklist
  md = md.replace(/<ul class="checklist">([\s\S]*?)<\/ul>/gi, '$1');
  md = md.replace(/<li[^>]*class="[^"]*checked[^"]*"[^>]*>([\s\S]*?)<\/li>/gi, '☑ $1\n');
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '☐ $1\n');

  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  md = md.replace(/<\/?[ou]l[^>]*>/gi, '\n');

  md = md.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_match: string, table: string) => {
    return table.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_m: string, row: string) => {
      const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) ?? [];
      return cells.map((c: string) => c.replace(/<[^>]+>/g, '').trim()).join(' | ') + '\n';
    });
  });

  md = md.replace(/<[^>]+>/g, '');
  md = md.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

function extractTitle(content: string, filename: string): string {
  const titleTag = content.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleTag) return titleTag[1].trim();
  const h1 = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return h1[1].replace(/<[^>]+>/g, '').trim();
  return basename(filename, extname(filename));
}

function extractTags(md: string): string[] {
  const tags = new Set<string>();
  const matches = md.matchAll(/(^|\s)#([\w\u4e00-\u9fff]+)/g);
  for (const m of matches) tags.add(m[2]);
  return [...tags];
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'untitled';
}

export async function importAppleNotes(options: AppleNotesImportOptions): Promise<ImportedPage[]> {
  const { dir, recursive = true, onProgress } = options;
  const pages: ImportedPage[] = [];
  const files = await collectFiles(dir, recursive);

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const relPath = relative(dir, filePath);
    const ext = extname(filePath).toLowerCase();
    onProgress?.(i + 1, files.length, relPath);

    const raw = await readFile(filePath, 'utf-8');
    const body = ['.html', '.htm'].includes(ext) ? cleanAppleNotesHtml(raw) : raw.trim();

    // Derive folder from directory (Apple Notes organizes by folder)
    const parts = relPath.split(/[/\\]/);
    const folder = parts.length > 1 ? parts[0] : undefined;

    pages.push({
      slug: toSlug(basename(filePath, ext)),
      title: extractTitle(raw, filePath),
      body,
      tags: [...extractTags(body), ...(folder ? [folder] : [])],
      metadata: {
        source_platform: 'apple-notes',
        ...(folder ? { folder } : {}),
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
    else if (entry.isFile() && ['.html', '.htm', '.md', '.txt'].includes(extname(entry.name).toLowerCase())) results.push(fullPath);
  }
  return results;
}
