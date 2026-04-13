/**
 * DeepBrain — Logseq Importer
 *
 * Import from Logseq graph directory.
 * Supports: Markdown files with Logseq outline syntax, properties, page refs.
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname, basename, relative } from 'path';
import type { ImportedPage } from './yuque.js';

export interface LogseqImportOptions {
  dir: string;
  recursive?: boolean;
  onProgress?: (current: number, total: number, file: string) => void;
}

function cleanLogseq(md: string): string {
  let content = md;

  // Convert Logseq properties (key:: value)
  content = content.replace(/^(\w[\w-]*):: (.+)$/gm, '**$1:** $2');

  // Convert page refs [[page]] to plain text
  content = content.replace(/\[\[([^\]]+)\]\]/g, '$1');

  // Convert block refs ((uuid))
  content = content.replace(/\(\(([^)]+)\)\)/g, '');

  // Logseq TODO/DONE
  content = content.replace(/^(\s*-\s*)TODO\s/gm, '$1☐ ');
  content = content.replace(/^(\s*-\s*)DOING\s/gm, '$1⏳ ');
  content = content.replace(/^(\s*-\s*)DONE\s/gm, '$1☑ ');
  content = content.replace(/^(\s*-\s*)LATER\s/gm, '$1📅 ');
  content = content.replace(/^(\s*-\s*)NOW\s/gm, '$1▶️ ');

  // Remove collapsed:: true
  content = content.replace(/^\s*collapsed:: true\s*$/gm, '');

  // Remove id:: uuid lines
  content = content.replace(/^\s*id:: [a-f0-9-]+\s*$/gm, '');

  content = content.replace(/\n{3,}/g, '\n\n');
  return content.trim();
}

function extractProperties(md: string): Record<string, string> {
  const props: Record<string, string> = {};
  const matches = md.matchAll(/^(\w[\w-]*):: (.+)$/gm);
  for (const m of matches) props[m[1].toLowerCase()] = m[2].trim();
  return props;
}

function extractTags(md: string): string[] {
  const tags = new Set<string>();
  // [[page refs]]
  const refs = md.matchAll(/\[\[([^\]]+)\]\]/g);
  for (const m of refs) tags.add(m[1]);
  // #tag and #[[tag]]
  const hashTags = md.matchAll(/#(?:\[\[([^\]]+)\]\]|([\w\u4e00-\u9fff]+))/g);
  for (const m of hashTags) tags.add(m[1] ?? m[2]);
  // tags:: property
  const tagsProp = md.match(/^tags:: (.+)$/m);
  if (tagsProp) tagsProp[1].split(',').map(t => t.trim()).filter(Boolean).forEach(t => tags.add(t.replace(/^\[\[|\]\]$/g, '')));
  return [...tags];
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'untitled';
}

export async function importLogseq(options: LogseqImportOptions): Promise<ImportedPage[]> {
  const { dir, recursive = true, onProgress } = options;
  const pages: ImportedPage[] = [];

  // Logseq stores pages in /pages/ and journals in /journals/
  const pagesDir = join(dir, 'pages');
  const journalsDir = join(dir, 'journals');

  const allFiles: string[] = [];
  try { allFiles.push(...await collectMd(pagesDir, recursive)); } catch {}
  try { allFiles.push(...await collectMd(journalsDir, recursive)); } catch {}
  // Also scan root if no subdirs found
  if (allFiles.length === 0) allFiles.push(...await collectMd(dir, recursive));

  for (let i = 0; i < allFiles.length; i++) {
    const filePath = allFiles[i];
    const relPath = relative(dir, filePath);
    onProgress?.(i + 1, allFiles.length, relPath);

    const raw = await readFile(filePath, 'utf-8');
    const name = basename(filePath, extname(filePath));
    const props = extractProperties(raw);
    const isJournal = relPath.startsWith('journals');

    pages.push({
      slug: toSlug(name),
      title: props.title ?? name.replace(/_/g, ' '),
      body: cleanLogseq(raw),
      tags: extractTags(raw),
      metadata: {
        source_platform: 'logseq',
        ...(isJournal ? { type: 'journal' } : {}),
        ...Object.fromEntries(Object.entries(props).filter(([k]) => !['title', 'tags'].includes(k))),
      },
      source: relPath,
    });
  }

  return pages;
}

async function collectMd(dir: string, recursive: boolean): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && recursive) results.push(...await collectMd(fullPath, true));
    else if (entry.isFile() && ['.md', '.markdown'].includes(extname(entry.name).toLowerCase())) results.push(fullPath);
  }
  return results;
}
