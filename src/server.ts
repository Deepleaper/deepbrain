/**
 * DeepBrain — REST API Server
 *
 * Lightweight HTTP server for all DeepBrain operations.
 * No external dependencies — uses Node.js built-in http module.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Brain } from './core/brain.js';
import type { DeepBrainConfig } from './core/types.js';
import { injectMemories, formatInjection } from './proactive.js';
import { buildKnowledgeGraph, formatGraph } from './knowledge-graph.js';

// ── Types ─────────────────────────────────────────────────────────

export interface ServerConfig {
  port: number;
  host: string;
  brainConfig: Partial<DeepBrainConfig>;
  llmConfig?: { provider?: string; model?: string; apiKey?: string };
}

interface Route {
  method: string;
  pattern: RegExp;
  handler: (req: IncomingMessage, res: ServerResponse, match: RegExpMatchArray, body: any) => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────────

async function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      try { resolve(JSON.parse(raw)); } catch { resolve(raw || null); }
    });
  });
}

function json(res: ServerResponse, data: any, status = 200): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function error(res: ServerResponse, message: string, status = 400): void {
  json(res, { error: message }, status);
}

// ── OpenAPI Spec ──────────────────────────────────────────────────

const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'DeepBrain API',
    version: '1.0.0',
    description: 'REST API for DeepBrain — Personal AI Brain',
  },
  paths: {
    '/pages': {
      post: {
        summary: 'Add/update a page',
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['slug', 'title', 'content'], properties: { slug: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' }, type: { type: 'string', default: 'note' } } } } } },
        responses: { '200': { description: 'Page saved' } },
      },
      get: {
        summary: 'List pages',
        parameters: [{ name: 'type', in: 'query', schema: { type: 'string' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }],
        responses: { '200': { description: 'Page list' } },
      },
    },
    '/pages/{slug}': {
      get: { summary: 'Get a page', responses: { '200': { description: 'Page data' } } },
      delete: { summary: 'Delete a page', responses: { '200': { description: 'Deleted' } } },
    },
    '/search': {
      get: {
        summary: 'Semantic search',
        parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }],
        responses: { '200': { description: 'Search results' } },
      },
    },
    '/chat': {
      post: {
        summary: 'Chat with brain (RAG)',
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['message'], properties: { message: { type: 'string' } } } } } },
        responses: { '200': { description: 'Chat response' } },
      },
    },
    '/inject': {
      post: {
        summary: 'Proactive memory injection',
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['context'], properties: { context: { type: 'string' } } } } } },
        responses: { '200': { description: 'Injected memories' } },
      },
    },
    '/graph': { get: { summary: 'Knowledge graph', responses: { '200': { description: 'Graph data' } } } },
    '/stats': { get: { summary: 'Brain statistics', responses: { '200': { description: 'Stats' } } } },
    '/openapi.json': { get: { summary: 'OpenAPI spec', responses: { '200': { description: 'OpenAPI JSON' } } } },
  },
};

// ── Server ────────────────────────────────────────────────────────

/**
 * Start the DeepBrain REST API server.
 */
