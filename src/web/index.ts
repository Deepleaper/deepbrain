/**
 * DeepBrain — Web UI Server v1.1
 *
 * Interactive web interface with:
 * - Sidebar: brain list, page list, search
 * - Knowledge graph visualization (embedded SVG)
 * - Page detail view with metadata
 * - Dark theme, responsive
 * - Multi-language support (EN/ZH)
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { Brain } from '../core/brain.js';
import { TagGraph } from '../tag-graph/index.js';
import type { DeepBrainConfig } from '../core/types.js';
import { t, getLocale, setLocale, type Locale } from '../i18n.js';
import { fireWebhook, loadWebhookConfig, type WebhookConfig } from '../webhooks.js';

export interface WebUIConfig {
  port?: number;
  host?: string;
  brainConfig?: Partial<DeepBrainConfig>;
  locale?: Locale;
  webhookConfig?: WebhookConfig;
}

// ── CSS ──────────────────────────────────────────────────────────

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0d1117;--bg2:#161b22;--bg3:#1c2128;--border:#30363d;
  --text:#e6edf3;--text2:#8b949e;--accent:#7c3aed;--accent2:#a78bfa;
  --success:#3fb950;--warn:#d29922;--error:#f85149;
  --sidebar-w:280px;--header-h:56px;
}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;line-height:1.6;color:var(--text);background:var(--bg);display:flex;flex-direction:column;min-height:100vh}
a{color:var(--accent2);text-decoration:none}
a:hover{color:#c4b5fd;text-decoration:underline}

/* Header */
.header{height:var(--header-h);background:var(--bg2);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 20px;position:fixed;top:0;left:0;right:0;z-index:100}
.header h1{font-size:1.1em;font-weight:600;color:var(--text)}
.header h1 span{color:var(--accent2)}
.header-right{margin-left:auto;display:flex;align-items:center;gap:12px}
.header-right a{color:var(--text2);font-size:.85em}
.header-right a:hover{color:var(--text)}
.lang-switch{background:var(--bg3);border:1px solid var(--border);color:var(--text2);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:.8em}
.lang-switch:hover{border-color:var(--accent)}
.menu-toggle{display:none;background:none;border:none;color:var(--text);font-size:1.4em;cursor:pointer}

/* Layout */
.layout{display:flex;margin-top:var(--header-h);flex:1}

/* Sidebar */
.sidebar{width:var(--sidebar-w);background:var(--bg2);border-right:1px solid var(--border);position:fixed;top:var(--header-h);bottom:0;left:0;overflow-y:auto;padding:16px 0;z-index:50}
.sidebar-section{padding:0 16px;margin-bottom:20px}
.sidebar-section h3{font-size:.75em;text-transform:uppercase;color:var(--text2);letter-spacing:.05em;margin-bottom:8px;padding-left:4px}
.sidebar-search{padding:0 12px;margin-bottom:16px}
.sidebar-search input{width:100%;padding:8px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:.85em;outline:none}
.sidebar-search input:focus{border-color:var(--accent)}
.sidebar-search input::placeholder{color:var(--text2)}
.nav-item{display:flex;align-items:center;gap:8px;padding:6px 16px;color:var(--text2);font-size:.9em;border-radius:0;transition:all .15s}
.nav-item:hover{background:var(--bg3);color:var(--text);text-decoration:none}
.nav-item.active{background:rgba(124,58,237,.15);color:var(--accent2);border-right:2px solid var(--accent)}
.page-item{display:block;padding:5px 16px 5px 24px;color:var(--text2);font-size:.82em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.page-item:hover{background:var(--bg3);color:var(--text);text-decoration:none}
.page-count{background:var(--bg3);padding:1px 6px;border-radius:10px;font-size:.75em;color:var(--text2)}

/* Main */
.main{margin-left:var(--sidebar-w);flex:1;padding:24px 32px;max-width:1200px}

/* Cards */
.card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:20px;margin-bottom:16px;transition:border-color .2s}
.card:hover{border-color:var(--accent)}
.card h3{font-size:1.05em;margin-bottom:4px}
.card .meta{color:var(--text2);font-size:.82em;margin-top:4px}
.card .preview{color:var(--text2);font-size:.88em;margin-top:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

/* Search */
.search-box{margin-bottom:24px}
.search-box input{width:100%;padding:14px 18px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:1em;outline:none}
.search-box input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(124,58,237,.2)}

