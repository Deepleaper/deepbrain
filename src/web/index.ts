/**
 * DeepBrain — Web UI Server
 *
 * Lightweight web interface for browsing and searching your knowledge base.
 * Zero dependencies beyond Node.js built-ins.
 *
 * Usage:
 *   import { startWebUI } from 'deepbrain/web';
 *   await startWebUI({ port: 3000, dataDir: './my-brain' });
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { Brain } from '../core/brain.js';
import { TagGraph } from '../tag-graph/index.js';
import type { DeepBrainConfig } from '../core/types.js';

export interface WebUIConfig {
  port?: number;
  host?: string;
  brainConfig?: Partial<DeepBrainConfig>;
}

const HTML_SHELL = (title: string, body: string, nav = '') => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — DeepBrain</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#1a1a1a;background:#fafafa}
.container{max-width:860px;margin:0 auto;padding:20px}
header{background:#111;color:#fff;padding:16px 0}
header .container{display:flex;align-items:center;justify-content:space-between}
header h1{font-size:1.2em;font-weight:600}
header h1 span{color:#6c5ce7}
header a{color:#ddd;text-decoration:none;font-size:.9em}
header a:hover{color:#fff}
nav{background:#fff;border-bottom:1px solid #e0e0e0;padding:10px 0}
nav .container{display:flex;gap:16px}
nav a{color:#555;text-decoration:none;font-size:.9em;padding:4px 8px;border-radius:4px}
nav a:hover,nav a.active{background:#6c5ce7;color:#fff}
.search-box{margin:24px 0}
.search-box input{width:100%;padding:12px 16px;border:2px solid #e0e0e0;border-radius:8px;font-size:1em;outline:none}
.search-box input:focus{border-color:#6c5ce7}
.page-list{list-style:none}
.page-list li{background:#fff;margin:8px 0;padding:16px;border-radius:8px;border:1px solid #e8e8e8}
.page-list li:hover{border-color:#6c5ce7;box-shadow:0 2px 8px rgba(108,92,231,.1)}
.page-list a{color:#1a1a1a;text-decoration:none;font-weight:600;font-size:1.05em}
.page-list .meta{color:#888;font-size:.85em;margin-top:4px}
.tag{display:inline-block;background:#f0edff;color:#6c5ce7;padding:2px 8px;border-radius:12px;font-size:.8em;margin:2px}
.page-body{background:#fff;padding:24px;border-radius:8px;border:1px solid #e8e8e8;margin:16px 0}
.page-body h1,.page-body h2,.page-body h3{margin:1em 0 .5em}
.page-body p{margin:.5em 0}
.page-body pre{background:#f4f4f4;padding:12px;border-radius:6px;overflow-x:auto}
.page-body code{background:#f4f4f4;padding:2px 6px;border-radius:3px;font-size:.9em}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin:24px 0}
.stat-card{background:#fff;padding:20px;border-radius:8px;border:1px solid #e8e8e8;text-align:center}
.stat-card .num{font-size:2em;font-weight:700;color:#6c5ce7}
.stat-card .label{color:#888;font-size:.85em}
.empty{text-align:center;padding:40px;color:#888}
footer{text-align:center;padding:20px;color:#aaa;font-size:.8em}
</style></head><body>
<header><div class="container"><h1>🧠 <span>Deep</span>Brain</h1><a href="https://github.com/Magicray1217/deepbrain">GitHub</a></div></header>
${nav ? `<nav><div class="container">${nav}</div></nav>` : ''}
<main><div class="container">${body}</div></main>
<footer>DeepBrain — Your AI-powered second brain</footer>
</body></html>`;

const NAV = `<a href="/">📚 Pages</a><a href="/search">🔍 Search</a><a href="/tags">🏷️ Tags</a><a href="/stats">📊 Stats</a>`;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function mdToHtml(md: string): string {
  let html = esc(md);
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/\n\n/g, '</p><p>');
  return `<p>${html}</p>`;
}

function parseQuery(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const idx = url.indexOf('?');
  if (idx === -1) return params;
  url.slice(idx + 1).split('&').forEach(p => {
    const [k, v] = p.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
  });
  return params;
}

export async function startWebUI(config: WebUIConfig = {}): Promise<void> {
  const port = config.port ?? 3000;
  const host = config.host ?? '0.0.0.0';

  const brain = new Brain(config.brainConfig ?? {});
  await brain.connect();
  const tagGraph = new TagGraph(brain);

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/';
    const path = url.split('?')[0];
    const query = parseQuery(url);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    try {
      if (path === '/' || path === '/pages') {
        const pages = await brain.list();
        const list = pages.length === 0
          ? '<div class="empty">No pages yet. Add some knowledge!</div>'
          : `<ul class="page-list">${pages.map(p => {
              const tagStr = '';
              return `<li><a href="/page/${encodeURIComponent(p.slug)}">${esc(p.title)}</a>
              <div class="meta"><span>${p.type}</span> · Updated: ${p.updated_at}</div></li>`;
            }).join('')}</ul>`;

        res.end(HTML_SHELL('Pages', `<h2>📚 All Pages (${pages.length})</h2>${list}`, NAV));

      } else if (path.startsWith('/page/')) {
        const slug = decodeURIComponent(path.slice(6));
        const page = await brain.get(slug);
        if (!page) { res.statusCode = 404; res.end(HTML_SHELL('Not Found', '<div class="empty">Page not found</div>', NAV)); return; }

        const tags = await brain.getTags(slug);
        const tagHtml = tags.map(t => `<span class="tag">${esc(t)}</span>`).join('');
        const body = `<h2>${esc(page.title)}</h2><div class="meta">${tagHtml} · ${page.type}</div><div class="page-body">${mdToHtml(page.compiled_truth)}</div>`;
        res.end(HTML_SHELL(page.title, body, NAV));

      } else if (path === '/search') {
        const q = query.q ?? '';
        let results = '';
        if (q) {
          const hits = await brain.search(q, { limit: 20 });
          results = hits.length === 0
            ? '<div class="empty">No results found</div>'
            : `<ul class="page-list">${hits.map(h =>
                `<li><a href="/page/${encodeURIComponent(h.slug)}">${esc(h.title)}</a>
                <div class="meta">Score: ${(h.score ?? 0).toFixed(3)}</div></li>`
              ).join('')}</ul>`;
        }
        const body = `<h2>🔍 Search</h2>
          <div class="search-box"><form action="/search" method="GET">
          <input name="q" value="${esc(q)}" placeholder="Search your brain..." autofocus>
          </form></div>${results}`;
        res.end(HTML_SHELL('Search', body, NAV));

      } else if (path === '/tags') {
        const tree = await tagGraph.getTree();
        const allTags = await tagGraph.getAllTags();

        const renderTree = (nodes: any[], indent = 0): string => {
          return nodes.map(n => {
            const pad = '&nbsp;'.repeat(indent * 4);
            const childHtml = n.children.length > 0 ? renderTree(n.children, indent + 1) : '';
            return `<div>${pad}<span class="tag">${esc(n.tag)}</span> <span class="meta">(${n.count})</span>${childHtml}</div>`;
          }).join('');
        };

        const tagCloud = allTags.slice(0, 50).map(t =>
          `<span class="tag" style="font-size:${Math.min(2, 0.8 + t.count * 0.15)}em">${esc(t.tag)}</span>`
        ).join(' ');

        const body = `<h2>🏷️ Tag Graph</h2>
          <h3>Tag Cloud</h3><div style="line-height:2.5;margin:16px 0">${tagCloud || '<span class="meta">No tags yet</span>'}</div>
          <h3>Tag Tree</h3><div class="page-body">${tree.length > 0 ? renderTree(tree) : '<span class="meta">No hierarchical tags</span>'}</div>
          <h3>All Tags (${allTags.length})</h3>
          <ul class="page-list">${allTags.map(t =>
            `<li><span class="tag">${esc(t.tag)}</span> — ${t.count} page${t.count > 1 ? 's' : ''}</li>`
          ).join('')}</ul>`;
        res.end(HTML_SHELL('Tags', body, NAV));

      } else if (path === '/stats') {
        const stats = await brain.stats();
        const body = `<h2>📊 Stats</h2><div class="stats">
          <div class="stat-card"><div class="num">${stats.page_count}</div><div class="label">Pages</div></div>
          <div class="stat-card"><div class="num">${stats.chunk_count}</div><div class="label">Chunks</div></div>
          <div class="stat-card"><div class="num">${stats.link_count}</div><div class="label">Links</div></div>
          <div class="stat-card"><div class="num">${stats.embedded_count}</div><div class="label">Embedded</div></div>
          <div class="stat-card"><div class="num">${stats.tag_count}</div><div class="label">Tags</div></div>
        </div>`;
        res.end(HTML_SHELL('Stats', body, NAV));

      } else if (path === '/api/search') {
        res.setHeader('Content-Type', 'application/json');
        const q = query.q ?? '';
        const hits = q ? await brain.search(q, { limit: 20 }) : [];
        res.end(JSON.stringify({ query: q, results: hits }));

      } else if (path === '/api/pages') {
        res.setHeader('Content-Type', 'application/json');
        const pages = await brain.list();
        res.end(JSON.stringify({ pages }));

      } else if (path === '/api/tags') {
        res.setHeader('Content-Type', 'application/json');
        const graph = await tagGraph.getGraph();
        res.end(JSON.stringify(graph));

      } else if (path === '/api/tags/tree') {
        res.setHeader('Content-Type', 'application/json');
        const tree = await tagGraph.getTree();
        res.end(JSON.stringify({ tree }));

      } else if (path === '/api/tags/recommend' && query.slug) {
        res.setHeader('Content-Type', 'application/json');
        const recs = await tagGraph.recommend(query.slug, parseInt(query.limit ?? '5'));
        res.end(JSON.stringify({ slug: query.slug, recommendations: recs }));

      } else if (path === '/api/tags/clusters') {
        res.setHeader('Content-Type', 'application/json');
        const clusters = await tagGraph.cluster(parseInt(query.min ?? '2'));
        res.end(JSON.stringify({ clusters }));

      } else {
        res.statusCode = 404;
        res.end(HTML_SHELL('404', '<div class="empty">Page not found</div>', NAV));
      }
    } catch (err: any) {
      res.statusCode = 500;
      res.end(HTML_SHELL('Error', `<div class="empty">Error: ${esc(err.message)}</div>`, NAV));
    }
  });

  server.listen(port, host, () => {
    console.log(`🧠 DeepBrain Web UI running at http://${host}:${port}`);
  });
}
