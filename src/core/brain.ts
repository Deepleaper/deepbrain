/**
 * DeepBrain — Brain Engine
 *
 * Core engine that wraps PGLite + agentkits embedding.
 * Provides all CRUD, search, and graph operations.
 */

import { PGlite } from '@electric-sql/pglite';
// @ts-ignore — vector extension
import { vector } from '@electric-sql/pglite/vector';
import { createEmbedding } from 'agentkits';
import type { EmbeddingClient } from 'agentkits';
import { getSchema } from './schema.js';
import type {
  Page, PageInput, PageFilters,
  Chunk, ChunkInput,
  SearchResult, SearchOpts,
  Link, GraphNode,
  TimelineEntry, TimelineInput, TimelineOpts,
  BrainStats, BrainHealth,
  DeepBrainConfig,
} from './types.js';
import { DEFAULT_CONFIG } from './types.js';

export class Brain {
  private db!: PGlite;
  private embedder!: EmbeddingClient;
  private config: DeepBrainConfig;

  constructor(config: Partial<DeepBrainConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  async connect(): Promise<void> {
    this.db = new PGlite(this.config.database, {
      extensions: { vector },
    });

    this.embedder = createEmbedding({
      provider: this.config.embedding_provider as any,
      model: this.config.embedding_model,
      apiKey: this.config.api_key,
    });

    // Get dimensions from a test embed
    const testVec = await this.embedder.embed('test');
    const dims = testVec.length;

    await this.db.exec(getSchema(dims));
  }

  async disconnect(): Promise<void> {
    await this.db.close();
  }

  // ── Pages ──────────────────────────────────────────────────────

  async put(slug: string, input: PageInput): Promise<Page> {
    const hash = this.hashContent(input.compiled_truth + (input.timeline ?? ''));

    const result = await this.db.query<Page>(
      `INSERT INTO pages (slug, type, title, compiled_truth, timeline, frontmatter, owner, content_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (slug) DO UPDATE SET
         type = EXCLUDED.type,
         title = EXCLUDED.title,
         compiled_truth = EXCLUDED.compiled_truth,
         timeline = COALESCE(EXCLUDED.timeline, pages.timeline),
         frontmatter = EXCLUDED.frontmatter,
         owner = COALESCE(EXCLUDED.owner, pages.owner),
         content_hash = EXCLUDED.content_hash,
         updated_at = NOW()
       RETURNING *`,
      [slug, input.type, input.title, input.compiled_truth, input.timeline ?? '', JSON.stringify(input.frontmatter ?? {}), input.owner ?? this.config.owner, hash],
    );

    const page = result.rows[0];

    // Auto-chunk and embed
    await this.chunkAndEmbed(page);

    return page;
  }

  async get(slug: string): Promise<Page | null> {
    const result = await this.db.query<Page>(
      'SELECT * FROM pages WHERE slug = $1',
      [slug],
    );
    return result.rows[0] ?? null;
  }

  async delete(slug: string): Promise<void> {
    await this.db.query('DELETE FROM pages WHERE slug = $1', [slug]);
    await this.db.query('DELETE FROM links WHERE from_slug = $1 OR to_slug = $1', [slug]);
    await this.db.query('DELETE FROM page_tags WHERE slug = $1', [slug]);
  }

  async list(filters: PageFilters = {}): Promise<Page[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.type) { conditions.push(`type = $${idx++}`); params.push(filters.type); }
    if (filters.owner) { conditions.push(`owner = $${idx++}`); params.push(filters.owner); }
    if (filters.tag) {
      conditions.push(`slug IN (SELECT slug FROM page_tags WHERE tag = $${idx++})`);
      params.push(filters.tag);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const result = await this.db.query<Page>(
      `SELECT * FROM pages ${where} ORDER BY updated_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset],
    );
    return result.rows;
  }

  // ── Search ─────────────────────────────────────────────────────

  async query(text: string, opts: SearchOpts = {}): Promise<SearchResult[]> {
    const limit = opts.limit ?? 10;

    // Semantic search
    const embedding = await this.embedder.embed(text);
    const vecArray = `[${Array.from(embedding).join(',')}]`;

    const vectorResults = await this.db.query<SearchResult & { distance: number }>(
      `SELECT p.slug, p.id as page_id, p.title, p.type,
              c.chunk_text, c.chunk_source,
              (c.embedding <=> $1::vector) as distance,
              CASE WHEN p.content_hash IS NULL THEN true ELSE false END as stale
       FROM chunks c
       JOIN pages p ON c.page_id = p.id
       WHERE c.embedding IS NOT NULL
       ${opts.type ? `AND p.type = '${opts.type}'` : ''}
       ${opts.owner ? `AND p.owner = '${opts.owner}'` : ''}
       ORDER BY c.embedding <=> $1::vector
       LIMIT $2`,
      [vecArray, limit * 2],
    );

    // Keyword search
    const keywordResults = await this.db.query<SearchResult>(
      `SELECT slug, id as page_id, title, type,
              ts_headline('simple', compiled_truth, plainto_tsquery('simple', $1)) as chunk_text,
              'compiled_truth' as chunk_source,
              ts_rank(tsv, plainto_tsquery('simple', $1)) as score,
              false as stale
       FROM pages
       WHERE tsv @@ plainto_tsquery('simple', $1)
       ${opts.type ? `AND type = '${opts.type}'` : ''}
       ${opts.owner ? `AND owner = '${opts.owner}'` : ''}
       ORDER BY score DESC
       LIMIT $2`,
      [text, limit],
    );

    // RRF fusion
    return this.rrfFusion(
      vectorResults.rows.map((r, i) => ({ ...r, score: 1 / (60 + i) })),
      keywordResults.rows.map((r, i) => ({ ...r, score: 1 / (60 + i) })),
      limit,
    );
  }

  async search(keyword: string, opts: SearchOpts = {}): Promise<SearchResult[]> {
    const limit = opts.limit ?? 10;
    const result = await this.db.query<SearchResult>(
      `SELECT slug, id as page_id, title, type,
              ts_headline('simple', compiled_truth, plainto_tsquery('simple', $1)) as chunk_text,
              'compiled_truth' as chunk_source,
              ts_rank(tsv, plainto_tsquery('simple', $1)) as score,
              false as stale
       FROM pages
       WHERE tsv @@ plainto_tsquery('simple', $1)
       ${opts.type ? `AND type = '${opts.type}'` : ''}
       ORDER BY score DESC
       LIMIT $2`,
      [keyword, limit],
    );
    return result.rows;
  }

  // ── Links ──────────────────────────────────────────────────────

  async link(from: string, to: string, context: string = '', linkType: string = 'related'): Promise<void> {
    await this.db.query(
      `INSERT INTO links (from_slug, to_slug, link_type, context)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (from_slug, to_slug) DO UPDATE SET link_type = $3, context = $4`,
      [from, to, linkType, context],
    );
  }

  async unlink(from: string, to: string): Promise<void> {
    await this.db.query('DELETE FROM links WHERE from_slug = $1 AND to_slug = $2', [from, to]);
  }

  async getLinks(slug: string): Promise<Link[]> {
    const result = await this.db.query<Link>(
      'SELECT * FROM links WHERE from_slug = $1',
      [slug],
    );
    return result.rows;
  }

  async getBacklinks(slug: string): Promise<Link[]> {
    const result = await this.db.query<Link>(
      'SELECT * FROM links WHERE to_slug = $1',
      [slug],
    );
    return result.rows;
  }

  // ── Tags ───────────────────────────────────────────────────────

  async tag(slug: string, tag: string): Promise<void> {
    await this.db.query(
      'INSERT INTO page_tags (slug, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [slug, tag],
    );
  }

  async untag(slug: string, tag: string): Promise<void> {
    await this.db.query('DELETE FROM page_tags WHERE slug = $1 AND tag = $2', [slug, tag]);
  }

  async getTags(slug: string): Promise<string[]> {
    const result = await this.db.query<{ tag: string }>(
      'SELECT tag FROM page_tags WHERE slug = $1',
      [slug],
    );
    return result.rows.map(r => r.tag);
  }

  // ── Timeline ───────────────────────────────────────────────────

  async addTimeline(slug: string, entry: TimelineInput): Promise<void> {
    const page = await this.get(slug);
    if (!page) throw new Error(`Page not found: ${slug}`);

    await this.db.query(
      `INSERT INTO timeline_entries (page_id, date, source, summary, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [page.id, entry.date, entry.source ?? '', entry.summary, entry.detail ?? ''],
    );
  }

  async getTimeline(slug: string, opts: TimelineOpts = {}): Promise<TimelineEntry[]> {
    const page = await this.get(slug);
    if (!page) return [];

    const conditions = ['page_id = $1'];
    const params: any[] = [page.id];
    let idx = 2;

    if (opts.after) { conditions.push(`date >= $${idx++}`); params.push(opts.after); }
    if (opts.before) { conditions.push(`date <= $${idx++}`); params.push(opts.before); }

    const result = await this.db.query<TimelineEntry>(
      `SELECT * FROM timeline_entries WHERE ${conditions.join(' AND ')}
       ORDER BY date DESC LIMIT $${idx}`,
      [...params, opts.limit ?? 50],
    );
    return result.rows;
  }

  // ── Stats ──────────────────────────────────────────────────────

  async stats(): Promise<BrainStats> {
    const [pages, chunks, embedded, links, tags, timeline] = await Promise.all([
      this.db.query<{ count: string }>('SELECT COUNT(*) as count FROM pages'),
      this.db.query<{ count: string }>('SELECT COUNT(*) as count FROM chunks'),
      this.db.query<{ count: string }>('SELECT COUNT(*) as count FROM chunks WHERE embedding IS NOT NULL'),
      this.db.query<{ count: string }>('SELECT COUNT(*) as count FROM links'),
      this.db.query<{ count: string }>('SELECT COUNT(DISTINCT tag) as count FROM page_tags'),
      this.db.query<{ count: string }>('SELECT COUNT(*) as count FROM timeline_entries'),
    ]);

    const byType = await this.db.query<{ type: string; count: string }>(
      'SELECT type, COUNT(*) as count FROM pages GROUP BY type',
    );

    return {
      page_count: parseInt(pages.rows[0].count),
      chunk_count: parseInt(chunks.rows[0].count),
      embedded_count: parseInt(embedded.rows[0].count),
      link_count: parseInt(links.rows[0].count),
      tag_count: parseInt(tags.rows[0].count),
      timeline_entry_count: parseInt(timeline.rows[0].count),
      pages_by_type: Object.fromEntries(byType.rows.map(r => [r.type, parseInt(r.count)])),
    };
  }

  // ── Batch Operations ────────────────────────────────────────────

  /**
   * Batch put multiple pages at once.
   * Collects all chunks, embeds in one batch call → 10x faster for bulk import.
   */
  async putBatch(inputs: Array<{ slug: string; input: PageInput }>): Promise<Page[]> {
    const pages: Page[] = [];
    const allChunks: Array<{ pageId: number; index: number; text: string }> = [];

    // Insert all pages first (without embedding)
    for (const { slug, input } of inputs) {
      const hash = this.hashContent(input.compiled_truth + (input.timeline ?? ''));
      const result = await this.db.query<Page>(
        `INSERT INTO pages (slug, type, title, compiled_truth, timeline, frontmatter, owner, content_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (slug) DO UPDATE SET
           type = EXCLUDED.type, title = EXCLUDED.title,
           compiled_truth = EXCLUDED.compiled_truth,
           timeline = COALESCE(EXCLUDED.timeline, pages.timeline),
           frontmatter = EXCLUDED.frontmatter,
           owner = COALESCE(EXCLUDED.owner, pages.owner),
           content_hash = EXCLUDED.content_hash, updated_at = NOW()
         RETURNING *`,
        [slug, input.type, input.title, input.compiled_truth, input.timeline ?? '', JSON.stringify(input.frontmatter ?? {}), input.owner ?? this.config.owner, hash],
      );
      const page = result.rows[0];
      pages.push(page);

      // Chunk the text
      const text = page.compiled_truth + '\n\n' + page.timeline;
      const rawChunks = text.split(/\n{2,}/).filter(c => c.trim().length > 10);
      const chunks: string[] = [];
      let buffer = '';
      for (const raw of rawChunks) {
        if (buffer.length + raw.length > 500 && buffer.length > 0) {
          chunks.push(buffer.trim());
          buffer = raw;
        } else {
          buffer += (buffer ? '\n\n' : '') + raw;
        }
      }
      if (buffer.trim()) chunks.push(buffer.trim());

      // Delete old chunks
      await this.db.query('DELETE FROM chunks WHERE page_id = $1', [page.id]);

      for (let i = 0; i < chunks.length; i++) {
        allChunks.push({ pageId: page.id, index: i, text: chunks[i] });
      }
    }

    if (allChunks.length === 0) return pages;

    // Batch embed all chunks at once — single API call
    const BATCH_SIZE = 96;
    for (let offset = 0; offset < allChunks.length; offset += BATCH_SIZE) {
      const batch = allChunks.slice(offset, offset + BATCH_SIZE);
      const embeddings = await this.embedder.embedBatch(batch.map(c => c.text));

      for (let i = 0; i < batch.length; i++) {
        const { pageId, index, text } = batch[i];
        const vecArray = `[${Array.from(embeddings[i]).join(',')}]`;
        await this.db.query(
          `INSERT INTO chunks (page_id, chunk_index, chunk_text, chunk_source, embedding, model, embedded_at)
           VALUES ($1, $2, $3, 'compiled_truth', $4::vector, $5, NOW())`,
          [pageId, index, text, vecArray, this.config.embedding_model ?? 'default'],
        );
      }
    }

    return pages;
  }

  // ── Internal ───────────────────────────────────────────────────

  private async chunkAndEmbed(page: Page): Promise<void> {
    // Simple chunking: split by double newlines, max ~500 chars
    const text = page.compiled_truth + '\n\n' + page.timeline;
    const rawChunks = text.split(/\n{2,}/).filter(c => c.trim().length > 10);

    // Merge small chunks, split large ones
    const chunks: string[] = [];
    let buffer = '';
    for (const raw of rawChunks) {
      if (buffer.length + raw.length > 500 && buffer.length > 0) {
        chunks.push(buffer.trim());
        buffer = raw;
      } else {
        buffer += (buffer ? '\n\n' : '') + raw;
      }
    }
    if (buffer.trim()) chunks.push(buffer.trim());

    if (chunks.length === 0) return;

    // Batch embed
    const embeddings = await this.embedder.embedBatch(chunks);

    // Delete old chunks
    await this.db.query('DELETE FROM chunks WHERE page_id = $1', [page.id]);

    // Insert new chunks
    for (let i = 0; i < chunks.length; i++) {
      const vecArray = `[${Array.from(embeddings[i]).join(',')}]`;
      await this.db.query(
        `INSERT INTO chunks (page_id, chunk_index, chunk_text, chunk_source, embedding, model, embedded_at)
         VALUES ($1, $2, $3, 'compiled_truth', $4::vector, $5, NOW())`,
        [page.id, i, chunks[i], vecArray, this.config.embedding_model ?? 'default'],
      );
    }
  }

  private rrfFusion(vectorResults: SearchResult[], keywordResults: SearchResult[], limit: number): SearchResult[] {
    const scores = new Map<string, { result: SearchResult; score: number }>();

    for (const r of vectorResults) {
      const key = `${r.slug}:${r.chunk_text.slice(0, 50)}`;
      const existing = scores.get(key);
      scores.set(key, {
        result: r,
        score: (existing?.score ?? 0) + r.score,
      });
    }

    for (const r of keywordResults) {
      const key = `${r.slug}:${r.chunk_text.slice(0, 50)}`;
      const existing = scores.get(key);
      scores.set(key, {
        result: existing?.result ?? r,
        score: (existing?.score ?? 0) + r.score,
      });
    }

    return Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => ({ ...s.result, score: s.score }));
  }

  private hashContent(text: string): string {
    // Simple hash — good enough for change detection
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString(36);
  }
}
