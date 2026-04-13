/**
 * DeepBrain — SiYuan (思源笔记) Importer
 *
 * Import from SiYuan export (.sy JSON files or Markdown).
 * SiYuan uses a block-based structure stored as JSON.
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname, basename, relative } from 'path';
import type { ImportedPage } from './yuque.js';

export interface SiyuanImportOptions {
  dir: string;
  recursive?: boolean;
  onProgress?: (current: number, total: number, file: string) => void;
}

interface SiyuanBlock {
  ID?: string;
  Type?: string;
  Content?: string;
  Children?: SiyuanBlock[];
  Properties?: Record<string, string>;
  Data?: string;
  Markdown?: string;
}

function siyuanToMarkdown(blocks: SiyuanBlock | SiyuanBlock[]): string {
  const arr = Array.isArray(blocks) ? blocks : [blocks];
  const lines: string[] = [];

  for (const block of arr) {
    const md = block.Markdown ?? block.Content ?? block.Data ?? '';

    switch (block.Type) {
      case 'NodeHeading':
        const level = parseInt(block.Properties?.['heading-level'] ?? '2');
        lines.push('#'.repeat(level) + ' ' + md);
        break;
      case 'NodeParagraph':
        lines.push(md + '\n');
        break;
      case 'NodeList':
      case 'NodeListItem':
        lines.push(md);
        break;
      case 'NodeCodeBlock':
        const lang = block.Properties?.['code-language'] ?? '';
        lines.push(`\`\`\`${lang}\n${md}\n\`\`\``);
        break;
      case 'NodeBlockquote':
        lines.push(md.split('\n').map(l => `> ${l}`).join('\n'));
        break;
      case 'NodeTable':
        lines.push(md);
        break;
      case 'NodeThematicBreak':
        lines.push('---');
        break;
      default:
        if (md) lines.push(md);
    }

    if (block.Children?.length) {
      lines.push(siyuanToMarkdown(block.Children));
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function extractTags(md: string): string[] {
  const tags = new Set<string>();
  const matches = md.matchAll(/(^|\s)#([\w\u4e00-\u9fff\u3400-\u4dbf]+)#?/g);
  for (const m of matches) tags.add(m[2]);
  return [...tags];
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'untitled';
}

export async function importSiyuan(options: SiyuanImportOptions): Promise<ImportedPage[]> {
  const { dir, recursive = true, onProgress } = options;
  const pages: ImportedPage[] = [];
  const files = await collectFiles(dir, recursive);

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const relPath = relative(dir, filePath);
    const ext = extname(filePath).toLowerCase();
    onProgress?.(i + 1, files.length, relPath);

    const raw = await readFile(filePath, 'utf-8');
    let body: string;
    let title: string;
    let meta: Record<string, string> = { source_platform: 'siyuan' };

    if (ext === '.sy') {
      try {
        const data = JSON.parse(raw);
        body = siyuanToMarkdown(data);
        title = data.Properties?.title ?? data.Content ?? basename(filePath, ext);
        if (data.ID) meta.siyuan_id = data.ID;
      } catch {
        body = raw;
        title = basename(filePath, ext);
      }
    } else {
      body = raw.trim();
      const h1 = body.match(/^#\s+(.+)$/m);
      title = h1?.[1]?.trim() ?? basename(filePath, ext);
    }

    pages.push({
      slug: toSlug(title),
      title,
      body,
      tags: extractTags(body),
      metadata: meta,
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
    else if (entry.isFile() && ['.md', '.sy', '.markdown'].includes(extname(entry.name).toLowerCase())) results.push(fullPath);
  }
  return results;
}
