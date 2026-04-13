/**
 * DeepBrain — Bear Notes Importer
 *
 * Import from Bear export (Markdown files with Bear-specific syntax).
 * Supports: .md files exported from Bear.
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname, basename, relative } from 'path';
import type { ImportedPage } from './yuque.js';

export interface BearImportOptions {
  dir: string;
  recursive?: boolean;
  onProgress?: (current: number, total: number, file: string) => void;
}

function cleanBear(md: string): string {
  let content = md;

  // Bear uses #tag/subtag — keep as-is for tag extraction but clean nested
  // Bear checkbox: - [x] done, - [ ] todo (already standard markdown)

  // Bear separator
  content = content.replace(/^---$/gm, '\n---\n');

  // Bear highlight ::text:: → ==text==
  content = content.replace(/::([\s\S]*?)::/g, '==$1==');

  return content.trim();
}

function extractTags(md: string): string[] {
  const tags = new Set<string>();
  // Bear #tag and #tag/subtag (also supports Chinese)
  const matches = md.matchAll(/(?:^|\s)#([\w\u4e00-\u9fff\u3400-\u4dbf/]+)/g);
  for (const m of matches) {
    const tag = m[1];
    tags.add(tag);
    // Also add parent tags for nested tags
    if (tag.includes('/')) {
      const parts = tag.split('/');
      for (let i = 1; i < parts.length; i++) {
        tags.add(parts.slice(0, i).join('/'));
      }
    }
  }
  return [...tags];
}

function extractTitle(md: string, filename: string): string {
  const h1 = md.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return basename(filename, extname(filename));
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'untitled';
}

export async function importBear(options: BearImportOptions): Promise<ImportedPage[]> {
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
      body: cleanBear(raw),
      tags: extractTags(raw),
      metadata: { source_platform: 'bear' },
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
    else if (entry.isFile() && ['.md', '.markdown', '.txt'].includes(extname(entry.name).toLowerCase())) results.push(fullPath);
  }
  return results;
}
