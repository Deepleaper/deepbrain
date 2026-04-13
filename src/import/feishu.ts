/**
 * DeepBrain — Feishu (飞书) Document Importer
 *
 * Import from Feishu/Lark Markdown export or Docx export.
 * Supports: .md, .docx (text extraction), nested directories.
 *
 * Usage:
 *   import { importFeishu } from 'deepbrain/import';
 *   const pages = await importFeishu({ dir: '/path/to/feishu-export/' });
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname, basename, relative } from 'path';
import type { ImportedPage } from './yuque.js';

// ── Types ──────────────────────────────────────────────────────────

export interface FeishuImportOptions {
  dir: string;
  recursive?: boolean;
  onProgress?: (current: number, total: number, file: string) => void;
}

// ── Feishu Markdown Cleanup ───────────────────────────────────────

function cleanFeishuMarkdown(md: string): string {
  let cleaned = md;

  // Remove Feishu-specific comment blocks
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // Convert Feishu @mentions to plain text
  cleaned = cleaned.replace(/@\[([^\]]+)\]\([^)]*\)/g, '@$1');

  // Convert Feishu checkbox syntax
  cleaned = cleaned.replace(/\[x\]/gi, '☑');
  cleaned = cleaned.replace(/\[\s?\]/g, '☐');

  // Clean Feishu table alignment markers
  cleaned = cleaned.replace(/\|[\s:|-]+\|/g, (match) => match);

  // Remove empty lines at start
  cleaned = cleaned.replace(/^\n+/, '');

  return cleaned.trim();
}

// ── Extract Title ─────────────────────────────────────────────────

function extractTitle(md: string, filename: string): string {
  const h1Match = md.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  return basename(filename, extname(filename));
}

// ── Extract Tags ──────────────────────────────────────────────────

function extractTags(md: string): string[] {
  const tags: string[] = [];

  // Feishu uses #tag format
  const inlineTags = md.match(/(^|\s)#([\w\u4e00-\u9fff\u3400-\u4dbf]+)/g);
  if (inlineTags) {
    tags.push(...inlineTags.map(t => t.trim().replace(/^#/, '')));
  }

  return [...new Set(tags)];
}

// ── Slug ──────────────────────────────────────────────────────────

function toSlug(filename: string, prefix?: string): string {
  const base = basename(filename, extname(filename))
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\u4e00-\u9fff\u3400-\u4dbf-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return prefix ? `${prefix}/${base}` : base;
}

// ── Frontmatter ───────────────────────────────────────────────────

function stripFrontmatter(md: string): string {
  return md.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
}

function extractMetadata(md: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const fmMatch = md.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return meta;
  for (const line of fmMatch[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)/);
    if (kv && kv[1] !== 'tags') meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return meta;
}

// ── DOCX Text Extraction (lightweight, no dep) ───────────────────

async function extractDocxText(filePath: string): Promise<string> {
  // Docx is a ZIP of XML files. We extract text from word/document.xml
  // Using a minimal approach without external deps
  try {
    const { execSync } = await import('child_process');
    // Try PowerShell extraction on Windows
    const cmd = `powershell -Command "
      Add-Type -AssemblyName System.IO.Compression.FileSystem;
      $zip = [System.IO.Compression.ZipFile]::OpenRead('${filePath.replace(/'/g, "''")}');
      $entry = $zip.Entries | Where-Object { $_.FullName -eq 'word/document.xml' };
      if ($entry) {
        $reader = New-Object System.IO.StreamReader($entry.Open());
        $xml = $reader.ReadToEnd();
        $reader.Close();
        # Strip XML tags, keep text
        $xml -replace '<[^>]+>', ' ' -replace '\\s+', ' '
      }
      $zip.Dispose()
    "`;
    return execSync(cmd, { encoding: 'utf-8', timeout: 10000 }).trim();
  } catch {
    return `[DOCX extraction failed for ${basename(filePath)}]`;
  }
}

// ── Main Import ───────────────────────────────────────────────────

export async function importFeishu(options: FeishuImportOptions): Promise<ImportedPage[]> {
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

    let content: string;
    if (ext === '.md' || ext === '.markdown') {
      const raw = await readFile(filePath, 'utf-8');
      content = cleanFeishuMarkdown(raw);
    } else if (ext === '.docx') {
      content = await extractDocxText(filePath);
    } else {
      continue;
    }

    const body = stripFrontmatter(content);
    pages.push({
      slug: toSlug(basename(filePath), prefix),
      title: extractTitle(content, filePath),
      body,
      tags: extractTags(content),
      metadata: { ...extractMetadata(content), source_platform: 'feishu' },
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
      if (['.md', '.markdown', '.docx'].includes(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}
