/**
 * DeepBrain - Collaborative Brains
 *
 * Share brain via read-only web UI, export as static site.
 *
 * CLI:
 *   deepbrain share --port 8080
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Brain } from './core/brain.js';
import type { Page } from './core/types.js';

export interface CollabServeOptions {
  /** Port to serve on (default: 8080) */
  port?: number;
  /** Host to bind (default: 0.0.0.0) */
  host?: string;
  /** Brain config (partial) */
  brainConfig?: Record<string, unknown>;
  /** Optional title override */
  title?: string;
  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface CollabExportResult {
  pages: number;
  outputDir: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderPage(page: Page, brainTitle: string): string {
  const content = escapeHtml(page.compiled_truth)
    .replace(/\n/g, '<br>')
    .replace(/^# (.+)$/m, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(page.title)} — ${escapeHtml(brainTitle)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;max-width:800px;margin:0 auto;padding:2rem;background:#0a0a0a;color:#e0e0e0;line-height:1.7}
a{color:#58a6ff;text-decoration:none}a:hover{text-decoration:underline}
h1{font-size:2rem;margin-bottom:1rem;color:#fff}
h2{font-size:1.4rem;margin:1.5rem 0 0.5rem;color:#c9d1d9}
h3{font-size:1.1rem;margin:1rem 0 0.3rem;color:#8b949e}
code{background:#161b22;padding:0.2em 0.4em;border-radius:3px;font-size:0.9em}
.meta{color:#8b949e;font-size:0.85rem;margin-bottom:1.5rem}
.nav{margin-bottom:2rem;padding-bottom:1rem;border-bottom:1px solid #21262d}
.content{white-space:pre-wrap}
.badge{display:inline-block;background:#21262d;color:#8b949e;padding:0.15em 0.5em;border-radius:4px;font-size:0.75rem;margin-right:0.3em}
</style>
</head>
<body>
<div class="nav"><a href="/">← ${escapeHtml(brainTitle)}</a></div>
<h1>${escapeHtml(page.title)}</h1>
<div class="meta">
<span class="badge">${escapeHtml(page.type)}</span>
Updated: ${page.updated_at}
</div>
<div class="content">${content}</div>
</body></html>`;
}

function renderIndex(pages: Page[], brainTitle: string): string {
  const byType: Record<string, Page[]> = {};
  for (const p of pages) {
    (byType[p.type] ??= []).push(p);
  }

  let list = '';
  for (const [type, typePages] of Object.entries(byType).sort()) {
    list += `<h2>${escapeHtml(type)} <span class="count">(${typePages.length})</span></h2><ul>`;
    for (const p of typePages.sort((a, b) => a.title.localeCompare(b.title))) {
      list += `<li><a href="/page/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a> <span class="date">${String(p.updated_at).slice(0, 10)}</span></li>`;
    }
    list += '</ul>';
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(brainTitle)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;max-width:800px;margin:0 auto;padding:2rem;background:#0a0a0a;color:#e0e0e0;line-height:1.7}
a{color:#58a6ff;text-decoration:none}a:hover{text-decoration:underline}
h1{font-size:2.2rem;margin-bottom:0.5rem;color:#fff}
h2{font-size:1.2rem;margin:1.5rem 0 0.5rem;color:#c9d1d9}
ul{list-style:none;padding:0}
li{padding:0.3rem 0;border-bottom:1px solid #161b22}
.count{color:#8b949e;font-size:0.85rem}
.date{color:#484f58;font-size:0.8rem;float:right}
.subtitle{color:#8b949e;margin-bottom:2rem}
.search{width:100%;padding:0.6rem 1rem;background:#161b22;border:1px solid #30363d;border-radius:6px;color:#e0e0e0;font-size:1rem;margin-bottom:1.5rem}
.search:focus{outline:none;border-color:#58a6ff}
</style>
</head>
<body>
<h1>🧠 ${escapeHtml(brainTitle)}</h1>
<p class="subtitle">${pages.length} pages — read-only shared brain</p>
<input class="search" placeholder="Filter pages..." oninput="filter(this.value)">
${list}
<script>
function filter(q){
  q=q.toLowerCase();
  document.querySelectorAll('li').forEach(li=>{
    li.style.display=li.textContent.toLowerCase().includes(q)?'':'none';
  });
}
</script>
</body></html>`;
}

/**
 * Serve a read-only web UI for sharing a brain.
 */
export async function serveSharedBrain(
  brain: Brain,
  options: CollabServeOptions = {},
): Promise<void> {
  const { port = 8080, host = '0.0.0.0', title = 'DeepBrain' } = options;
  const log = options.onProgress ?? console.log;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

      if (url.pathname === '/' || url.pathname === '') {
        const pages = await brain.list({ limit: 500 });
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderIndex(pages, title));
      } else if (url.pathname.startsWith('/page/')) {
        const slug = decodeURIComponent(url.pathname.slice(6));
        const page = await brain.get(slug);
        if (page) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(renderPage(page, title));
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Page not found');
        }
      } else if (url.pathname === '/api/search') {
        const q = url.searchParams.get('q') ?? '';
        if (!q) { res.writeHead(400); res.end('Missing q param'); return; }
        const results = await brain.search(q, { limit: 20 });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(results));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      }
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Error: ${e.message}`);
    }
  });

  server.listen(port, host, () => {
    log(`\n🧠 DeepBrain shared at http://${host}:${port}`);
    log(`   Read-only web UI. Press Ctrl+C to stop.\n`);
  });

  // Keep alive
  await new Promise(() => {});
}

/**
 * Export brain as static HTML site.
 */
export async function exportStaticSite(
  brain: Brain,
  outputDir: string,
  title = 'DeepBrain',
): Promise<CollabExportResult> {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');

  mkdirSync(join(outputDir, 'page'), { recursive: true });

  const pages = await brain.list({ limit: 1000 });

  // Write index
  writeFileSync(join(outputDir, 'index.html'), renderIndex(pages, title));

  // Write each page
  for (const pageMeta of pages) {
    const page = await brain.get(pageMeta.slug);
    if (page) {
      const safeSlug = pageMeta.slug.replace(/[^a-z0-9_-]/gi, '_');
      writeFileSync(join(outputDir, 'page', `${safeSlug}.html`), renderPage(page, title));
    }
  }

  return { pages: pages.length, outputDir };
}