/* Tags */
.tag{display:inline-block;background:rgba(124,58,237,.15);color:var(--accent2);padding:2px 10px;border-radius:12px;font-size:.78em;margin:2px}
.tag:hover{background:rgba(124,58,237,.3)}

/* Stats */
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin:20px 0}
.stat-card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:24px;text-align:center}
.stat-card .num{font-size:2.2em;font-weight:700;color:var(--accent2)}
.stat-card .label{color:var(--text2);font-size:.82em;margin-top:4px}

/* Page detail */
.page-header{margin-bottom:24px}
.page-header h2{font-size:1.5em;margin-bottom:8px}
.page-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:16px}
.page-body{background:var(--bg2);padding:28px;border-radius:10px;border:1px solid var(--border);line-height:1.8}
.page-body h1,.page-body h2,.page-body h3{margin:1.2em 0 .5em;color:var(--accent2)}
.page-body pre{background:var(--bg3);padding:16px;border-radius:8px;overflow-x:auto;border:1px solid var(--border)}
.page-body code{background:var(--bg3);padding:2px 6px;border-radius:4px;font-size:.88em}
.page-body blockquote{border-left:3px solid var(--accent);padding-left:16px;color:var(--text2)}

/* Metadata panel */
.meta-panel{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:20px;margin-top:16px}
.meta-panel h3{font-size:.9em;color:var(--text2);margin-bottom:12px}
.meta-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:.85em}
.meta-row:last-child{border-bottom:none}
.meta-key{color:var(--text2)}
.meta-val{color:var(--text)}

/* Knowledge graph */
.graph-container{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:20px;margin:20px 0}
.graph-container svg{width:100%;height:500px}
.graph-node{cursor:pointer}
.graph-node circle{fill:var(--accent);stroke:var(--accent2);stroke-width:2}
.graph-node text{fill:var(--text);font-size:11px;text-anchor:middle}
.graph-link{stroke:var(--border);stroke-width:1.5;stroke-opacity:.6}
.graph-controls{display:flex;gap:8px;margin-bottom:12px}
.graph-btn{background:var(--bg3);border:1px solid var(--border);color:var(--text2);padding:6px 14px;border-radius:6px;cursor:pointer;font-size:.82em}
.graph-btn:hover{border-color:var(--accent);color:var(--text)}

/* Empty state */
.empty{text-align:center;padding:60px 20px;color:var(--text2)}
.empty .icon{font-size:3em;margin-bottom:16px}

/* Footer */
.footer{text-align:center;padding:20px;color:var(--text2);font-size:.78em;border-top:1px solid var(--border)}

/* Responsive */
@media(max-width:768px){
  .sidebar{transform:translateX(-100%);transition:transform .3s}
  .sidebar.open{transform:translateX(0)}
  .main{margin-left:0;padding:16px}
  .menu-toggle{display:block}
}
`;

// ── HTML Shell ───────────────────────────────────────────────────

const htmlShell = (title: string, body: string, activePath: string, sidebarPages: string) => `<!DOCTYPE html>
<html lang="${getLocale()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — DeepBrain</title>
<style>${CSS}</style></head><body>
<div class="header">
  <button class="menu-toggle" onclick="document.querySelector('.sidebar').classList.toggle('open')">☰</button>
  <h1>🧠 <span>Deep</span>Brain</h1>
  <div class="header-right">
    <a href="${getLocale() === 'en' ? '?lang=zh' : '?lang=en'}" class="lang-switch">${getLocale() === 'en' ? '中文' : 'EN'}</a>
    <a href="https://github.com/Magicray1217/deepbrain" target="_blank">GitHub</a>
  </div>
