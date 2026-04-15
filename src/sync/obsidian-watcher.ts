/**
 * DeepBrain — Obsidian Vault Live Watcher
 *
 * Watch a local Obsidian vault directory for changes and auto-import.
 * Uses fs.watch for cross-platform file watching.
 *
 * CLI: deepbrain watch <vault-path>
 */

import { watch, readFileSync, statSync, existsSync } from 'node:fs';
import { join, basename, extname, relative } from 'node:path';
import type { Brain } from '../core/brain.js';

export interface WatcherOptions {
  /** Slug prefix (default: 'obsidian/') */
  prefix?: string;
  /** Debounce interval in ms (default: 1000) */
  debounceMs?: number;
  /** Folders to ignore */
  ignoreFolders?: string[];
  /** Callback on file import */
  onImport?: (file: string, slug: string) => void;
  /** Callback on error */
  onError?: (file: string, error: string) => void;
}

export interface ObsidianWatcher {
  /** Stop watching */
  stop(): void;
  /** Number of files imported */
  importCount: number;
}

/**
 * Watch an Obsidian vault and auto-import changes.
 */
export function watchObsidianVault(
  brain: Brain,
  vaultPath: string,
  opts: WatcherOptions = {},
): ObsidianWatcher {
  const prefix = opts.prefix ?? 'obsidian/';
  const debounceMs = opts.debounceMs ?? 1000;
  const ignoreFolders = opts.ignoreFolders ?? ['.obsidian', '.trash', 'node_modules', '.git'];

  if (!existsSync(vaultPath) || !statSync(vaultPath).isDirectory()) {
    throw new Error(`Not a valid directory: ${vaultPath}`);
  }

  let importCount = 0;
  const pending = new Map<string, NodeJS.Timeout>();

  const ac = new AbortController();

  // Watch recursively
  const watcher = watch(vaultPath, { recursive: true, signal: ac.signal }, (eventType, filename) => {
    if (!filename) return;

    // Only process .md files
    if (!/\.(md|markdown)$/i.test(filename)) return;

    // Ignore hidden/system folders
    const parts = filename.replace(/\\/g, '/').split('/');
    if (parts.some(p => ignoreFolders.includes(p))) return;

    const fullPath = join(vaultPath, filename);

    // Debounce: wait for file to settle
    const existing = pending.get(fullPath);
    if (existing) clearTimeout(existing);

    pending.set(fullPath, setTimeout(async () => {
      pending.delete(fullPath);
      try {
        if (!existsSync(fullPath)) return; // File was deleted

        const content = readFileSync(fullPath, 'utf8');
        if (content.trim().length < 10) return;

        const { title, body, tags } = parseMarkdown(content);
        const slug = makeSlug(fullPath, vaultPath, prefix);

        await brain.put(slug, {
          type: 'note',
          title: title || basename(fullPath, extname(fullPath)),
          compiled_truth: body,
          frontmatter: { source: 'obsidian-watcher', watched_at: new Date().toISOString() },
        });

        for (const tag of tags) {
          await brain.tag(slug, tag);
        }

        importCount++;
        opts.onImport?.(filename, slug);
      } catch (e: any) {
        opts.onError?.(filename, e.message);
      }
    }, debounceMs));
  });

  return {
    stop() {
      ac.abort();
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    },
    get importCount() { return importCount; },
  };
}

// ── Helpers ──────────────────────────────────────────────────────

function parseMarkdown(content: string): { title: string; body: string; tags: string[] } {
  let title = '';
  let body = content;
  const tags: string[] = [];

  // YAML frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (fmMatch) {
    const fm = fmMatch[1];
    body = fmMatch[2];
    for (const line of fm.split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      if (key === 'title') title = val;
      if (key === 'tags') {
        tags.push(...val.replace(/[\[\]]/g, '').split(',').map(t => t.trim()).filter(Boolean));
      }
    }
  }

  if (!title) {
    const h1 = body.match(/^#\s+(.+)/m);
    if (h1) title = h1[1].trim();
  }

  // Inline #tags
  const tagRegex = /(?:^|\s)#([a-zA-Z\u4e00-\u9fff][\w\u4e00-\u9fff/-]*)/g;
  let m;
  while ((m = tagRegex.exec(body)) !== null) tags.push(m[1]);

  // Clean wikilinks
  body = body.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target, alias) => alias ?? target);

  return { title, body: body.trim(), tags: [...new Set(tags)] };
}

function makeSlug(file: string, basePath: string, prefix: string): string {
  const rel = relative(basePath, file)
    .replace(/\\/g, '/')
    .replace(/\.[^.]+$/, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
  return prefix + rel.replace(/[^\w\u4e00-\u9fff\-/]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
