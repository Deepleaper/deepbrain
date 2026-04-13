/**
 * DeepBrain — Roam Research Importer
 *
 * Import from Roam Research JSON export.
 * Supports: .json files (Roam Export → JSON format).
 */

import { readFile } from 'fs/promises';
import type { ImportedPage } from './yuque.js';

export interface RoamImportOptions {
  file: string;
  onProgress?: (current: number, total: number, title: string) => void;
}

interface RoamPage {
  title: string;
  uid: string;
  children?: RoamBlock[];
  'create-time'?: number;
  'edit-time'?: number;
}

interface RoamBlock {
  string?: string;
  uid?: string;
  children?: RoamBlock[];
  heading?: number;
  'text-align'?: string;
}

function blocksToMarkdown(blocks: RoamBlock[], depth = 0): string {
  if (!blocks?.length) return '';
  const lines: string[] = [];

  for (const block of blocks) {
    const text = block.string ?? '';
    if (block.heading) {
      lines.push('#'.repeat(block.heading) + ' ' + convertRoamSyntax(text));
    } else {
      const indent = '  '.repeat(depth);
      lines.push(`${indent}- ${convertRoamSyntax(text)}`);
    }
    if (block.children?.length) {
      lines.push(blocksToMarkdown(block.children, depth + 1));
    }
  }

  return lines.join('\n');
}

function convertRoamSyntax(text: string): string {
  let md = text;
  // [[page ref]] → page ref
  md = md.replace(/\[\[([^\]]+)\]\]/g, '$1');
  // ((block ref)) → block ref
  md = md.replace(/\(\(([^)]+)\)\)/g, '$1');
  // **bold** already markdown
  // __italic__ → *italic*
  md = md.replace(/__([^_]+)__/g, '*$1*');
  // ^^highlight^^ → ==highlight==
  md = md.replace(/\^\^([^^]+)\^\^/g, '==$1==');
  // {{TODO}} / {{DONE}}
  md = md.replace(/\{\{TODO\}\}/g, '☐');
  md = md.replace(/\{\{\[\[TODO\]\]\}\}/g, '☐');
  md = md.replace(/\{\{DONE\}\}/g, '☑');
  md = md.replace(/\{\{\[\[DONE\]\]\}\}/g, '☑');
  return md;
}

function extractTags(text: string): string[] {
  const tags = new Set<string>();
  // [[page refs]]
  const refs = text.matchAll(/\[\[([^\]]+)\]\]/g);
  for (const m of refs) tags.add(m[1]);
  // #tags and #[[tags]]
  const hashTags = text.matchAll(/#(?:\[\[([^\]]+)\]\]|([\w\u4e00-\u9fff]+))/g);
  for (const m of hashTags) tags.add(m[1] ?? m[2]);
  return [...tags];
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'untitled';
}

export async function importRoam(options: RoamImportOptions): Promise<ImportedPage[]> {
  const { file, onProgress } = options;
  const raw = await readFile(file, 'utf-8');
  const data: RoamPage[] = JSON.parse(raw);
  const pages: ImportedPage[] = [];

  for (let i = 0; i < data.length; i++) {
    const page = data[i];
    onProgress?.(i + 1, data.length, page.title);

    const body = blocksToMarkdown(page.children ?? []);
    const rawText = (page.children ?? []).map(b => b.string ?? '').join(' ');

    pages.push({
      slug: toSlug(page.title),
      title: page.title,
      body: `# ${page.title}\n\n${body}`,
      tags: extractTags(rawText),
      metadata: {
        source_platform: 'roam',
        uid: page.uid,
        ...(page['create-time'] ? { created_at: new Date(page['create-time']).toISOString() } : {}),
        ...(page['edit-time'] ? { updated_at: new Date(page['edit-time']).toISOString() } : {}),
      },
      source: file,
    });
  }

  return pages;
}
