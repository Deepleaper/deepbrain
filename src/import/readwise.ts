/**
 * DeepBrain — Readwise Importer
 *
 * Import from Readwise export (CSV or JSON).
 * Supports: highlights, books, articles from Readwise export.
 */

import { readFile } from 'fs/promises';
import type { ImportedPage } from './yuque.js';

export interface ReadwiseImportOptions {
  file: string;
  onProgress?: (current: number, total: number, title: string) => void;
}

interface ReadwiseHighlight {
  text: string;
  title?: string;
  author?: string;
  source_type?: string;
  category?: string;
  note?: string;
  location?: string;
  highlighted_at?: string;
  url?: string;
  tags?: string[];
  book_id?: number;
}

function parseCsv(csv: string): ReadwiseHighlight[] {
  const lines = csv.split('\n');
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const results: ReadwiseHighlight[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCsvLine(lines[i]);
    const obj: any = {};
    headers.forEach((h, idx) => {
      const key = h.toLowerCase().replace(/\s+/g, '_');
      obj[key] = values[idx] ?? '';
    });

    results.push({
      text: obj.highlight ?? obj.text ?? '',
      title: obj.title ?? obj.book_title ?? '',
      author: obj.author ?? obj.book_author ?? '',
      source_type: obj.source_type ?? obj.category ?? '',
      note: obj.note ?? '',
      location: obj.location ?? '',
      highlighted_at: obj.highlighted_at ?? obj.date ?? '',
      url: obj.url ?? obj.source_url ?? '',
    });
  }

  return results;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'untitled';
}

export async function importReadwise(options: ReadwiseImportOptions): Promise<ImportedPage[]> {
  const { file, onProgress } = options;
  const raw = await readFile(file, 'utf-8');
  const ext = file.toLowerCase();

  let highlights: ReadwiseHighlight[];

  if (ext.endsWith('.json')) {
    const data = JSON.parse(raw);
    highlights = Array.isArray(data) ? data : (data.results ?? data.highlights ?? []);
  } else {
    highlights = parseCsv(raw);
  }

  // Group highlights by book/source title
  const byTitle = new Map<string, ReadwiseHighlight[]>();
  for (const h of highlights) {
    const key = h.title || 'Uncategorized';
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key)!.push(h);
  }

  const pages: ImportedPage[] = [];
  const titles = [...byTitle.keys()];

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    const items = byTitle.get(title)!;
    onProgress?.(i + 1, titles.length, title);

    const body = items.map(h => {
      let block = `> ${h.text}`;
      if (h.note) block += `\n\n**Note:** ${h.note}`;
      if (h.location) block += ` *(${h.location})*`;
      return block;
    }).join('\n\n---\n\n');

    const first = items[0];
    const tags: string[] = [];
    if (first.source_type) tags.push(first.source_type);
    if (first.author) tags.push(first.author);

    pages.push({
      slug: toSlug(title),
      title: `${title}${first.author ? ` — ${first.author}` : ''}`,
      body: `# ${title}\n\n${body}`,
      tags,
      metadata: {
        source_platform: 'readwise',
        highlights_count: String(items.length),
        ...(first.author ? { author: first.author } : {}),
        ...(first.url ? { source_url: first.url } : {}),
        ...(first.source_type ? { source_type: first.source_type } : {}),
      },
      source: file,
    });
  }

  return pages;
}
