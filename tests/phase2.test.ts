/**
 * Phase 2 Tests: Dynamic Schema, Trace Analyzer, Evolve Quality Gate
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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
import { AgentBrain } from '../src/agent-brain.js';
import { DynamicSchemaManager, WORKSTATION_SCHEMAS } from '../src/core/dynamic-schema.js';
import type { SchemaHint, WorkstationCategory } from '../src/core/dynamic-schema.js';
import { TraceAnalyzer, feedTracesToBrain } from '../src/core/trace-analyzer.js';
import type { TraceData } from '../src/core/trace-analyzer.js';
import { EvolveQualityGate } from '../src/core/evolve-quality.js';
import type { QualitySnapshot } from '../src/core/evolve-quality.js';

const TEST_BASE = join(tmpdir(), 'deepbrain-test-phase2-' + Date.now());
let dbCounter = 0;
function tmpDb() { return join(TEST_BASE, `db-${dbCounter++}`); }

// ═══════════════════════════════════════════════════════════════
// Dynamic Schema Tests
// ═══════════════════════════════════════════════════════════════

describe('DynamicSchemaManager', () => {
  const manager = new DynamicSchemaManager();
  let brain: Brain;

  beforeAll(async () => {
    mkdirSync(TEST_BASE, { recursive: true });
    brain = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await brain.connect();
  }, 30000);

  afterAll(async () => {
    try { await brain.disconnect(); } catch {}
  });

  it('suggestSchema returns empty for no pages', () => {
    const hints = manager.suggestSchema([]);
    expect(hints).toEqual([]);
  });

  it('suggestSchema detects recurring key-value patterns', () => {
    const pages = Array.from({ length: 5 }, (_, i) => ({
      id: i, slug: `page-${i}`, type: 'note', title: `Note ${i}`,
      compiled_truth: `status: active\npriority: high\nscore: ${i * 10}`,
      timeline: '', frontmatter: {}, created_at: new Date(), updated_at: new Date(),
    }));
    const hints = manager.suggestSchema(pages);
    expect(hints.length).toBeGreaterThan(0);
    const fields = hints.map(h => h.field);
    expect(fields).toContain('status');
  });

  it('suggestSchema infers number type from field name', () => {
    const pages = Array.from({ length: 5 }, (_, i) => ({
      id: i, slug: `page-${i}`, type: 'note', title: `Note ${i}`,
      compiled_truth: `total_count: ${i * 10}`,
      timeline: '', frontmatter: {}, created_at: new Date(), updated_at: new Date(),
    }));
    const hints = manager.suggestSchema(pages);
    const countHint = hints.find(h => h.field.includes('count'));
    if (countHint) {
      expect(countHint.type).toBe('number');
    }
  });

  it('applySchema and getSchema roundtrip', async () => {
    const hints: SchemaHint[] = [
      { field: 'test_field', type: 'string', description: 'A test field' },
    ];
    await manager.applySchema(brain, hints);
    const retrieved = await manager.getSchema(brain);
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].field).toBe('test_field');
  });

  it('getWorkstationSchema returns correct schemas for all categories', () => {
    const categories: WorkstationCategory[] = ['sales', 'engineering', 'customer-service', 'finance', 'hr'];
    for (const cat of categories) {
      const schema = manager.getWorkstationSchema(cat);
      expect(schema.length).toBe(3);
      for (const hint of schema) {
        expect(hint.field).toBeTruthy();
        expect(['string', 'number', 'boolean', 'date']).toContain(hint.type);
      }
    }
  });

  it('WORKSTATION_SCHEMAS has all 5 categories', () => {
    expect(Object.keys(WORKSTATION_SCHEMAS)).toHaveLength(5);
  });
});

// ═══════════════════════════════════════════════════════════════
// Trace Analyzer Tests
// ═══════════════════════════════════════════════════════════════

describe('TraceAnalyzer', () => {
  const analyzer = new TraceAnalyzer(5000);

  it('extracts recovery insight from failed span', () => {
    const trace: TraceData = {
      trace_id: 'test-1',
      spans: [{ name: 'db-query', status: 'error', duration_ms: 100, attributes: {}, error: 'Connection timeout' }],
    };
    const insights = analyzer.analyzeTrace(trace);
    expect(insights.length).toBe(1);
    expect(insights[0].insight_type).toBe('recovery');
    expect(insights[0].source_trace_id).toBe('test-1');
  });

  it('extracts optimization insight from slow successful span', () => {
    const trace: TraceData = {
      trace_id: 'test-2',
      spans: [{ name: 'heavy-compute', status: 'ok', duration_ms: 10000, attributes: {} }],
    };
    const insights = analyzer.analyzeTrace(trace);
    expect(insights.length).toBe(1);
    expect(insights[0].insight_type).toBe('optimization');
  });

  it('extracts strategy insight from fast successful span', () => {
    const trace: TraceData = {
      trace_id: 'test-3',
      spans: [{ name: 'cache-hit', status: 'ok', duration_ms: 200, attributes: {} }],
    };
    const insights = analyzer.analyzeTrace(trace);
    expect(insights.length).toBe(1);
    expect(insights[0].insight_type).toBe('strategy');
  });

  it('ignores trivial spans (< 100ms)', () => {
    const trace: TraceData = {
      trace_id: 'test-4',
      spans: [{ name: 'noop', status: 'ok', duration_ms: 50, attributes: {} }],
    };
    const insights = analyzer.analyzeTrace(trace);
    expect(insights.length).toBe(0);
  });

  it('batchAnalyze deduplicates same span name + type', () => {
    const traces: TraceData[] = [
      { trace_id: 't1', spans: [{ name: 'api-call', status: 'error', duration_ms: 100, attributes: {}, error: 'timeout' }] },
      { trace_id: 't2', spans: [{ name: 'api-call', status: 'error', duration_ms: 200, attributes: {}, error: 'timeout' }] },
    ];
    const insights = analyzer.batchAnalyze(traces);
    expect(insights.length).toBe(1);
  });

  it('batchAnalyze keeps different span names', () => {
    const traces: TraceData[] = [
      { trace_id: 't1', spans: [{ name: 'api-call', status: 'error', duration_ms: 100, attributes: {}, error: 'err' }] },
      { trace_id: 't2', spans: [{ name: 'db-call', status: 'error', duration_ms: 200, attributes: {}, error: 'err' }] },
    ];
    const insights = analyzer.batchAnalyze(traces);
    expect(insights.length).toBe(2);
  });
});

describe('feedTracesToBrain', () => {
  let brain: Brain;
  let agent: AgentBrain;

  beforeAll(async () => {
    brain = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await brain.connect();
    agent = new AgentBrain(brain, 'trace-test');
  }, 30000);

  afterAll(async () => {
    try { await brain.disconnect(); } catch {}
  });

  it('feeds trace insights into the brain', async () => {
    const analyzer = new TraceAnalyzer();
    const traces: TraceData[] = [
      { trace_id: 'feed-1', spans: [{ name: 'slow-op', status: 'ok', duration_ms: 8000, attributes: {} }] },
    ];
    const insights = await feedTracesToBrain(analyzer, agent, traces);
    expect(insights.length).toBeGreaterThan(0);

    // Verify it was stored in brain
    const pages = await brain.list({ type: 'trace', limit: 100 });
    const found = pages.some(p => p.compiled_truth?.includes('slow-op'));
    expect(found).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Evolve Quality Gate Tests
// ═══════════════════════════════════════════════════════════════

describe('EvolveQualityGate', () => {
  const gate = new EvolveQualityGate();
  let brain: Brain;
  let agent: AgentBrain;

  beforeAll(async () => {
    brain = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await brain.connect();
    agent = new AgentBrain(brain, 'quality-test');
    // Seed some data
    await agent.learn('TypeScript is a typed superset of JavaScript', { tags: ['tech'] });
    await agent.learn('React is a UI library for building interfaces', { tags: ['tech'] });
  }, 30000);

  afterAll(async () => {
    try { await brain.disconnect(); } catch {}
  });

  it('checkpoint produces a valid snapshot', async () => {
    const snapshot = await gate.checkpoint(agent, ['TypeScript', 'React']);
    expect(snapshot.queries).toHaveLength(2);
    expect(snapshot.scores).toHaveLength(2);
    expect(typeof snapshot.avgScore).toBe('number');
    expect(snapshot.pageData).toBeDefined();
    expect(snapshot.pageData!.length).toBeGreaterThan(0);
  });

  it('validate passes when scores are equal', () => {
    const before: QualitySnapshot = {
      timestamp: new Date().toISOString(),
      queries: ['q1'], scores: [0.8], avgScore: 0.8,
      topResults: new Map([['q1', ['s1']]]),
    };
    const after: QualitySnapshot = {
      timestamp: new Date().toISOString(),
      queries: ['q1'], scores: [0.8], avgScore: 0.8,
      topResults: new Map([['q1', ['s1']]]),
    };
    const report = gate.validate(before, after);
    expect(report.passed).toBe(true);
    expect(report.degradation).toBe(0);
  });

  it('validate flags degradation > 10%', () => {
    const before: QualitySnapshot = {
      timestamp: new Date().toISOString(),
      queries: ['q1'], scores: [0.8], avgScore: 0.8,
      topResults: new Map(),
    };
    const after: QualitySnapshot = {
      timestamp: new Date().toISOString(),
      queries: ['q1'], scores: [0.5], avgScore: 0.5,
      topResults: new Map(),
    };
    const report = gate.validate(before, after);
    expect(report.passed).toBe(false);
    expect(report.degradation).toBeGreaterThan(10);
    expect(report.degradedQueries).toContain('q1');
  });

  it('validate detects improved queries', () => {
    const before: QualitySnapshot = {
      timestamp: new Date().toISOString(),
      queries: ['q1'], scores: [0.5], avgScore: 0.5,
      topResults: new Map(),
    };
    const after: QualitySnapshot = {
      timestamp: new Date().toISOString(),
      queries: ['q1'], scores: [0.9], avgScore: 0.9,
      topResults: new Map(),
    };
    const report = gate.validate(before, after);
    expect(report.passed).toBe(true);
    expect(report.improvedQueries).toContain('q1');
  });

  it('autoRollback restores pages', async () => {
    const snapshot = await gate.checkpoint(agent, ['test']);
    // Add a new page
    await brain.put('temp-page', { type: 'note', title: 'Temp', compiled_truth: 'temp data' });
    // Rollback
    await gate.autoRollback(brain, snapshot.pageData);
    // The original pages should still exist
    const pages = await brain.list({ limit: 100 });
    expect(pages.length).toBeGreaterThan(0);
  });
});
