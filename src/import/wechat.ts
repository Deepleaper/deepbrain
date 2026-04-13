/**
 * DeepBrain — WeChat Article (微信公众号) Importer
 *
 * Import WeChat articles from saved HTML or extracted text.
 * Supports: .html files (saved from browser), .md files, .txt files.
 *
 * Usage:
 *   import { importWechat } from 'deepbrain/import';
 *   const pages = await importWechat({ dir: '/path/to/wechat-articles/' });
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname, basename, relative } from 'path';
import type { ImportedPage } from './yuque.js';

// ── Types ──────────────────────────────────────────────────────────

export interface WechatImportOptions {
  dir: string;
  recursive?: boolean;
  onProgress?: (current: number, total: number, file: string) => void;
}

// ── WeChat HTML Cleanup ───────────────────────────────────────────

function cleanWechatHtml(html: string): string {
  let content = html;

  // Remove WeChat-specific wrappers
  content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[\s\S]*?<\/style>/gi, '');

  // Extract article body (js_content is WeChat's article container)
  const bodyMatch = content.match(/id="js_content"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
  if (bodyMatch) content = bodyMatch[1];

  // Convert to markdown
  content = content.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
  content = content.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
  content = content.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
  content = content.replace(/<section[^>]*>([\s\S]*?)<\/section>/gi, '$1\n');
  content = content.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  content = content.replace(/<br\s*\/?>/gi, '\n');
  content = content.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  content = content.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  content = content.replace(/<img[^>]*data-src="([^"]*)"[^>]*\/?>/gi, '![]($1)');
  content = content.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');
  content = content.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  content = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  content = content.replace(/<\/?[ou]l[^>]*>/gi, '\n');
  content = content.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n');

  // Strip all remaining tags
  content = content.replace(/<[^>]+>/g, '');

  // Decode entities
  content = content.replace(/&amp;/g, '&');
  content = content.replace(/&lt;/g, '<');
  content = content.replace(/&gt;/g, '>');
  content = content.replace(/&quot;/g, '"');
  content = content.replace(/&#39;/g, "'");
  content = content.replace(/&nbsp;/g, ' ');

  // Clean up
  content = content.replace(/\n{3,}/g, '\n\n');
  return content.trim();
}

// ── Extract WeChat Metadata ───────────────────────────────────────

function extractWechatMeta(html: string): Record<string, string> {
  const meta: Record<string, string> = { source_platform: 'wechat' };

  // Author
  const authorMatch = html.match(/var\s+(?:nickname|author)\s*=\s*["']([^"']+)["']/);
  if (authorMatch) meta.author = authorMatch[1];

  // Meta tag author
  const metaAuthor = html.match(/<meta[^>]*name="author"[^>]*content="([^"]*)"[^>]*>/i);
  if (metaAuthor) meta.author = metaAuthor[1];

  // Publish time
  const timeMatch = html.match(/var\s+(?:publish_time|ct)\s*=\s*["']([^"']+)["']/);
  if (timeMatch) meta.published_at = timeMatch[1];

  // Account name
  const accountMatch = html.match(/var\s+(?:user_name|fakeid)\s*=\s*["']([^"']+)["']/);
  if (accountMatch) meta.account = accountMatch[1];

  return meta;
}

// ── Extract Title ─────────────────────────────────────────────────

function extractTitle(content: string, filename: string): string {
  // WeChat title from meta
  const metaTitle = content.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i);
  if (metaTitle) return metaTitle[1];

  // H1
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();

  // HTML title
  const titleTag = content.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleTag) return titleTag[1].trim();

  return basename(filename, extname(filename));
}

function toSlug(filename: string, prefix?: string): string {
  const base = basename(filename, extname(filename))
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\u4e00-\u9fff\u3400-\u4dbf-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return prefix ? `${prefix}/${base}` : base;
}

function extractTags(md: string): string[] {
  const tags: string[] = [];
  const inlineTags = md.match(/(^|\s)#([\w\u4e00-\u9fff\u3400-\u4dbf]+)/g);
  if (inlineTags) tags.push(...inlineTags.map(t => t.trim().replace(/^#/, '')));
  return [...new Set(tags)];
}

// ── Main Import ───────────────────────────────────────────────────

export async function importWechat(options: WechatImportOptions): Promise<ImportedPage[]> {
  const { dir, recursive = true, onProgress } = options;
  const pages: ImportedPage[] = [];
  const files = await collectFiles(dir, recursive);
  let current = 0;

  for (const filePath of files) {
    current++;
    const ext = extname(filePath).toLowerCase();
    const relPath = relative(dir, filePath);
    const prefix = relPath.includes('/') || relPath.includes('\\')
      ? relPath.split(/[/\\]/).slice(0, -1).join('/').toLowerCase()
      : undefined;

    onProgress?.(current, files.length, relPath);

    const raw = await readFile(filePath, 'utf-8');
    let body: string;
    let meta: Record<string, string> = { source_platform: 'wechat' };

    if (ext === '.html' || ext === '.htm') {
      body = cleanWechatHtml(raw);
      meta = extractWechatMeta(raw);
    } else {
      body = raw.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
    }

    pages.push({
      slug: toSlug(basename(filePath), prefix),
      title: extractTitle(raw, filePath),
      body,
      tags: extractTags(body),
      metadata: meta,
      source: relPath,
    });
  }

  return pages;
}

// ── File Collection ───────────────────────────────────────────────

async function collectFiles(dir: string, recursive: boolean): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && recursive) {
      results.push(...await collectFiles(fullPath, true));
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (['.md', '.markdown', '.html', '.htm', '.txt'].includes(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}
