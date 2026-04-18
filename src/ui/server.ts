/**
 * DeepBrain — Web UI Server (standalone dashboard)
 *
 * Pure Node.js HTTP server, zero external dependencies.
 * Provides REST API + serves static HTML dashboard.
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

export interface BrainUIConfig {
  port: number;
  brain: any; // Brain instance
  staticDir: string;
}

const DEFAULTS: BrainUIConfig = {
  port: 4001,
  brain: null,
  staticDir: join(import.meta.dirname ?? __dirname, '.'),
};

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function cors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res: ServerResponse, data: unknown, status = 200) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

export class BrainUI {
  private config: BrainUIConfig;
  private server: Server | null = null;

  constructor(config: Partial<BrainUIConfig> = {}) {
    this.config = { ...DEFAULTS, ...config };
  }

  async start(): Promise<void> {
    const { port, brain, staticDir } = this.config;

    this.server = createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);
      const path = url.pathname;

      // CORS preflight
      if (req.method === 'OPTIONS') {
        cors(res);
        res.writeHead(204);
        res.end();
        return;
      }

      try {
        // ── API Routes ─────────────────────────────────────────
        if (path.startsWith('/api/')) {
          if (!brain) {
            return json(res, { error: 'Brain not connected' }, 503);
          }

          // GET /api/pages
          if (path === '/api/pages' && req.method === 'GET') {
            const pages = await brain.list({ limit: 200 });
            return json(res, pages);
          }

          // GET /api/pages/:slug
          const pageMatch = path.match(/^\/api\/pages\/(.+)$/);
          if (pageMatch && req.method === 'GET') {
            const slug = decodeURIComponent(pageMatch[1]);
            const page = await brain.get(slug);
            if (!page) return json(res, { error: 'Not found' }, 404);
            const tags = await brain.getTags(slug).catch(() => []);
            return json(res, { ...page, tags });
          }

          // PUT /api/pages/:slug
          if (pageMatch && req.method === 'PUT') {
            const slug = decodeURIComponent(pageMatch[1]);
            const body = JSON.parse(await readBody(req));
            const page = await brain.put(slug, body);
            return json(res, page);
          }

          // DELETE /api/pages/:slug
          if (pageMatch && req.method === 'DELETE') {
            const slug = decodeURIComponent(pageMatch[1]);
            await brain.delete(slug);
            return json(res, { ok: true });
          }

          // GET /api/search?q=xxx (semantic)
          if (path === '/api/search' && req.method === 'GET') {
            const q = url.searchParams.get('q') ?? '';
            if (!q) return json(res, []);
            const results = await brain.query(q, { limit: 20 });
            return json(res, results);
          }

          // GET /api/search/keyword?q=xxx
          if (path === '/api/search/keyword' && req.method === 'GET') {
            const q = url.searchParams.get('q') ?? '';
            if (!q) return json(res, []);
            const results = await brain.search(q, { limit: 20 });
            return json(res, results);
          }

          // GET /api/stats
          if (path === '/api/stats' && req.method === 'GET') {
            const stats = await brain.stats();
            return json(res, stats);
          }

          // GET /api/timeline/:slug
          const tlMatch = path.match(/^\/api\/timeline\/(.+)$/);
          if (tlMatch && req.method === 'GET') {
            const slug = decodeURIComponent(tlMatch[1]);
            const entries = await brain.getTimeline(slug);
            return json(res, entries);
          }

          // POST /api/evolve
          if (path === '/api/evolve' && req.method === 'POST') {
            try {
              const { AgentBrain } = await import('../agent-brain.js');
              const agentBrain = new AgentBrain(brain, 'ui');
              const result = await agentBrain.evolve({});
              return json(res, result);
            } catch (e: any) {
              return json(res, { error: e.message }, 500);
            }
          }

          // GET /api/tags
          if (path === '/api/tags' && req.method === 'GET') {
            try {
              // Get all tags with counts by querying directly
              const pages = await brain.list({ limit: 500 });
              const tagMap: Record<string, number> = {};
              for (const p of pages) {
                const tags = await brain.getTags(p.slug).catch(() => []);
                for (const t of tags) {
                  tagMap[t] = (tagMap[t] ?? 0) + 1;
                }
              }
              const tags = Object.entries(tagMap).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
              return json(res, tags);
            } catch {
              return json(res, []);
            }
          }

          // GET /api/graph
          if (path === '/api/graph' && req.method === 'GET') {
            try {
              const pages = await brain.list({ limit: 500 });
              const nodes = pages.map((p: any) => ({ slug: p.slug, title: p.title, type: p.type }));
              const edges: Array<{ from: string; to: string; type: string }> = [];
              for (const p of pages) {
                const links = await brain.getLinks(p.slug).catch(() => []);
                for (const l of links) {
                  edges.push({ from: l.from_slug, to: l.to_slug, type: l.link_type });
                }
              }
              return json(res, { nodes, edges });
            } catch {
              return json(res, { nodes: [], edges: [] });
            }
          }

          // 404 for unknown API routes
          return json(res, { error: 'Not found' }, 404);
        }

        // ── Static Files ───────────────────────────────────────
        let filePath = path === '/' ? '/index.html' : path;
        const fullPath = join(staticDir, filePath);

        if (existsSync(fullPath)) {
          const ext = extname(fullPath);
          const mime = MIME[ext] ?? 'application/octet-stream';
          cors(res);
          res.writeHead(200, { 'Content-Type': mime });
          res.end(readFileSync(fullPath));
        } else {
          // SPA fallback — serve index.html
          const indexPath = join(staticDir, 'index.html');
          if (existsSync(indexPath)) {
            cors(res);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(readFileSync(indexPath));
          } else {
            json(res, { error: 'Not found' }, 404);
          }
        }
      } catch (e: any) {
        json(res, { error: e.message ?? 'Internal error' }, 500);
      }
    });

    return new Promise<void>((resolve) => {
      this.server!.listen(port, () => {
        console.log(`🧠 DeepBrain UI → http://localhost:${port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
