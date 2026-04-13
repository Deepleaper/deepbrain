/**
 * DeepBrain — Joplin Importer
 *
 * Import from Joplin export (JEX or RAW directory with .md files).
 * JEX = tar of markdown files with metadata headers.
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname, basename, relative } from 'path';
import type { ImportedPage } from './yuque.js';

export interface JoplinImportOptions {
  dir: string;
  recursive?: boolean;
  onProgress?: (current: number, total: number, file: string) => void;
}

interface JoplinMeta {
  id?: string;
  parent_id?: string;
  title?: string;
  created_time?: string;
  updated_time?: string;
  is_todo?: string;
  todo_completed?: string;
  source_url?: string;
  type_?: string; // 1=note, 2=folder
  latitude?: string;
  longitude?: string;
}

function parseJoplinMd(raw: string): { body: string; meta: JoplinMeta } {
  const meta: JoplinMeta = {};

  // Joplin puts metadata at the end after a blank line + key: value pairs
  const parts = raw.split(/\n\n(?=id: [a-f0-9]{32})/);

  if (parts.length >= 2) {
    const metaBlock = parts[parts.length - 1];
    const body = parts.slice(0, -1).join('\n\n');

    for (const line of metaBlock.split('\n')) {
      const match = line.match(/^(\w+): (.+)$/);
      if (match) (meta as any)[match[1]] = match[2].trim();
    }

    return { body: body.trim(), meta };
  }

  return { body: raw.trim(), meta };
}

function extractTags(md: string): string[] {
  const tags: string[] = [];
  const matches = md.matchAll(/(^|\s)#([\w\u4e00-\u9fff]+)/g);
  for (const m of matches) tags.push(m[2]);
  return [...new Set(tags)];
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'untitled';
}

export async function importJoplin(options: JoplinImportOptions): Promise<ImportedPage[]> {
  const { dir, recursive = true, onProgress } = options;
  const pages: ImportedPage[] = [];
  const files = await collectFiles(dir, recursive);

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const relPath = relative(dir, filePath);
    onProgress?.(i + 1, files.length, relPath);

    const raw = await readFile(filePath, 'utf-8');
    const { body, meta } = parseJoplinMd(raw);

    // Skip folders (type_ = 2)
    if (meta.type_ === '2') continue;

    const title = meta.title ?? body.match(/^#\s+(.+)$/m)?.[1] ?? basename(filePath, extname(filePath));
    const tags = extractTags(body);

    if (meta.is_todo === '1') tags.push('todo');
    if (meta.todo_completed) tags.push('completed');

    pages.push({
      slug: meta.id ? meta.id.slice(0, 12) : toSlug(title),
      title,
      body,
      tags,
      metadata: {
        source_platform: 'joplin',
        ...(meta.id ? { joplin_id: meta.id } : {}),
        ...(meta.created_time ? { created_at: meta.created_time } : {}),
        ...(meta.updated_time ? { updated_at: meta.updated_time } : {}),
        ...(meta.source_url ? { source_url: meta.source_url } : {}),
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
    else if (entry.isFile() && ['.md', '.markdown'].includes(extname(entry.name).toLowerCase())) results.push(fullPath);
  }
  return results;
}
