/**
 * DeepBrain — Obsidian Importer
 *
 * Import pages from an Obsidian vault.
 * Supports: Markdown files, [[wikilinks]], tags (#tag), YAML frontmatter.
 *
 * Usage:
 *   deepbrain import obsidian ~/my-vault/
 *
 * Programmatic:
 *   import { importObsidian } from 'deepbrain/import';
 *   const result = await importObsidian(brain, '~/my-vault/');
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename, extname, relative } from 'node:path';
import type { Brain } from '../core/brain.js';
import type { ImportResult, ImportOptions } from './notion.js';

export interface ObsidianImportOptions extends ImportOptions {
  /** Convert [[wikilinks]] to page links in DeepBrain (default: true) */
  convertLinks?: boolean;
  /** Import inline #tags (default: true) */
  importTags?: boolean;
  /** Ignore folders (default: ['.obsidian', '.trash', 'node_modules']) */
  ignoreFolders?: string[];
}

/**
 * Import from an Obsidian vault directory.
 */
export async function importObsidian(
  brain: Brain,
  vaultPath: string,
  opts: ObsidianImportOptions = {},
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [], pages: [] };

  if (!existsSync(vaultPath)) {
    throw new Error(`Vault not found: ${vaultPath}`);
  }

  const stat = statSync(vaultPath);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${vaultPath}`);
  }

  const ignoreFolders = opts.ignoreFolders ?? ['.obsidian', '.trash', 'node_modules', '.git'];
  const convertLinks = opts.convertLinks !== false;
  const importTags = opts.importTags !== false;

  const files: string[] = [];
  collectMdFiles(vaultPath, files, ignoreFolders);

  const total = files.length;

  // First pass: collect all slugs for link resolution
  const slugMap = new Map<string, string>(); // filename → slug
  for (const file of files) {
    const name = basename(file, extname(file));
    const slug = makeSlug(file, vaultPath, opts.prefix);
    slugMap.set(name, slug);
    slugMap.set(name.toLowerCase(), slug);
  }

  // Second pass: import
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    opts.onProgress?.(i + 1, total, file);

    try {
      const content = readFileSync(file, 'utf8');
      if (content.trim().length < 10) { result.skipped++; continue; }

      const { title, body, metadata, inlineTags } = parseObsidianMarkdown(content);
      const slug = makeSlug(file, vaultPath, opts.prefix);

      // Extract wikilinks
      const wikilinks: string[] = [];
      if (convertLinks) {
        const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
        let match;
        while ((match = linkRegex.exec(body)) !== null) {
          wikilinks.push(match[1].trim());
        }
      }

      // Clean body: convert [[wikilinks]] to plain text
      const cleanBody = body.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target, alias) => {
        return alias ?? target;
      });

      if (opts.dryRun) {
        result.pages.push(slug);
        result.imported++;
        continue;
      }

      await brain.put(slug, {
        type: opts.type ?? metadata.type ?? 'note',
        title: title || basename(file, extname(file)),
        compiled_truth: cleanBody,
      });

      // Import tags
      const allTags = [...(metadata.tags ?? []), ...(importTags ? inlineTags : [])];
      const uniqueTags = [...new Set(allTags)];
      for (const tag of uniqueTags) {
        await brain.tag(slug, tag);
      }

      // Create links from [[wikilinks]]
      if (convertLinks) {
        for (const target of wikilinks) {
          const targetSlug = slugMap.get(target) ?? slugMap.get(target.toLowerCase());
          if (targetSlug && targetSlug !== slug) {
            await brain.link(slug, targetSlug, 'obsidian wikilink', 'reference');
          }
        }
      }

      result.pages.push(slug);
      result.imported++;
    } catch (e: any) {
      result.errors.push({ file, error: e.message });
    }
  }

  return result;
}

// ── Helpers ──────────────────────────────────────────────────────

function collectMdFiles(dir: string, out: string[], ignore: string[]): void {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (ignore.includes(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectMdFiles(full, out, ignore);
    } else if (/\.(md|markdown)$/i.test(entry.name)) {
      out.push(full);
    }
  }
}

function parseObsidianMarkdown(content: string): {
  title: string;
  body: string;
  metadata: Record<string, any>;
  inlineTags: string[];
} {
  let title = '';
  let body = content;
  const metadata: Record<string, any> = {};

  // Parse YAML frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (fmMatch) {
    const fm = fmMatch[1];
    body = fmMatch[2];
    for (const line of fm.split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      if (key === 'tags') {
        metadata.tags = val.replace(/[\[\]]/g, '').split(',').map(t => t.trim()).filter(Boolean);
      } else if (key === 'type') {
        metadata.type = val;
      } else if (key === 'title' || key === 'aliases') {
        if (!title) title = val.replace(/[\[\]]/g, '').split(',')[0]?.trim() ?? '';
      }
    }
  }

  // Extract title from first H1
  if (!title) {
    const h1Match = body.match(/^#\s+(.+)/m);
    if (h1Match) title = h1Match[1].trim();
  }

  // Extract inline #tags (not in code blocks)
  const inlineTags: string[] = [];
  const tagRegex = /(?:^|\s)#([a-zA-Z\u4e00-\u9fff][\w\u4e00-\u9fff/-]*)/g;
  let match;
  while ((match = tagRegex.exec(body)) !== null) {
    inlineTags.push(match[1]);
  }

  return { title, body: body.trim(), metadata, inlineTags: [...new Set(inlineTags)] };
}

function makeSlug(file: string, basePath: string, prefix?: string): string {
  const rel = relative(basePath, file);
  const raw = rel
    .replace(/\\/g, '/')
    .replace(/\.[^.]+$/, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
  return (prefix ?? '') + slugify(raw);
}

function slugify(text: string): string {
  return text
    .replace(/[^\w\u4e00-\u9fff\-/]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}
