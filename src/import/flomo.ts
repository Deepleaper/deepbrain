/**
 * DeepBrain — Flomo Importer
 *
 * Import from Flomo export (HTML or Markdown).
 * Flomo exports a single HTML file containing all memos.
 */

import { readFile } from 'fs/promises';
import { basename } from 'path';
import type { ImportedPage } from './yuque.js';

export interface FlomoImportOptions {
  file: string;
  onProgress?: (current: number, total: number, title: string) => void;
}

function parseFlomoHtml(html: string): Array<{ body: string; tags: string[]; time: string }> {
  const memos: Array<{ body: string; tags: string[]; time: string }> = [];

  // Flomo exports memos in .memo divs
  const memoBlocks = html.match(/<div class="memo">([\s\S]*?)<\/div>\s*(?=<div class="memo"|<\/div>\s*$)/gi)
    ?? html.match(/<div class="content">([\s\S]*?)<\/div>/gi) ?? [];

  if (memoBlocks.length === 0) {
    // Fallback: split by time markers
    const parts = html.split(/<div class="time">/i).filter(Boolean);
    for (const part of parts) {
      const timeMatch = part.match(/^([^<]+)</);
      const contentMatch = part.match(/<div class="content">([\s\S]*?)<\/div>/i);
      if (contentMatch) {
        const body = htmlToMd(contentMatch[1]);
        memos.push({
          body,
          tags: extractFlomoTags(body),
          time: timeMatch?.[1]?.trim() ?? '',
        });
      }
    }
    return memos;
  }

  for (const block of memoBlocks) {
    const timeMatch = block.match(/<div class="time">\s*([^<]+)/i);
    const contentMatch = block.match(/<div class="content">([\s\S]*?)<\/div>/i);

    const body = contentMatch ? htmlToMd(contentMatch[1]) : htmlToMd(block);
    memos.push({
      body,
      tags: extractFlomoTags(body),
      time: timeMatch?.[1]?.trim() ?? '',
    });
  }

  return memos;
}

function htmlToMd(html: string): string {
  let md = html;
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<\/?[ou]l[^>]*>/gi, '\n');
  md = md.replace(/<[^>]+>/g, '');
  md = md.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

function extractFlomoTags(text: string): string[] {
  const tags = new Set<string>();
  // Flomo uses #tag and #tag/subtag
  const matches = text.matchAll(/#([\w\u4e00-\u9fff\u3400-\u4dbf/]+)/g);
  for (const m of matches) tags.add(m[1]);
  return [...tags];
}

function toSlug(text: string, index: number): string {
  const preview = text.slice(0, 30).toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '').replace(/-+/g, '-') || `memo-${index}`;
  return preview;
}

export async function importFlomo(options: FlomoImportOptions): Promise<ImportedPage[]> {
  const { file, onProgress } = options;
  const raw = await readFile(file, 'utf-8');
  const pages: ImportedPage[] = [];

  const ext = file.toLowerCase();

  if (ext.endsWith('.html') || ext.endsWith('.htm')) {
    const memos = parseFlomoHtml(raw);
    for (let i = 0; i < memos.length; i++) {
      const memo = memos[i];
      onProgress?.(i + 1, memos.length, `memo ${i + 1}`);

      // Use first line as title
      const firstLine = memo.body.split('\n')[0]?.slice(0, 60) ?? `Memo ${i + 1}`;

      pages.push({
        slug: toSlug(memo.body, i),
        title: firstLine,
        body: memo.body,
        tags: memo.tags,
        metadata: {
          source_platform: 'flomo',
          ...(memo.time ? { created_at: memo.time } : {}),
        },
        source: basename(file),
      });
    }
  } else {
    // Markdown: split by --- or ## separators
    const sections = raw.split(/^---$/m).filter(s => s.trim());
    for (let i = 0; i < sections.length; i++) {
      const body = sections[i].trim();
      if (!body) continue;
      onProgress?.(i + 1, sections.length, `memo ${i + 1}`);

      const firstLine = body.split('\n')[0]?.slice(0, 60) ?? `Memo ${i + 1}`;
      pages.push({
        slug: toSlug(body, i),
        title: firstLine,
        body,
        tags: extractFlomoTags(body),
        metadata: { source_platform: 'flomo' },
        source: basename(file),
      });
    }
  }

  return pages;
}