</div>
<div class="layout">
  <div class="sidebar">
    <div class="sidebar-search">
      <form action="/search" method="GET"><input name="q" placeholder="${esc(t('web.searchPlaceholder'))}" /></form>
    </div>
    <div class="sidebar-section">
      <h3>Navigation</h3>
      <a class="nav-item${activePath === '/' ? ' active' : ''}" href="/">📚 ${t('web.pages')}</a>
      <a class="nav-item${activePath === '/search' ? ' active' : ''}" href="/search">🔍 ${t('web.search')}</a>
      <a class="nav-item${activePath === '/graph-view' ? ' active' : ''}" href="/graph-view">🕸️ ${t('web.graph')}</a>
      <a class="nav-item${activePath === '/tags' ? ' active' : ''}" href="/tags">🏷️ ${t('web.tags')}</a>
      <a class="nav-item${activePath === '/stats' ? ' active' : ''}" href="/stats">📊 ${t('web.stats')}</a>
    </div>
    <div class="sidebar-section">
      <h3>${t('web.pages')} <span class="page-count">${sidebarPages ? sidebarPages.split('page-item').length - 1 : 0}</span></h3>
      ${sidebarPages}
    </div>
  </div>
  <div class="main">${body}</div>
</div>
<div class="footer">${t('web.footer')}</div>
<script>
document.addEventListener('click',e=>{
  if(window.innerWidth<=768&&!e.target.closest('.sidebar')&&!e.target.closest('.menu-toggle')){
    document.querySelector('.sidebar').classList.remove('open');
  }
});
</script>
</body></html>`;

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
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
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

// ── Knowledge Graph SVG Generator ────────────────────────────────

function generateGraphSVG(nodes: Array<{slug: string; title: string; type: string}>, links: Array<{from: string; to: string; type: string}>): string {
  if (nodes.length === 0) return '<div class="empty"><div class="icon">🕸️</div><p>No graph data yet</p></div>';

  const width = 900;
  const height = 500;
  const cx = width / 2;
  const cy = height / 2;

  // Simple force-directed layout (pre-computed positions)
  const positions: Record<string, {x: number; y: number}> = {};
  const n = nodes.length;

  // Arrange in concentric circles
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n;
    const radius = Math.min(width, height) * 0.35;
    positions[node.slug] = {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });

  // Generate SVG
  const linkLines = links.map(l => {
    const from = positions[l.from];
    const to = positions[l.to];
    if (!from || !to) return '';
    return `<line class="graph-link" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>`;
  }).join('\n');

  const typeColors: Record<string, string> = {
    note: '#7c3aed', person: '#3b82f6', company: '#10b981', topic: '#f59e0b',
    project: '#ef4444', event: '#ec4899', default: '#6b7280'
  };

  const nodeCircles = nodes.map(node => {
    const pos = positions[node.slug];
    if (!pos) return '';
    const color = typeColors[node.type] ?? typeColors.default;
    const label = node.title.length > 15 ? node.title.slice(0, 14) + '…' : node.title;
    return `<g class="graph-node" onclick="window.location='/page/${encodeURIComponent(node.slug)}'">
      <circle cx="${pos.x}" cy="${pos.y}" r="20" fill="${color}" stroke="${color}88" stroke-width="3" opacity="0.85"/>
      <text x="${pos.x}" y="${pos.y + 32}" fill="#e6edf3" font-size="11" text-anchor="middle">${esc(label)}</text>
    </g>`;
  }).join('\n');

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#0d1117" rx="10"/>
    ${linkLines}
    ${nodeCircles}
  </svg>`;
}

// ── Server ───────────────────────────────────────────────────────

