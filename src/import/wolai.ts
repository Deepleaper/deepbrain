/**
 * DeepBrain — Wolai (我来) Importer
 *
 * Import from Wolai export (Markdown files).
 * Wolai exports pages as Markdown with properties.
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname, basename, relative } from 'path';
import type { ImportedPage } from './yuque.js';

export interface WolaiImportOptions {
  dir: string;
  recursive?: boolean;
  onProgress?: (current: number, total: number, file: string) => void;
}

function cleanWolai(md: string): string {
  let content = md;

  // Remove Wolai-specific callout syntax
  content = content.replace(/^💡\s*/gm, '> 💡 ');
  content = content.replace(/^⚠️\s*/gm, '> ⚠️ ');
  content = content.replace(/^ℹ️\s*/gm, '> ℹ️ ');

  // Wolai toggle: ▶ Title → ## Title
  content = content.replace(/^[▶▸]\s*(.+)$/gm, '### $1');

  // Clean up database views (CSV-like blocks)
  content = content.replace(/^\|.*\|$/gm, (line) => line); // Keep tables as-is

  return content.trim();
}

function extractTags(md: string): string[] {
  const tags = new Set<string>();
  const matches = md.matchAll(/(^|\s)#([\w\u4e00-\u9fff\u3400-\u4dbf]+)/g);
  for (const m of matches) tags.add(m[2]);
  return [...tags];
}

function extractTitle(md: string, filename: string): string {
  const h1 = md.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return basename(filename, extname(filename)).replace(/ [a-f0-9]{32}$/, ''); // Remove Wolai UUID suffix
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/ [a-f0-9]{32}$/, '').replace(/[\s_]+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'untitled';
}

export async function importWolai(options: WolaiImportOptions): Promise<ImportedPage[]> {
  const { dir, recursive = true, onProgress } = options;
  const pages: ImportedPage[] = [];
  const files = await collectFiles(dir, recursive);

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const relPath = relative(dir, filePath);
    onProgress?.(i + 1, files.length, relPath);

    const raw = await readFile(filePath, 'utf-8');

    pages.push({
      slug: toSlug(basename(filePath, extname(filePath))),
      title: extractTitle(raw, filePath),
      body: cleanWolai(raw),
      tags: extractTags(raw),
      metadata: { source_platform: 'wolai' },
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
    else if (entry.isFile() && ['.md', '.markdown'].includes(extname(entry.name).toLowerCase())) results.push(fullPath);
  }
  return results;
}
