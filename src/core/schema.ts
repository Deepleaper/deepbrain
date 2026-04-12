/**
 * DeepBrain — Schema (PGLite embedded)
 *
 * Tables: pages, chunks, links, tags, timeline_entries
 * Extensions: pgvector (HNSW index)
 */

export function getSchema(vectorDimensions: number = 1536): string {
  return `
    -- Extensions
    CREATE EXTENSION IF NOT EXISTS vector;

    -- Pages
    CREATE TABLE IF NOT EXISTS pages (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL DEFAULT 'note',
      title TEXT NOT NULL,
      compiled_truth TEXT NOT NULL DEFAULT '',
      timeline TEXT NOT NULL DEFAULT '',
      frontmatter JSONB NOT NULL DEFAULT '{}',
      owner TEXT,
      content_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);
    CREATE INDEX IF NOT EXISTS idx_pages_type ON pages(type);
    CREATE INDEX IF NOT EXISTS idx_pages_owner ON pages(owner);

    -- Full-text search
    ALTER TABLE pages ADD COLUMN IF NOT EXISTS tsv tsvector
      GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(compiled_truth, '') || ' ' || coalesce(timeline, ''))
      ) STORED;
    CREATE INDEX IF NOT EXISTS idx_pages_tsv ON pages USING GIN(tsv);

    -- Chunks
    CREATE TABLE IF NOT EXISTS chunks (
      id SERIAL PRIMARY KEY,
      page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      chunk_source TEXT NOT NULL DEFAULT 'compiled_truth',
      embedding vector(${vectorDimensions}),
      model TEXT,
      token_count INTEGER,
      embedded_at TIMESTAMPTZ,
      UNIQUE(page_id, chunk_index)
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_page ON chunks(page_id);

    -- Links
    CREATE TABLE IF NOT EXISTS links (
      from_slug TEXT NOT NULL,
      to_slug TEXT NOT NULL,
      link_type TEXT NOT NULL DEFAULT 'related',
      context TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (from_slug, to_slug)
    );

    CREATE INDEX IF NOT EXISTS idx_links_to ON links(to_slug);

    -- Tags
    CREATE TABLE IF NOT EXISTS page_tags (
      slug TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (slug, tag)
    );

    CREATE INDEX IF NOT EXISTS idx_tags_tag ON page_tags(tag);

    -- Timeline
    CREATE TABLE IF NOT EXISTS timeline_entries (
      id SERIAL PRIMARY KEY,
      page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_timeline_page ON timeline_entries(page_id);
    CREATE INDEX IF NOT EXISTS idx_timeline_date ON timeline_entries(date);
  `;
}