export async function startWebUI(config: WebUIConfig = {}): Promise<void> {
  const port = config.port ?? 3000;
  const host = config.host ?? '0.0.0.0';

  if (config.locale) setLocale(config.locale);

  const brain = new Brain(config.brainConfig ?? {});
  await brain.connect();
  const tagGraph = new TagGraph(brain);
  const webhookConfig = config.webhookConfig;

  // Helper: get sidebar pages
  async function getSidebarPages(): Promise<string> {
    const pages = await brain.list({ limit: 30 });
    return pages.map(p =>
      `<a class="page-item" href="/page/${encodeURIComponent(p.slug)}" title="${esc(p.title)}">📄 ${esc(p.title)}</a>`
    ).join('');
  }

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/';
    const path = url.split('?')[0];
    const query = parseQuery(url);

    // Language switch
    if (query.lang === 'en' || query.lang === 'zh') {
      setLocale(query.lang as Locale);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    try {
      const sidebarPages = await getSidebarPages();

      if (path === '/' || path === '/pages') {
        const pages = await brain.list();
        const list = pages.length === 0
          ? `<div class="empty"><div class="icon">📚</div><p>${t('web.noPages')}</p></div>`
          : pages.map(p => {
              const tags = ''; // tags loaded async per page
              return `<div class="card"><h3><a href="/page/${encodeURIComponent(p.slug)}">${esc(p.title)}</a></h3>
              <div class="meta"><span class="tag">${esc(p.type)}</span> · ${t('web.updated')}: ${p.updated_at}</div></div>`;
            }).join('');

        res.end(htmlShell(t('web.pages'), `<h2>📚 ${t('web.allPages')} (${pages.length})</h2>${list}`, '/', sidebarPages));

      } else if (path.startsWith('/page/')) {
        const slug = decodeURIComponent(path.slice(6));
        const page = await brain.get(slug);
        if (!page) { res.statusCode = 404; res.end(htmlShell('Not Found', '<div class="empty">Page not found</div>', '', sidebarPages)); return; }

        const tags = await brain.getTags(slug);
        const tagHtml = tags.map(tg => `<span class="tag">${esc(tg)}</span>`).join('');

        // Metadata panel
        const fm = page.frontmatter ?? {};
        const metaRows = [
          ['Type', page.type],
          ['Slug', page.slug],
          ['Created', String(page.created_at)],
          ['Updated', String(page.updated_at)],
          ...(fm.summary ? [['Summary', String(fm.summary)]] : []),
          ...(fm.auto_tags ? [['Auto Tags', (fm.auto_tags as string[]).join(', ')]] : []),
        ].map(([k, v]) => `<div class="meta-row"><span class="meta-key">${k}</span><span class="meta-val">${esc(String(v))}</span></div>`).join('');

        const body = `<div class="page-header"><h2>${esc(page.title)}</h2>
          <div class="page-meta">${tagHtml}<span class="tag">${esc(page.type)}</span></div></div>
          <div class="page-body">${mdToHtml(page.compiled_truth)}</div>
          <div class="meta-panel"><h3>${t('web.metadata')}</h3>${metaRows}</div>
          ${page.timeline ? `<div class="meta-panel"><h3>Timeline</h3><div class="page-body">${mdToHtml(page.timeline)}</div></div>` : ''}`;
        res.end(htmlShell(page.title, body, '', sidebarPages));

      } else if (path === '/search') {
        const q = query.q ?? '';
        let results = '';
        if (q) {
          const hits = await brain.search(q, { limit: 20 });
          if (webhookConfig) {
            fireWebhook('search.performed', { query: q, resultCount: hits.length }, webhookConfig).catch(() => {});
          }
          results = hits.length === 0
            ? `<div class="empty">${t('search.noResults')}</div>`
            : hits.map(h =>
                `<div class="card"><h3><a href="/page/${encodeURIComponent(h.slug)}">${esc(h.title)}</a></h3>
                <div class="meta">${t('web.score')}: ${(h.score ?? 0).toFixed(3)} · ${h.type}</div>
                <div class="preview">${esc(h.chunk_text.slice(0, 200))}</div></div>`
              ).join('');
        }
        const body = `<h2>🔍 ${t('web.search')}</h2>
          <div class="search-box"><form action="/search" method="GET">
          <input name="q" value="${esc(q)}" placeholder="${esc(t('web.searchPlaceholder'))}" autofocus>
          </form></div>${results}`;
        res.end(htmlShell(t('web.search'), body, '/search', sidebarPages));

      } else if (path === '/graph-view') {
        // Build graph from pages and links
        const pages = await brain.list({ limit: 100 });
        const nodes = pages.map(p => ({ slug: p.slug, title: p.title, type: p.type }));

        // Get links between pages
        const links: Array<{from: string; to: string; type: string}> = [];
        for (const p of pages.slice(0, 50)) { // Limit for performance
          try {
            const pageLinks = await brain.getLinks(p.slug);
            for (const l of pageLinks) {
              links.push({ from: l.from_slug, to: l.to_slug, type: l.link_type });
            }
          } catch { /* skip */ }
        }

        const svg = generateGraphSVG(nodes, links);
        const body = `<h2>🕸️ ${t('web.graph')}</h2>
          <div class="graph-container">${svg}</div>
          <div class="meta">${nodes.length} nodes, ${links.length} links</div>`;
        res.end(htmlShell(t('web.graph'), body, '/graph-view', sidebarPages));

      } else if (path === '/tags') {
        const allTags = await tagGraph.getAllTags();
        const tagCloud = allTags.slice(0, 50).map(tg =>
          `<span class="tag" style="font-size:${Math.min(2, 0.8 + tg.count * 0.15)}em">${esc(tg.tag)}</span>`
        ).join(' ');

        const tree = await tagGraph.getTree();
        const renderTree = (nodes: any[], indent = 0): string => {
          return nodes.map(n => {
            const pad = '&nbsp;'.repeat(indent * 4);
            const childHtml = n.children.length > 0 ? renderTree(n.children, indent + 1) : '';
            return `<div>${pad}<span class="tag">${esc(n.tag)}</span> <span class="meta">(${n.count})</span>${childHtml}</div>`;
          }).join('');
        };

        const body = `<h2>🏷️ ${t('web.tags')}</h2>
          <h3>${t('web.tagCloud')}</h3><div style="line-height:2.5;margin:16px 0">${tagCloud || `<span class="meta">${t('web.noTags')}</span>`}</div>
          <h3>${t('web.tagTree')}</h3><div class="card">${tree.length > 0 ? renderTree(tree) : `<span class="meta">${t('web.noTags')}</span>`}</div>
          <h3>${t('web.allTags')} (${allTags.length})</h3>
          ${allTags.map(tg => `<div class="card"><span class="tag">${esc(tg.tag)}</span> — ${tg.count} page${tg.count > 1 ? 's' : ''}</div>`).join('')}`;
        res.end(htmlShell(t('web.tags'), body, '/tags', sidebarPages));

      } else if (path === '/stats') {
        const stats = await brain.stats();
        const body = `<h2>📊 ${t('web.stats')}</h2><div class="stats-grid">
          <div class="stat-card"><div class="num">${stats.page_count}</div><div class="label">${t('stats.pages')}</div></div>
          <div class="stat-card"><div class="num">${stats.chunk_count}</div><div class="label">${t('stats.chunks')}</div></div>
          <div class="stat-card"><div class="num">${stats.link_count}</div><div class="label">${t('stats.links')}</div></div>
          <div class="stat-card"><div class="num">${stats.embedded_count}</div><div class="label">${t('stats.embedded')}</div></div>
          <div class="stat-card"><div class="num">${stats.tag_count}</div><div class="label">${t('stats.tags')}</div></div>
        </div>`;
        res.end(htmlShell(t('web.stats'), body, '/stats', sidebarPages));

      // ── API endpoints (kept from v1.0) ──
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
      } else if (path === '/api/graph') {
        res.setHeader('Content-Type', 'application/json');
        const pages = await brain.list({ limit: 200 });
        const nodes = pages.map(p => ({ slug: p.slug, title: p.title, type: p.type }));
        const links: any[] = [];
        for (const p of pages.slice(0, 100)) {
          try {
            const pl = await brain.getLinks(p.slug);
            for (const l of pl) links.push({ from: l.from_slug, to: l.to_slug, type: l.link_type });
          } catch { /* skip */ }
        }
        res.end(JSON.stringify({ nodes, links }));
      } else {
        res.statusCode = 404;
        res.end(htmlShell('404', '<div class="empty"><div class="icon">🔍</div><p>Page not found</p></div>', '', sidebarPages));
      }
    } catch (err: any) {
      res.statusCode = 500;
      res.end(htmlShell('Error', `<div class="empty">Error: ${esc(err.message)}</div>`, '', ''));
    }
  });

  server.listen(port, host, () => {
    console.log(`🧠 DeepBrain Web UI v1.1 running at http://${host}:${port}`);
  });
}
