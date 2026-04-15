/**
 * DeepBrain — API Client SDK (v1.4.0)
 *
 * TypeScript SDK for DeepBrain REST API.
 * Works with `deepbrain serve` or any compatible server.
 *
 * Usage:
 *   const db = new DeepBrainClient({ url: 'http://localhost:3333' });
 *   await db.addPage({ slug: 'test', title: 'Test', content: 'Hello' });
 *   const results = await db.search('hello');
 */

// ── Types ─────────────────────────────────────────────────────────

export interface DeepBrainClientConfig {
  /** Base URL of DeepBrain server (e.g. http://localhost:3333) */
  url: string;
  /** API key for authentication (optional, for future use) */
  apiKey?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}

export interface SDKPage {
  slug: string;
  title: string;
  type: string;
  content?: string;
  compiled_truth?: string;
  timeline?: string;
  frontmatter?: Record<string, unknown>;
  owner?: string;
  updated_at?: string;
  created_at?: string;
}

export interface SDKSearchResult {
  slug: string;
  page_id: number;
  title: string;
  type: string;
  chunk_text: string;
  chunk_source: string;
  score: number;
}

export interface SDKChatResponse {
  context: Array<{ slug: string; title: string; text: string }>;
  message: string;
}

export interface SDKStats {
  page_count: number;
  chunk_count: number;
  embedded_count: number;
  link_count: number;
  tag_count: number;
  timeline_entry_count: number;
  pages_by_type: Record<string, number>;
}

export interface SDKGraphData {
  nodes: Array<{ slug: string; title: string; type: string }>;
  edges: Array<{ from: string; to: string; type: string }>;
}

// ── Client ────────────────────────────────────────────────────────

export class DeepBrainClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(config: DeepBrainClientConfig) {
    this.baseUrl = config.url.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 30000;
  }

  // ── Pages ────────────────────────────────────────────────────

  /**
   * Add or update a page in the brain.
   */
  async addPage(page: { slug: string; title: string; content: string; type?: string; timeline?: string; frontmatter?: Record<string, unknown> }): Promise<SDKPage> {
    const res = await this.post('/pages', page);
    return res.page;
  }

  /**
   * Get a page by slug.
   */
  async getPage(slug: string): Promise<SDKPage | null> {
    try {
      const res = await this.get(`/pages/${encodeURIComponent(slug)}`);
      return res.page;
    } catch (e: any) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  /**
   * List pages with optional filters.
   */
  async listPages(opts?: { type?: string; limit?: number }): Promise<SDKPage[]> {
    const params = new URLSearchParams();
    if (opts?.type) params.set('type', opts.type);
    if (opts?.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    const res = await this.get(`/pages${qs ? `?${qs}` : ''}`);
    return res.pages;
  }

  /**
   * Delete a page by slug.
   */
  async deletePage(slug: string): Promise<void> {
    await this.del(`/pages/${encodeURIComponent(slug)}`);
  }

  // ── Search ───────────────────────────────────────────────────

  /**
   * Semantic search across the brain.
   */
  async search(query: string, opts?: { limit?: number }): Promise<SDKSearchResult[]> {
    const params = new URLSearchParams({ q: query });
    if (opts?.limit) params.set('limit', String(opts.limit));
    const res = await this.get(`/search?${params}`);
    return res.results;
  }

  // ── Chat ─────────────────────────────────────────────────────

  /**
   * Chat with the brain (RAG-style context retrieval).
   */
  async chat(message: string): Promise<SDKChatResponse> {
    return await this.post('/chat', { message });
  }

  // ── Stats & Graph ────────────────────────────────────────────

  /**
   * Get brain statistics.
   */
  async getStats(): Promise<SDKStats> {
    const res = await this.get('/stats');
    return res.stats;
  }

  /**
   * Get knowledge graph.
   */
  async getGraph(): Promise<SDKGraphData> {
    const res = await this.get('/graph');
    return res.graph;
  }

  // ── Tags ─────────────────────────────────────────────────────

  /**
   * Get tags for a page (via page data).
   */
  async getTags(slug: string): Promise<string[]> {
    const page = await this.getPage(slug);
    if (!page) return [];
    const fm = page.frontmatter as any;
    return fm?.auto_tags ?? [];
  }

  // ── Inject ───────────────────────────────────────────────────

  /**
   * Proactive memory injection.
   */
  async inject(context: string): Promise<{ injection: string; memories: number; tokens: number }> {
    return await this.post('/inject', { context });
  }

  // ── HTTP helpers ─────────────────────────────────────────────

  private async get(path: string): Promise<any> {
    return this.request('GET', path);
  }

  private async post(path: string, body: any): Promise<any> {
    return this.request('POST', path, body);
  }

  private async del(path: string): Promise<any> {
    return this.request('DELETE', path);
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const err: any = new Error(data?.error || `HTTP ${response.status}`);
        err.status = response.status;
        err.data = data;
        throw err;
      }

      return data;
    } finally {
      clearTimeout(timer);
    }
  }
}
