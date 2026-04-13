/**
 * DeepBrain — Google Keep Importer
 *
 * Import from Google Takeout export (Google Keep).
 * Supports: .json and .html files from Takeout.
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname, basename, relative } from 'path';
import type { ImportedPage } from './yuque.js';

export interface GoogleKeepImportOptions {
  dir: string;
  recursive?: boolean;
  onProgress?: (current: number, total: number, file: string) => void;
}

interface KeepNote {
  title?: string;
  textContent?: string;
  isArchived?: boolean;
  isTrashed?: boolean;
  isPinned?: boolean;
  color?: string;
  labels?: Array<{ name: string }>;
  annotations?: Array<{ url: string; title?: string }>;
  listContent?: Array<{ text: string; isChecked: boolean }>;
  userEditedTimestampUsec?: number;
  createdTimestampUsec?: number;
}

function keepToMarkdown(note: KeepNote): string {
  const parts: string[] = [];

  if (note.title) parts.push(`# ${note.title}\n`);

  if (note.textContent) parts.push(note.textContent);

  if (note.listContent?.length) {
    for (const item of note.listContent) {
      const check = item.isChecked ? '☑' : '☐';
      parts.push(`${check} ${item.text}`);
    }
  }

  if (note.annotations?.length) {
    parts.push('\n---\n**Links:**');
    for (const ann of note.annotations) {
      parts.push(`- [${ann.title ?? ann.url}](${ann.url})`);
    }
  }

  return parts.join('\n').trim();
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'untitled';
}

export async function importGoogleKeep(options: GoogleKeepImportOptions): Promise<ImportedPage[]> {
  const { dir, recursive = true, onProgress } = options;
  const pages: ImportedPage[] = [];
  const files = await collectFiles(dir, recursive, ['.json']);
  let current = 0;

  for (const filePath of files) {
    current++;
    const relPath = relative(dir, filePath);
    onProgress?.(current, files.length, relPath);

    try {
      const raw = await readFile(filePath, 'utf-8');
      const note: KeepNote = JSON.parse(raw);

      // Skip trashed notes
      if (note.isTrashed) continue;

      const title = note.title || basename(filePath, '.json');
      const tags = (note.labels ?? []).map(l => l.name);
      if (note.isPinned) tags.push('pinned');
      if (note.isArchived) tags.push('archived');

      pages.push({
        slug: toSlug(title),
        title,
        body: keepToMarkdown(note),
        tags,
        metadata: {
          source_platform: 'google-keep',
          ...(note.color && note.color !== 'DEFAULT' ? { color: note.color } : {}),
          ...(note.userEditedTimestampUsec ? { updated_at: new Date(note.userEditedTimestampUsec / 1000).toISOString() } : {}),
          ...(note.createdTimestampUsec ? { created_at: new Date(note.createdTimestampUsec / 1000).toISOString() } : {}),
        },
        source: relPath,
      });
    } catch { /* skip invalid JSON */ }
  }

  return pages;
}

async function collectFiles(dir: string, recursive: boolean, exts: string[]): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && recursive) results.push(...await collectFiles(fullPath, true, exts));
    else if (entry.isFile() && exts.includes(extname(entry.name).toLowerCase())) results.push(fullPath);
  }
  return results;
}
