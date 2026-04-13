/**
 * DeepBrain — Evernote / 印象笔记 Importer
 *
 * Import from Evernote ENEX export format (XML-based).
 * Supports: .enex files containing one or multiple notes.
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname, basename, relative } from 'path';
import type { ImportedPage } from './yuque.js';

export interface EvernoteImportOptions {
  dir: string;
  recursive?: boolean;
  onProgress?: (current: number, total: number, file: string) => void;
}

// ── ENEX XML Parsing ──────────────────────────────────────────────

interface EnexNote {
  title: string;
  content: string;
  created: string;
  updated: string;
  tags: string[];
  source?: string;
}

function parseEnex(xml: string): EnexNote[] {
  const notes: EnexNote[] = [];
  const noteBlocks = xml.match(/<note>([\s\S]*?)<\/note>/gi) ?? [];

  for (const block of noteBlocks) {
    const title = block.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? 'Untitled';
    const contentXml = block.match(/<content>([\s\S]*?)<\/content>/i)?.[1] ?? '';
    const created = block.match(/<created>([\s\S]*?)<\/created>/i)?.[1]?.trim() ?? '';
    const updated = block.match(/<updated>([\s\S]*?)<\/updated>/i)?.[1]?.trim() ?? '';
    const source = block.match(/<source-url>([\s\S]*?)<\/source-url>/i)?.[1]?.trim();

    const tags: string[] = [];
    const tagMatches = block.matchAll(/<tag>([\s\S]*?)<\/tag>/gi);
    for (const m of tagMatches) tags.push(m[1].trim());

    // Extract content from CDATA
    let content = contentXml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

    // Convert ENML to markdown
    content = enmlToMarkdown(content);

    notes.push({ title, content, created, updated, tags, source });
  }

  return notes;
}

function enmlToMarkdown(enml: string): string {
  let md = enml;

  // Remove en-note wrapper
  md = md.replace(/<\/?en-note[^>]*>/gi, '');

  // Convert common HTML
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
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<\/?[ou]l[^>]*>/gi, '\n');
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n');
  md = md.replace(/<en-todo\s+checked="true"\s*\/?>/gi, '☑ ');
  md = md.replace(/<en-todo\s+checked="false"\s*\/?>/gi, '☐ ');
  md = md.replace(/<en-todo\s*\/?>/gi, '☐ ');

  // Strip remaining tags
  md = md.replace(/<[^>]+>/g, '');
  md = md.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
  md = md.replace(/\n{3,}/g, '\n\n');

  return md.trim();
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'untitled';
}

// ── Main Import ───────────────────────────────────────────────────

export async function importEvernote(options: EvernoteImportOptions): Promise<ImportedPage[]> {
  const { dir, recursive = true, onProgress } = options;
  const pages: ImportedPage[] = [];
  const files = await collectFiles(dir, recursive, ['.enex']);
  let current = 0;

  for (const filePath of files) {
    current++;
    const relPath = relative(dir, filePath);
    onProgress?.(current, files.length, relPath);

    const raw = await readFile(filePath, 'utf-8');
    const notes = parseEnex(raw);

    for (const note of notes) {
      pages.push({
        slug: toSlug(note.title),
        title: note.title,
        body: note.content,
        tags: note.tags,
        metadata: {
          source_platform: 'evernote',
          ...(note.created ? { created_at: note.created } : {}),
          ...(note.updated ? { updated_at: note.updated } : {}),
          ...(note.source ? { source_url: note.source } : {}),
        },
        source: relPath,
      });
    }
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