export async function startServer(config: ServerConfig): Promise<void> {
  const brain = new Brain(config.brainConfig);
  await brain.connect();

  const routes: Route[] = [
    // POST /pages — add knowledge
    {
      method: 'POST', pattern: /^\/pages\/?$/,
      handler: async (_req, res, _match, body) => {
        if (!body?.slug || !body?.title || !body?.content) {
          return error(res, 'Required: slug, title, content');
        }
        const page = await brain.put(body.slug, {
          type: body.type ?? 'note',
          title: body.title,
          compiled_truth: body.content,
          timeline: body.timeline,
          frontmatter: body.frontmatter ?? {},
          owner: body.owner,
        });
        json(res, { ok: true, page: { slug: page.slug, title: page.title, type: page.type } });
      },
    },

    // GET /pages — list pages
    {
      method: 'GET', pattern: /^\/pages\/?$/,
      handler: async (req, res) => {
        const url = new URL(req.url!, `http://${req.headers.host}`);
        const type = url.searchParams.get('type') ?? undefined;
        const limit = parseInt(url.searchParams.get('limit') ?? '50');
        const pages = await brain.list({ type, limit });
        json(res, { pages: pages.map(p => ({ slug: p.slug, title: p.title, type: p.type, updated_at: p.updated_at })) });
      },
    },

    // GET /pages/:slug
    {
      method: 'GET', pattern: /^\/pages\/([^/]+)\/?$/,
      handler: async (_req, res, match) => {
        const page = await brain.get(decodeURIComponent(match[1]));
        if (!page) return error(res, 'Not found', 404);
        json(res, { page });
      },
    },

    // DELETE /pages/:slug
    {
      method: 'DELETE', pattern: /^\/pages\/([^/]+)\/?$/,
      handler: async (_req, res, match) => {
        await brain.delete(decodeURIComponent(match[1]));
        json(res, { ok: true });
      },
    },

    // GET /search
    {
      method: 'GET', pattern: /^\/search\/?$/,
      handler: async (req, res) => {
        const url = new URL(req.url!, `http://${req.headers.host}`);
        const q = url.searchParams.get('q');
        if (!q) return error(res, 'Required: q parameter');
        const limit = parseInt(url.searchParams.get('limit') ?? '10');
        const results = await brain.query(q, { limit });
        json(res, { results });
      },
    },

    // POST /chat
    {
      method: 'POST', pattern: /^\/chat\/?$/,
      handler: async (_req, res, _match, body) => {
        if (!body?.message) return error(res, 'Required: message');
        // Get relevant context via search
        const context = await brain.query(body.message, { limit: 5 });
        json(res, {
          context: context.map(r => ({ slug: r.slug, title: r.title, text: r.chunk_text })),
          message: body.message,
          hint: 'Use the context to answer via your preferred LLM.',
        });
      },
    },

    // POST /inject
    {
      method: 'POST', pattern: /^\/inject\/?$/,
      handler: async (_req, res, _match, body) => {
        if (!body?.context) return error(res, 'Required: context');
        const result = await injectMemories(brain, body.context);
        json(res, { injection: formatInjection(result), memories: result.memories.length, tokens: result.totalTokensEstimate });
      },
    },

    // GET /graph
    {
      method: 'GET', pattern: /^\/graph\/?$/,
      handler: async (_req, res) => {
        const graph = await buildKnowledgeGraph(brain, config.llmConfig ?? {});
        json(res, { graph });
      },
    },

    // GET /stats
    {
      method: 'GET', pattern: /^\/stats\/?$/,
      handler: async (_req, res) => {
        const stats = await brain.stats();
        json(res, { stats });
      },
    },

    // GET /openapi.json
    {
      method: 'GET', pattern: /^\/openapi\.json\/?$/,
      handler: async (_req, res) => {
        json(res, OPENAPI_SPEC);
      },
    },
  ];

  const server = createServer(async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      return res.end();
    }

    const url = new URL(req.url!, `http://${req.headers.host}`);
    const path = url.pathname;

    for (const route of routes) {
      if (req.method === route.method) {
        const match = path.match(route.pattern);
        if (match) {
          try {
            const body = ['POST', 'PUT', 'PATCH'].includes(req.method!) ? await readBody(req) : null;
            await route.handler(req, res, match, body);
          } catch (e: any) {
            error(res, e.message ?? 'Internal error', 500);
          }
          return;
        }
      }
    }

    // 404
    error(res, `Not found: ${req.method} ${path}`, 404);
  });

  server.listen(config.port, config.host, () => {
    console.log(`\n🧠 DeepBrain API Server`);
    console.log(`   http://${config.host}:${config.port}`);
    console.log(`   OpenAPI: http://${config.host}:${config.port}/openapi.json\n`);
    console.log(`   Endpoints:`);
    console.log(`     POST   /pages          — Add knowledge`);
    console.log(`     GET    /pages          — List pages`);
    console.log(`     GET    /pages/:slug    — Get page`);
    console.log(`     DELETE /pages/:slug    — Delete page`);
    console.log(`     GET    /search?q=...   — Semantic search`);
    console.log(`     POST   /chat           — Chat with brain`);
    console.log(`     POST   /inject         — Proactive injection`);
    console.log(`     GET    /graph          — Knowledge graph`);
    console.log(`     GET    /stats          — Statistics`);
    console.log(`     GET    /openapi.json   — API spec\n`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await brain.disconnect();
    server.close();
    process.exit(0);
  });
}
