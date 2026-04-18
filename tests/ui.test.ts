/**
 * DeepBrain — UI Server Tests
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { BrainUI } from '../src/ui/server.js';
import { join } from 'node:path';

// Mock brain for testing
function createMockBrain() {
  const pages = [
    { slug: 'test-page', type: 'note', title: 'Test Page', compiled_truth: 'Hello world', updated_at: new Date().toISOString(), frontmatter: {} },
    { slug: 'second', type: 'knowledge', title: 'Second', compiled_truth: 'More content', updated_at: new Date().toISOString(), frontmatter: {} },
  ];
  return {
    list: async () => pages,
    get: async (slug: string) => pages.find(p => p.slug === slug) ?? null,
    put: async (slug: string, input: any) => ({ slug, ...input, updated_at: new Date().toISOString() }),
    delete: async (slug: string) => {},
    query: async (q: string) => [{ slug: 'test-page', title: 'Test Page', type: 'note', chunk_text: 'Hello world', score: 0.95 }],
    search: async (q: string) => [{ slug: 'test-page', title: 'Test Page', type: 'note', chunk_text: 'Hello world', score: 0.8 }],
    stats: async () => ({
      page_count: 2, chunk_count: 4, embedded_count: 4,
      link_count: 1, tag_count: 3, timeline_entry_count: 0,
      pages_by_type: { note: 1, knowledge: 1 },
    }),
    getTimeline: async (slug: string) => [],
    getTags: async (slug: string) => ['ai', 'test'],
    getLinks: async (slug: string) => [],
    tag: async (slug: string, tag: string) => {},
  };
}

function get(port: number, path: string): Promise<{ status: number; body: any; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${path}`, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let body: any = data;
        try { body = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode!, body, headers: res.headers as any });
      });
    }).on('error', reject);
  });
}

function req(port: number, method: string, path: string, body?: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const r = http.request(`http://127.0.0.1:${port}${path}`, { method, headers: { 'Content-Type': 'application/json' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let parsed: any = data;
        try { parsed = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode!, body: parsed });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

describe('BrainUI', () => {
  const PORT = 14001;
  let ui: BrainUI;

  beforeAll(async () => {
    ui = new BrainUI({
      port: PORT,
      brain: createMockBrain(),
      staticDir: join(import.meta.dirname ?? __dirname, '..', 'src', 'ui'),
    });
    await ui.start();
  });

  afterAll(async () => {
    await ui.stop();
  });

  it('constructor uses defaults', () => {
    const u = new BrainUI();
    expect(u).toBeDefined();
  });

  it('GET /api/pages returns list', async () => {
    const { status, body } = await get(PORT, '/api/pages');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(2);
    expect(body[0].slug).toBe('test-page');
  });

  it('GET /api/stats returns stats', async () => {
    const { status, body } = await get(PORT, '/api/stats');
    expect(status).toBe(200);
    expect(body.page_count).toBe(2);
    expect(body.chunk_count).toBe(4);
    expect(body.tag_count).toBe(3);
  });

  it('GET /api/search?q=hello returns results', async () => {
    const { status, body } = await get(PORT, '/api/search?q=hello');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].slug).toBe('test-page');
  });

  it('GET /api/search/keyword?q=hello returns results', async () => {
    const { status, body } = await get(PORT, '/api/search/keyword?q=hello');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('unknown API route returns 404', async () => {
    const { status, body } = await get(PORT, '/api/nonexistent');
    expect(status).toBe(404);
    expect(body.error).toBe('Not found');
  });

  it('has CORS headers', async () => {
    const { headers } = await get(PORT, '/api/stats');
    expect(headers['access-control-allow-origin']).toBe('*');
  });

  it('serves static index.html', async () => {
    const { status, headers } = await get(PORT, '/');
    expect(status).toBe(200);
    expect(headers['content-type']).toContain('text/html');
  });

  it('GET /api/pages/:slug returns page with tags', async () => {
    const { status, body } = await get(PORT, '/api/pages/test-page');
    expect(status).toBe(200);
    expect(body.slug).toBe('test-page');
    expect(body.tags).toContain('ai');
  });

  it('PUT /api/pages/:slug updates page', async () => {
    const { status, body } = await req(PORT, 'PUT', '/api/pages/new-page', {
      type: 'note', title: 'New', compiled_truth: 'Content',
    });
    expect(status).toBe(200);
    expect(body.slug).toBe('new-page');
  });

  it('GET /api/tags returns tag list', async () => {
    const { status, body } = await get(PORT, '/api/tags');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('GET /api/graph returns nodes and edges', async () => {
    const { status, body } = await get(PORT, '/api/graph');
    expect(status).toBe(200);
    expect(body.nodes).toBeDefined();
    expect(body.edges).toBeDefined();
  });
});
