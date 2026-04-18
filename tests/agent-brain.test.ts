/**
 * AgentBrain Tests
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

const TEST_BASE = join(tmpdir(), 'deepbrain-test-agent-' + Date.now());
let dbCounter = 0;
function tmpDb() { return join(TEST_BASE, `db-${dbCounter++}`); }

describe('AgentBrain', () => {
  let brain: Brain;
  let agentBrain: AgentBrain;

  beforeAll(async () => {
    mkdirSync(TEST_BASE, { recursive: true });
    brain = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await brain.connect();
    agentBrain = new AgentBrain(brain, 'test-agent');
  }, 30000);

  afterAll(async () => {
    try { await brain.disconnect(); } catch {}
    try { rmSync(TEST_BASE, { recursive: true, force: true }); } catch {}
  });

  it('constructs with brain and agentId', () => {
    expect(agentBrain).toBeDefined();
    expect(agentBrain.getBrain()).toBe(brain);
  });

  it('constructs with default agentId', () => {
    const ab = new AgentBrain(brain);
    expect(ab).toBeDefined();
  });

  // ── learn() ──────────────────────────────────────────

  it('learn() with string input', async () => {
    const result = await agentBrain.learn('The sky is blue');
    expect(result.slug).toMatch(/^trace-test-agent-/);
    const page = await brain.get(result.slug);
    expect(page).not.toBeNull();
    expect(page!.compiled_truth).toBe('The sky is blue');
    expect(page!.type).toBe('trace');
  }, 15000);

  it('learn() with Trace object', async () => {
    const result = await agentBrain.learn({
      action: 'Searched for weather',
      result: 'Found sunny forecast',
      context: { location: 'Beijing' },
    });
    expect(result.slug).toMatch(/^trace-test-agent-/);
    const page = await brain.get(result.slug);
    expect(page!.compiled_truth).toContain('Searched for weather');
    expect(page!.compiled_truth).toContain('Found sunny forecast');
    expect(page!.compiled_truth).toContain('Beijing');
  }, 15000);

  it('learn() with custom agentId', async () => {
    const result = await agentBrain.learn('custom agent data', { agentId: 'other-agent' });
    const page = await brain.get(result.slug);
    expect(page!.owner).toBe('other-agent');
  }, 15000);

  it('learn() with tags', async () => {
    const result = await agentBrain.learn('tagged trace', { tags: ['important', 'weather'] });
    const page = await brain.get(result.slug);
    const fm = page!.frontmatter as Record<string, unknown>;
    expect(fm.tags).toEqual(['important', 'weather']);
  }, 15000);

  it('learn() stores multiple traces', async () => {
    await agentBrain.learn('trace one');
    await agentBrain.learn('trace two');
    await agentBrain.learn('trace three');
    const traces = await brain.list({ type: 'trace' });
    expect(traces.length).toBeGreaterThanOrEqual(5);
  }, 30000);

  // ── recall() ─────────────────────────────────────────

  it('recall() returns results', async () => {
    const results = await agentBrain.recall('weather');
    expect(Array.isArray(results)).toBe(true);
  }, 15000);

  it('recall() with limit option', async () => {
    const results = await agentBrain.recall('test', { limit: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  }, 15000);

  // ── evolve() ─────────────────────────────────────────

  it('evolve() returns a report', async () => {
    const report = await agentBrain.evolve();
    expect(report).toBeDefined();
    expect(typeof report.tracesProcessed).toBe('number');
    expect(typeof report.pagesCreated).toBe('number');
    expect(typeof report.pagesUpdated).toBe('number');
    expect(typeof report.pagesPromoted).toBe('number');
    expect(Array.isArray(report.errors)).toBe(true);
    expect(report.startedAt).toBeInstanceOf(Date);
    expect(report.finishedAt).toBeInstanceOf(Date);
  }, 30000);

  it('evolve() with dryRun does not modify data', async () => {
    const beforePages = await brain.list();
    const report = await agentBrain.evolve({ dryRun: true });
    const afterPages = await brain.list();
    expect(afterPages.length).toBe(beforePages.length);
    expect(report.pagesCreated).toBe(0);
  }, 15000);

  it('evolve() with high minTraces skips consolidation', async () => {
    const report = await agentBrain.evolve({ minTraces: 9999 });
    expect(report.pagesCreated).toBe(0);
  }, 15000);

  it('evolve() marks traces as evolved', async () => {
    const b = new Brain({ database: tmpDb(), embedding_provider: 'ollama' });
    await b.connect();
    const ab = new AgentBrain(b, 'evo-agent');
    for (let i = 0; i < 5; i++) {
      await ab.learn(`evolve trace ${i}`);
    }
    const report = await ab.evolve({ minTraces: 3 });
    expect(report.tracesProcessed).toBeGreaterThanOrEqual(3);
    await b.disconnect();
  }, 60000);

  // ── getBrain() ───────────────────────────────────────

  it('getBrain() returns the underlying brain', () => {
    expect(agentBrain.getBrain()).toBe(brain);
  });
});
