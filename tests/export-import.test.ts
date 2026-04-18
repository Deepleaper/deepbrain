/**
 * Export / Import Tests
 */
import { describe, it, expect, vi, afterAll } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync, mkdirSync } from 'fs';

vi.mock('agentkits', () => ({
  createEmbedding: () => ({
    embed: async () => new Float32Array(384).fill(0),
    embedBatch: async (texts: string[]) => texts.map(() => new Float32Array(384).fill(0)),
  }),
}));

import { Brain } from '../src/core/brain.js';

const TEST_BASE = join(tmpdir(), 'deepbrain-test-ei-' + Date.now());
let dbCounter = 0;
function tmpDb() { return join(TEST_BASE, `db-${dbCounter++}`); }

mkdirSync(TEST_BASE, { recursive: true });

afterAll(() => {
  try { rmSync(TEST_BASE, { recursive: true, force: true }); } catch {}
});

describe('Export / Import', () => {

  it('export empty brain returns empty arrays', async () => {
    const b = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await b.connect();
    const data = await b.export();
    expect(data.pages).toEqual([]);
    expect(data.links).toEqual([]);
    expect(data.timeline).toEqual([]);
    await b.disconnect();
  }, 30000);

  it('export brain with pages', async () => {
    const b = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await b.connect();
    await b.put('p1', { type: 'note', title: 'Page 1', compiled_truth: 'content 1' });
    await b.put('p2', { type: 'note', title: 'Page 2', compiled_truth: 'content 2' });
    const data = await b.export();
    expect(data.pages.length).toBe(2);
    expect(data.pages.map(p => p.slug).sort()).toEqual(['p1', 'p2']);
    await b.disconnect();
  }, 30000);

  it('import into fresh brain', async () => {
    const src = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await src.connect();
    await src.put('imp1', { type: 'note', title: 'Import Me', compiled_truth: 'data' });
    const exported = await src.export();
    await src.disconnect();

    const dst = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await dst.connect();
    await dst.import(exported);
    const page = await dst.get('imp1');
    expect(page).not.toBeNull();
    expect(page!.title).toBe('Import Me');
    await dst.disconnect();
  }, 30000);

  it('import with links', async () => {
    const src = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await src.connect();
    await src.put('a', { type: 'note', title: 'A', compiled_truth: 'a' });
    await src.put('b', { type: 'note', title: 'B', compiled_truth: 'b' });
    await src.link('a', 'b', 'related', 'ref');
    const exported = await src.export();
    await src.disconnect();

    const dst = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await dst.connect();
    await dst.import(exported);
    const links = await dst.getLinks('a');
    expect(links.some(l => l.to_slug === 'b')).toBe(true);
    await dst.disconnect();
  }, 30000);

  it('import with timeline entries', async () => {
    const src = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await src.connect();
    await src.put('tl', { type: 'note', title: 'Timeline', compiled_truth: 'content' });
    await src.addTimeline('tl', { date: '2026-01-01', summary: 'Event 1' });
    const exported = await src.export();
    await src.disconnect();

    const dst = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await dst.connect();
    await dst.import(exported);
    const page = await dst.get('tl');
    expect(page).not.toBeNull();
    expect(exported.timeline.length).toBeGreaterThanOrEqual(1);
    await dst.disconnect();
  }, 30000);

  it('import duplicate pages upserts', async () => {
    const b = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await b.connect();
    await b.put('dup', { type: 'note', title: 'Original', compiled_truth: 'v1' });

    await b.import({
      pages: [{
        slug: 'dup', type: 'note', title: 'Updated', compiled_truth: 'v2',
        timeline: '', frontmatter: {},
      } as any],
    });

    const page = await b.get('dup');
    expect(page!.title).toBe('Updated');
    expect(page!.compiled_truth).toBe('v2');
    await b.disconnect();
  }, 30000);

  it('round-trip preserves page types', async () => {
    const src = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await src.connect();
    await src.put('n1', { type: 'note', title: 'Note', compiled_truth: 'a note' });
    await src.put('p1', { type: 'person', title: 'Person', compiled_truth: 'a person' });
    await src.put('c1', { type: 'company', title: 'Company', compiled_truth: 'a company' });
    const exported = await src.export();
    await src.disconnect();

    const dst = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await dst.connect();
    await dst.import(exported);
    expect((await dst.get('n1'))!.type).toBe('note');
    expect((await dst.get('p1'))!.type).toBe('person');
    expect((await dst.get('c1'))!.type).toBe('company');
    await dst.disconnect();
  }, 30000);

  it('round-trip preserves frontmatter', async () => {
    const src = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await src.connect();
    await src.put('fm', {
      type: 'note', title: 'FM', compiled_truth: 'content',
      frontmatter: { custom: 'value', nested: { a: 1 } },
    });
    const exported = await src.export();
    await src.disconnect();

    const dst = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await dst.connect();
    await dst.import(exported);
    const page = await dst.get('fm');
    const fm = typeof page!.frontmatter === 'string' ? JSON.parse(page!.frontmatter) : page!.frontmatter;
    expect(fm.custom).toBe('value');
    await dst.disconnect();
  }, 30000);

  it('import empty data does not crash', async () => {
    const b = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await b.connect();
    await b.import({ pages: [] });
    const data = await b.export();
    expect(data.pages).toEqual([]);
    await b.disconnect();
  }, 30000);
});
