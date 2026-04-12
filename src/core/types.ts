/**
 * DeepBrain — Core Types
 *
 * Inspired by GBrain, with key improvements:
 * - PageType is user-extensible (not hardcoded)
 * - Multi-user support via owner field
 * - Chinese-friendly from day one
 */

// ── Page ───────────────────────────────────────────────────────────

export interface Page {
  id: number;
  slug: string;
  type: string;                    // User-extensible, not hardcoded enum
  title: string;
  compiled_truth: string;          // Current facts (overwritable)
  timeline: string;                // Historical events (append-only)
  frontmatter: Record<string, unknown>;
  owner?: string;                  // Multi-user support
  content_hash?: string;
  created_at: Date;
  updated_at: Date;
}

export interface PageInput {
  type: string;
  title: string;
  compiled_truth: string;
  timeline?: string;
  frontmatter?: Record<string, unknown>;
  owner?: string;
}

export interface PageFilters {
  type?: string;
  tag?: string;
  owner?: string;
  limit?: number;
  offset?: number;
}

// ── Chunk ──────────────────────────────────────────────────────────

export interface Chunk {
  id: number;
  page_id: number;
  chunk_index: number;
  chunk_text: string;
  chunk_source: 'compiled_truth' | 'timeline';
  embedding: Float32Array | null;
  model: string;
  token_count: number | null;
  embedded_at: Date | null;
}

export interface ChunkInput {
  chunk_index: number;
  chunk_text: string;
  chunk_source: 'compiled_truth' | 'timeline';
  embedding?: Float32Array;
  model?: string;
  token_count?: number;
}

// ── Search ─────────────────────────────────────────────────────────

export interface SearchResult {
  slug: string;
  page_id: number;
  title: string;
  type: string;
  chunk_text: string;
  chunk_source: 'compiled_truth' | 'timeline';
  score: number;
  stale: boolean;
}

export interface SearchOpts {
  limit?: number;
  type?: string;
  owner?: string;
  exclude_slugs?: string[];
}

// ── Link ───────────────────────────────────────────────────────────

export interface Link {
  from_slug: string;
  to_slug: string;
  link_type: string;
  context: string;
}

export interface GraphNode {
  slug: string;
  title: string;
  type: string;
  depth: number;
  links: { to_slug: string; link_type: string }[];
}

// ── Timeline ───────────────────────────────────────────────────────

export interface TimelineEntry {
  id: number;
  page_id: number;
  date: string;
  source: string;
  summary: string;
  detail: string;
  created_at: Date;
}

export interface TimelineInput {
  date: string;
  source?: string;
  summary: string;
  detail?: string;
}

export interface TimelineOpts {
  limit?: number;
  after?: string;
  before?: string;
}

// ── Stats ──────────────────────────────────────────────────────────

export interface BrainStats {
  page_count: number;
  chunk_count: number;
  embedded_count: number;
  link_count: number;
  tag_count: number;
  timeline_entry_count: number;
  pages_by_type: Record<string, number>;
}

export interface BrainHealth {
  page_count: number;
  embed_coverage: number;
  stale_pages: number;
  orphan_pages: number;
  dead_links: number;
  missing_embeddings: number;
}

// ── Config ─────────────────────────────────────────────────────────

export interface DeepBrainConfig {
  /** Storage engine: 'pglite' (embedded) or 'postgres' (external) */
  engine: 'pglite' | 'postgres';
  /** Database path for pglite, or connection URL for postgres */
  database: string;
  /** Embedding provider (via agentkits) */
  embedding_provider: string;
  /** Embedding model override */
  embedding_model?: string;
  /** API key for embedding provider */
  api_key?: string;
  /** LLM provider for Dream Cycle */
  llm_provider?: string;
  /** LLM model override */
  llm_model?: string;
  /** Data directory for brain files */
  data_dir: string;
  /** Owner ID (for multi-user) */
  owner?: string;
}

export const DEFAULT_CONFIG: DeepBrainConfig = {
  engine: 'pglite',
  database: './deepbrain-data',
  embedding_provider: 'ollama',
  data_dir: './brain',
};
