/**
 * Brain Core Tests — No API key required
 *
 * Mocks the embedding layer so all CRUD/search/export/import operations
 * can be tested without an external embedding provider.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync, mkdirSync } from 'fs';

// Mock agentkits before importing Brain
vi.mock('agentkits', () => ({
  createEmbedding: () => ({
    embed: async () => new Float32Array(384).fill(0),
    embedBatch: async (texts: string[]) => texts.map(() => new Float32Array(384).fill(0)),
  }),
}));

import { Brain } from '../src/core/brain.js';

const TEST_BASE = join(tmpdir(), 'deepbrain-test-core-' + Date.now());
let dbCounter = 0;
function tmpDb() { return join(TEST_BASE, `db-${dbCounter++}`); }

describe('Brain Core (no API key)', () => {
  let brain: Brain;

  beforeAll(async () => {
    mkdirSync(TEST_BASE, { recursive: true });
    brain = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await brain.connect();
  }, 30000);

  afterAll(async () => {
    try { await brain.disconnect(); } catch {}
    try { rmSync(TEST_BASE, { recursive: true, force: true }); } catch {}
  });

  // ── Constructor & Lifecycle ──────────────────────────

  it('creates a Brain instance', () => {
    expect(brain).toBeDefined();
  });

  it('double connect does not crash', async () => {
    const b2 = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await b2.connect();
    await b2.connect();
    await b2.disconnect();
  }, 30000);

  it('disconnect works', async () => {
    const b2 = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await b2.connect();
    await expect(b2.disconnect()).resolves.not.toThrow();
  }, 30000);

  // ── Pages CRUD ───────────────────────────────────────

  it('put() stores a page', async () => {
    const page = await brain.put('hello', {
      type: 'note',
      title: 'Hello',
      compiled_truth: 'Hello world content',
    });
    expect(page).toBeDefined();
    expect(page.slug).toBe('hello');
  }, 15000);

  it('get() retrieves stored page', async () => {
    const page = await brain.get('hello');
    expect(page).not.toBeNull();
    expect(page!.title).toBe('Hello');
    expect(page!.compiled_truth).toContain('Hello world');
  });

  it('get() returns null for non-existent', async () => {
    const page = await brain.get('does-not-exist');
    expect(page).toBeNull();
  });

  it('put() upserts on duplicate slug', async () => {
    await brain.put('upsert-me', { type: 'note', title: 'V1', compiled_truth: 'first' });
    await brain.put('upsert-me', { type: 'note', title: 'V2', compiled_truth: 'second' });
    const page = await brain.get('upsert-me');
    expect(page!.title).toBe('V2');
    expect(page!.compiled_truth).toBe('second');
  }, 15000);

  it('delete() removes page', async () => {
    await brain.put('del-me', { type: 'note', title: 'Gone', compiled_truth: 'bye' });
    await brain.delete('del-me');
    expect(await brain.get('del-me')).toBeNull();
  }, 15000);

  // ── List ─────────────────────────────────────────────

  it('list() returns all pages', async () => {
    const pages = await brain.list();
    expect(pages.length).toBeGreaterThanOrEqual(1);
  });

  it('list() with limit', async () => {
    await brain.put('list-a', { type: 'note', title: 'A', compiled_truth: 'a' });
    await brain.put('list-b', { type: 'note', title: 'B', compiled_truth: 'b' });
    await brain.put('list-c', { type: 'note', title: 'C', compiled_truth: 'c' });
    const pages = await brain.list({ limit: 2 });
    expect(pages.length).toBe(2);
  }, 15000);

  it('list() with type filter', async () => {
    await brain.put('person-1', { type: 'person', title: 'Alice', compiled_truth: 'a person' });
    const persons = await brain.list({ type: 'person' });
    expect(persons.every(p => p.type === 'person')).toBe(true);
    expect(persons.length).toBeGreaterThanOrEqual(1);
  }, 15000);

  it('multiple pages: list returns correct count', async () => {
    const b = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await b.connect();
    await b.put('p1', { type: 'note', title: '1', compiled_truth: 'one' });
    await b.put('p2', { type: 'note', title: '2', compiled_truth: 'two' });
    await b.put('p3', { type: 'note', title: '3', compiled_truth: 'three' });
    const pages = await b.list();
    expect(pages.length).toBe(3);
    await b.disconnect();
  }, 30000);

  // ── Search ───────────────────────────────────────────

  it('search() finds by keyword', async () => {
    await brain.put('searchable', {
      type: 'note',
      title: 'Quantum Computing',
      compiled_truth: 'Quantum computing uses qubits for parallel computation',
    });
    const results = await brain.search('quantum');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].slug).toBe('searchable');
  }, 15000);

  it('search() returns empty for no match', async () => {
    const results = await brain.search('xyznonexistent98765');
    expect(results).toEqual([]);
  });

  // ── Tags ─────────────────────────────────────────────

  it('tag and getTags', async () => {
    await brain.put('tagged-page', { type: 'note', title: 'Tagged', compiled_truth: 'content' });
    await brain.tag('tagged-page', 'important');
    await brain.tag('tagged-page', 'ai');
    const tags = await brain.getTags('tagged-page');
    expect(tags).toContain('important');
    expect(tags).toContain('ai');
  }, 15000);

  it('untag removes tag', async () => {
    await brain.untag('tagged-page', 'important');
    const tags = await brain.getTags('tagged-page');
    expect(tags).not.toContain('important');
    expect(tags).toContain('ai');
  });

  it('list() with tag filter', async () => {
    const pages = await brain.list({ tag: 'ai' });
    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(pages.some(p => p.slug === 'tagged-page')).toBe(true);
  });

  // ── Stats ────────────────────────────────────────────

  it('stats() returns correct structure', async () => {
    const stats = await brain.stats();
    expect(stats.page_count).toBeGreaterThan(0);
    expect(typeof stats.chunk_count).toBe('number');
    expect(typeof stats.embedded_count).toBe('number');
    expect(typeof stats.link_count).toBe('number');
    expect(typeof stats.tag_count).toBe('number');
    expect(typeof stats.timeline_entry_count).toBe('number');
    expect(stats.pages_by_type).toBeDefined();
  });

  // ── Links ────────────────────────────────────────────

  it('link and getLinks', async () => {
    await brain.put('company-x', { type: 'company', title: 'X Corp', compiled_truth: 'tech co' });
    await brain.link('person-1', 'company-x', 'works at', 'employment');
    const links = await brain.getLinks('person-1');
    expect(links.some(l => l.to_slug === 'company-x')).toBe(true);
  }, 15000);

  it('getBacklinks', async () => {
    const backlinks = await brain.getBacklinks('company-x');
    expect(backlinks.some(l => l.from_slug === 'person-1')).toBe(true);
  });

  it('unlink removes link', async () => {
    await brain.unlink('person-1', 'company-x');
    const links = await brain.getLinks('person-1');
    expect(links.some(l => l.to_slug === 'company-x')).toBe(false);
  });

  // ── Timeline ─────────────────────────────────────────

  it('addTimeline and getTimeline', async () => {
    await brain.addTimeline('hello', { date: '2026-04-18', summary: 'Created', detail: 'Test entry' });
    const entries = await brain.getTimeline('hello');
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].summary).toBe('Created');
  });

  it('getTimeline returns empty for non-existent page', async () => {
    const entries = await brain.getTimeline('no-such-page');
    expect(entries).toEqual([]);
  });

  // ── Export / Import ──────────────────────────────────

  it('export() returns data', async () => {
    const data = await brain.export();
    expect(data.pages).toBeDefined();
    expect(data.links).toBeDefined();
    expect(data.timeline).toBeDefined();
    expect(data.pages.length).toBeGreaterThan(0);
  });

  it('round-trip: put → export → import → get matches', async () => {
    await brain.put('roundtrip', { type: 'note', title: 'RT', compiled_truth: 'round trip data' });
    const exported = await brain.export();

    const b2 = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await b2.connect();
    await b2.import(exported);

    const page = await b2.get('roundtrip');
    expect(page).not.toBeNull();
    expect(page!.title).toBe('RT');
    expect(page!.compiled_truth).toBe('round trip data');
    await b2.disconnect();
  }, 30000);
});
