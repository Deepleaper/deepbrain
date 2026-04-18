/**
 * Comprehensive Tests — Dream, Memory Tiers, Knowledge Graph, RAG Pipeline, Evolve edge cases
 * No API key required — mocks embedding & chat layers.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync, mkdirSync } from 'fs';

// Mock agentkits before importing anything
vi.mock('agentkits', () => ({
  createEmbedding: () => ({
    embed: async () => new Float32Array(384).fill(0),
    embedBatch: async (texts: string[]) => texts.map(() => new Float32Array(384).fill(0)),
  }),
  createChat: () => ({
    chat: async () => ({
      content: JSON.stringify({
        entities: [
          { name: 'TestEntity', type: 'concept' },
          { name: 'AnotherEntity', type: 'technology' },
        ],
        relationships: [
          { from: 'TestEntity', to: 'AnotherEntity', type: 'relates_to', context: 'test' },
        ],
      }),
    }),
  }),
}));

import { Brain } from '../src/core/brain.js';
import { dream } from '../src/dream/index.js';
import {
  getPageTier,
  getByTier,
  getTierStats,
  recordAccess,
  setTier,
  runTierCycle,
  getCoreContext,
  DEFAULT_TIER_CONFIG,
} from '../src/memory-tiers.js';
import { extractEntities } from '../src/knowledge-graph.js';
import { RAGPipeline } from '../src/rag/pipeline.js';
import { DocumentParser } from '../src/rag/parser.js';
import { Chunker } from '../src/rag/chunker.js';
import { Reranker } from '../src/rag/reranker.js';
import {
  extractKeywords,
  similarity,
  clusterTraces,
  dedupSentences,
  consolidateMerge,
  consolidateSummarize,
  consolidateExtract,
} from '../src/evolve/index.js';
import type { TraceItem } from '../src/evolve/index.js';

const TEST_BASE = join(tmpdir(), 'deepbrain-comprehensive-' + Date.now());
let dbCounter = 0;
function tmpDb() { return join(TEST_BASE, `db-${dbCounter++}`); }

// ═══════════════════════════════════════════════════════════════
// Dream Module (mocked — no API key)
// ═══════════════════════════════════════════════════════════════

describe('Dream Cycle (mocked)', () => {
  let brain: Brain;

  beforeAll(async () => {
    mkdirSync(TEST_BASE, { recursive: true });
    brain = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await brain.connect();
    await brain.put('dream-a', { type: 'note', title: 'Dream A', compiled_truth: 'Quantum computing basics.' });
    await brain.put('dream-b', { type: 'note', title: 'Dream B', compiled_truth: 'Blockchain decentralization.' });
  }, 30000);

  afterAll(async () => {
    try { await brain.disconnect(); } catch {}
  });

  it('dream returns a report with timestamps', async () => {
    const report = await dream(brain, { tasks: ['stale', 'stats'] });
    expect(report.started_at).toBeInstanceOf(Date);
    expect(report.finished_at).toBeInstanceOf(Date);
    expect(report.finished_at.getTime()).toBeGreaterThanOrEqual(report.started_at.getTime());
  });

  it('dream refreshes stale pages', async () => {
    const report = await dream(brain, { tasks: ['stale'], batchSize: 10 });
    expect(report.stale_refreshed).toBeGreaterThanOrEqual(2);
    expect(report.errors).toHaveLength(0);
  });

  it('dream with empty brain does not crash', async () => {
    const emptyBrain = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await emptyBrain.connect();
    const report = await dream(emptyBrain, { tasks: ['stale', 'stats'] });
    expect(report.stale_refreshed).toBe(0);
    await emptyBrain.disconnect();
  }, 15000);

  it('dream with specific tasks only runs those', async () => {
    const report = await dream(brain, { tasks: ['stats'] });
    expect(report.stale_refreshed).toBe(0);
  });

  it('dream with batchSize=1 limits refresh count', async () => {
    const report = await dream(brain, { tasks: ['stale'], batchSize: 1 });
    expect(report.stale_refreshed).toBe(1);
  });

  it('dream default config uses all tasks', async () => {
    const report = await dream(brain);
    expect(report.stale_refreshed).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Memory Tiers
// ═══════════════════════════════════════════════════════════════

describe('Memory Tiers', () => {
  let brain: Brain;

  beforeAll(async () => {
    brain = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await brain.connect();
    await brain.put('tier-core', { type: 'note', title: 'Core', compiled_truth: 'Important.', frontmatter: { tier: 'core' } });
    await brain.put('tier-working', { type: 'note', title: 'Working', compiled_truth: 'Current.', frontmatter: { tier: 'working' } });
    await brain.put('tier-archival', { type: 'note', title: 'Archival', compiled_truth: 'Old stuff.', frontmatter: { tier: 'archival' } });
    await brain.put('tier-none', { type: 'note', title: 'No Tier', compiled_truth: 'Untagged.' });
  }, 30000);

  afterAll(async () => {
    try { await brain.disconnect(); } catch {}
  });

  it('getPageTier returns correct tier from frontmatter', async () => {
    const core = await brain.get('tier-core');
    expect(getPageTier(core!)).toBe('core');
    const working = await brain.get('tier-working');
    expect(getPageTier(working!)).toBe('working');
  });

  it('getPageTier defaults to archival when no tier set', async () => {
    const noTier = await brain.get('tier-none');
    expect(getPageTier(noTier!)).toBe('archival');
  });

  it('getByTier filters correctly', async () => {
    const corePages = await getByTier(brain, 'core');
    expect(corePages.length).toBe(1);
    expect(corePages[0].slug).toBe('tier-core');
  });

  it('getTierStats counts all tiers', async () => {
    const stats = await getTierStats(brain);
    expect(stats.core).toBe(1);
    expect(stats.working).toBe(1);
    expect(stats.archival).toBe(2); // tier-archival + tier-none (defaults to archival)
  });

  it('setTier changes page tier', async () => {
    await setTier(brain, 'tier-working', 'core');
    const page = await brain.get('tier-working');
    expect(page!.frontmatter).toHaveProperty('tier', 'core');
    // restore
    await setTier(brain, 'tier-working', 'working');
  });

  it('setTier throws for nonexistent page', async () => {
    await expect(setTier(brain, 'nonexistent-slug', 'core')).rejects.toThrow('Page not found');
  });

  it('recordAccess increments access_count', async () => {
    await recordAccess(brain, 'tier-core');
    await recordAccess(brain, 'tier-core');
    const page = await brain.get('tier-core');
    expect((page!.frontmatter as any).access_count).toBeGreaterThanOrEqual(2);
    expect((page!.frontmatter as any).last_access).toBeDefined();
  });

  it('recordAccess on nonexistent page does nothing', async () => {
    await expect(recordAccess(brain, 'no-such-page')).resolves.toBeUndefined();
  });

  it('runTierCycle promotes high-access pages', async () => {
    // Set up a working page with high access count
    await brain.put('promote-me', {
      type: 'note', title: 'Promote', compiled_truth: 'Hot.',
      frontmatter: { tier: 'working', access_count: 10, last_access: new Date().toISOString() },
    });
    const result = await runTierCycle(brain, { promoteThreshold: 5 });
    expect(result.promoted).toContain('promote-me');
  });

  it('runTierCycle demotes old unused pages', async () => {
    const oldDate = new Date(Date.now() - 60 * 86400000).toISOString(); // 60 days ago
    await brain.put('demote-me', {
      type: 'note', title: 'Old', compiled_truth: 'Stale.',
      frontmatter: { tier: 'working', access_count: 0, last_access: oldDate },
    });
    const result = await runTierCycle(brain, { demoteDays: 30 });
    expect(result.demoted).toContain('demote-me');
  });

  it('getCoreContext returns formatted string for core pages', async () => {
    const ctx = await getCoreContext(brain);
    expect(ctx).toContain('Core Memories');
  });

  it('getCoreContext returns empty for brain with no core pages', async () => {
    const emptyBrain = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await emptyBrain.connect();
    const ctx = await getCoreContext(emptyBrain);
    expect(ctx).toBe('');
    await emptyBrain.disconnect();
  }, 15000);

  it('DEFAULT_TIER_CONFIG has sensible defaults', () => {
    expect(DEFAULT_TIER_CONFIG.promoteThreshold).toBeGreaterThan(0);
    expect(DEFAULT_TIER_CONFIG.demoteDays).toBeGreaterThan(0);
    expect(DEFAULT_TIER_CONFIG.coreMaxItems).toBeGreaterThan(0);
    expect(DEFAULT_TIER_CONFIG.workingMaxItems).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Knowledge Graph (mocked LLM)
// ═══════════════════════════════════════════════════════════════

describe('Knowledge Graph (mocked)', () => {
  it('extractEntities returns entities and relationships', async () => {
    const result = await extractEntities('Test text about AI and computing', {});
    expect(result.entities).toHaveLength(2);
    expect(result.entities[0].name).toBe('TestEntity');
    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0].type).toBe('relates_to');
  });

  it('extractEntities handles empty text', async () => {
    const result = await extractEntities('', {});
    expect(result.entities).toBeDefined();
  });

  it('extractEntities truncates long text', async () => {
    const longText = 'A'.repeat(10000);
    const result = await extractEntities(longText, {});
    expect(result.entities).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// RAG Pipeline Edge Cases
// ═══════════════════════════════════════════════════════════════

describe('RAG Pipeline Edge Cases', () => {
  let brain: Brain;
  let pipeline: RAGPipeline;

  beforeAll(async () => {
    brain = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await brain.connect();
    pipeline = new RAGPipeline(brain);
  }, 30000);

  afterAll(async () => {
    try { await brain.disconnect(); } catch {}
  });

  it('ingest splits content into chunks', async () => {
    const longContent = Array(20).fill('This is a paragraph with enough text to matter. ').join('\n\n');
    const result = await pipeline.ingest(longContent, 'rag-test-1');
    expect(result.chunks).toBeGreaterThan(0);
  });

  it('ingest with tags stores them', async () => {
    const result = await pipeline.ingest('Short content.', 'rag-tagged', { tags: ['test', 'rag'] });
    expect(result.chunks).toBeGreaterThanOrEqual(0);
  });

  it('retrieve returns results array', async () => {
    const results = await pipeline.retrieve('paragraph text');
    expect(Array.isArray(results)).toBe(true);
  });

  it('ingest empty content does not crash', async () => {
    const result = await pipeline.ingest('', 'rag-empty');
    expect(result.chunks).toBeGreaterThanOrEqual(0);
  });

  it('pipeline with custom options constructs', () => {
    const p = new RAGPipeline(brain, {
      chunkStrategy: 'sentence',
      chunkSize: 200,
      chunkOverlap: 20,
      topK: 3,
      rerank: false,
    });
    expect(p).toBeDefined();
  });
});

describe('RAG Chunker Edge Cases', () => {
  it('empty string produces no chunks or single empty chunk', () => {
    const chunker = new Chunker({ strategy: 'recursive', chunkSize: 100 });
    const chunks = chunker.chunk('');
    expect(chunks.length).toBeLessThanOrEqual(1);
  });

  it('single word produces one chunk', () => {
    const chunker = new Chunker({ strategy: 'recursive', chunkSize: 100, minChunkSize: 1 });
    const chunks = chunker.chunk('hello');
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toContain('hello');
  });

  it('sentence strategy splits on sentences', () => {
    const chunker = new Chunker({ strategy: 'sentence', chunkSize: 50 });
    const text = 'First sentence. Second sentence. Third sentence.';
    const chunks = chunker.chunk(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('very small chunkSize still works', () => {
    const chunker = new Chunker({ strategy: 'recursive', chunkSize: 10, chunkOverlap: 2, minChunkSize: 1 });
    const chunks = chunker.chunk('Hello world this is a test of small chunks');
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe('RAG Reranker Edge Cases', () => {
  it('rerank empty results returns empty', () => {
    const reranker = new Reranker();
    const results = reranker.rerankKeyword('query', []);
    expect(results).toHaveLength(0);
  });

  it('rerank with keyword strategy scores by overlap', () => {
    const reranker = new Reranker();
    const items = [
      { slug: 'a', content: 'machine learning is great', score: 0.5 },
      { slug: 'b', content: 'cooking recipes for dinner', score: 0.5 },
    ];
    const results = reranker.rerankKeyword('machine learning', items);
    expect(results.length).toBe(2);
    // The ML-related one should score higher
    expect(results[0].content).toContain('machine');
  });
});

// ═══════════════════════════════════════════════════════════════
// Evolve Engine Edge Cases
// ═══════════════════════════════════════════════════════════════

describe('Evolve Edge Cases', () => {
  it('extractKeywords from empty string', () => {
    const kws = extractKeywords('');
    expect(kws).toHaveLength(0);
  });

  it('extractKeywords filters short words', () => {
    const kws = extractKeywords('I am a big fan of AI');
    // Should not contain very short common words
    expect(kws).not.toContain('I');
    expect(kws).not.toContain('a');
  });

  it('similarity of identical sets is 1', () => {
    const s = similarity(['a', 'b', 'c'], ['a', 'b', 'c']);
    expect(s).toBe(1);
  });

  it('similarity of disjoint sets is 0', () => {
    const s = similarity(['a', 'b'], ['c', 'd']);
    expect(s).toBe(0);
  });

  it('similarity of empty sets is 0', () => {
    const s = similarity([], []);
    expect(s).toBe(0);
  });

  it('clusterTraces groups similar traces', () => {
    const traces = [
      { slug: 'dark1', keywords: ['dark', 'mode', 'preference', 'user', 'themes'] },
      { slug: 'dark2', keywords: ['dark', 'theme', 'setting', 'better', 'readability'] },
      { slug: 'cook1', keywords: ['cooking', 'recipe', 'pasta', 'tomato', 'sauce'] },
    ];
    const clusters = clusterTraces(traces, 0.2);
    // Returns a Map; dark traces should cluster together
    expect(clusters.size).toBeGreaterThanOrEqual(2);
  });

  it('clusterTraces with empty input returns empty', () => {
    const clusters = clusterTraces([], 0.3);
    expect(clusters.size).toBe(0);
  });

  it('dedupSentences removes exact duplicates', () => {
    const result = dedupSentences(['Hello world.', 'Hello world.', 'Different sentence.']);
    expect(result).toHaveLength(2);
  });

  it('dedupSentences with empty input returns empty', () => {
    expect(dedupSentences([])).toHaveLength(0);
  });

  it('consolidateMerge joins texts', () => {
    const traces = [
      { slug: 'a', title: 'A', content: 'First piece. Second bit.', keywords: ['first'], frontmatter: {}, type: 'note' },
      { slug: 'b', title: 'B', content: 'Third piece. Fourth bit.', keywords: ['third'], frontmatter: {}, type: 'note' },
    ];
    const result = consolidateMerge(traces);
    expect(result).toContain('First piece');
    expect(result).toContain('Third piece');
  });

  it('consolidateMerge with single item', () => {
    const traces = [
      { slug: 'a', title: 'A', content: 'Only one sentence here.', keywords: ['only'], frontmatter: {}, type: 'note' },
    ];
    const result = consolidateMerge(traces);
    expect(result).toContain('Only one');
  });

  it('consolidateSummarize returns non-empty for input', () => {
    const traces = [
      { slug: 'a', title: 'A', content: 'Sentence A. Sentence B. Sentence C.', keywords: ['sentence'], frontmatter: {}, type: 'note' },
      { slug: 'b', title: 'B', content: 'Sentence D.', keywords: ['sentence'], frontmatter: {}, type: 'note' },
    ];
    const result = consolidateSummarize(traces);
    expect(result.length).toBeGreaterThan(0);
  });

  it('consolidateExtract returns non-empty for input', () => {
    const traces = [
      { slug: 'a', title: 'A', content: 'Key: value one. Name is Bob.', keywords: ['key'], frontmatter: {}, type: 'note' },
    ];
    const result = consolidateExtract(traces);
    expect(result.length).toBeGreaterThan(0);
  });
});
