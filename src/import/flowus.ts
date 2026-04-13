/**
 * DeepBrain — FlowUs (息流) Importer
 *
 * Import from FlowUs export (Markdown or HTML files).
 * Similar to Notion-style export.
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname, basename, relative } from 'path';
import type { ImportedPage } from './yuque.js';

export interface FlowUsImportOptions {
  dir: string;
  recursive?: boolean;
  onProgress?: (current: number, total: number, file: string) => void;
}

function cleanFlowUs(content: string, isHtml: boolean): string {
  if (!isHtml) {
    // Markdown cleanup
    let md = content;
    // Remove FlowUs-specific UUID suffixes in filenames
    md = md.replace(/\s+[a-f0-9]{32}(?=\.\w+)/g, '');
    // Clean callout blocks
    md = md.replace(/^> \[!(\w+)\]\s*/gm, '> **$1:** ');
    return md.trim();
  }

  let md = content;
  md = md.replace(/<script[\s\S]*?<\/script>/gi, '');
  md = md.replace(/<style[\s\S]*?<\/style>/gi, '');
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
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

function extractTags(md: string): string[] {
  const tags = new Set<string>();
  const matches = md.matchAll(/(^|\s)#([\w\u4e00-\u9fff\u3400-\u4dbf]+)/g);
  for (const m of matches) tags.add(m[2]);
  return [...tags];
}

function extractTitle(content: string, filename: string): string {
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  const titleTag = content.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleTag) return titleTag[1].trim();
  return basename(filename, extname(filename)).replace(/ [a-f0-9]{32}$/, '');
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/ [a-f0-9]{32}$/, '').replace(/[\s_]+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'untitled';
}

export async function importFlowUs(options: FlowUsImportOptions): Promise<ImportedPage[]> {
  const { dir, recursive = true, onProgress } = options;
  const pages: ImportedPage[] = [];
  const files = await collectFiles(dir, recursive);

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const relPath = relative(dir, filePath);
    const ext = extname(filePath).toLowerCase();
    onProgress?.(i + 1, files.length, relPath);

    const raw = await readFile(filePath, 'utf-8');
    const isHtml = ['.html', '.htm'].includes(ext);
    const body = cleanFlowUs(raw, isHtml);

    pages.push({
      slug: toSlug(basename(filePath, ext)),
      title: extractTitle(isHtml ? body : raw, filePath),
      body,
      tags: extractTags(body),
      metadata: { source_platform: 'flowus' },
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
    else if (entry.isFile() && ['.md', '.markdown', '.html', '.htm'].includes(extname(entry.name).toLowerCase())) results.push(fullPath);
  }
  return results;
}
