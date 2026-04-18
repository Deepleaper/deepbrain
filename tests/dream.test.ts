/**
 * DeepBrain — Dream Cycle Tests
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Brain } from '../src/core/brain.js';
import { dream } from '../src/dream/index.js';

const TEST_DB = './test-dream-data';

const HAS_API_KEY = !!(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);

describe.skipIf(!HAS_API_KEY)('Dream Cycle', () => {
  let brain: Brain;

  beforeAll(async () => {
    brain = new Brain({
      engine: 'pglite',
      database: TEST_DB,
      embedding_provider: 'gemini',
      api_key: process.env.GEMINI_API_KEY,
    });
    await brain.connect();

    // Seed some data
    await brain.put('dream-page-1', {
      type: 'note',
      title: 'Dream Test 1',
      compiled_truth: 'Knowledge about quantum computing and its applications.',
    });
    await brain.put('dream-page-2', {
      type: 'note',
      title: 'Dream Test 2',
      compiled_truth: 'Information about blockchain technology and decentralization.',
    });
  }, 60000);

  afterAll(async () => {
    await brain.disconnect();
    const { rmSync } = await import('node:fs');
    try { rmSync(TEST_DB, { recursive: true, force: true }); } catch {}
  });

  it('should run dream cycle and return a report', async () => {
    const report = await dream(brain, { tasks: ['stale', 'stats'] });

    expect(report).toBeDefined();
    expect(report.started_at).toBeInstanceOf(Date);
    expect(report.finished_at).toBeInstanceOf(Date);
    expect(report.finished_at.getTime()).toBeGreaterThanOrEqual(report.started_at.getTime());
    expect(typeof report.stale_refreshed).toBe('number');
    expect(typeof report.orphans_found).toBe('number');
    expect(typeof report.dead_links_removed).toBe('number');
    expect(Array.isArray(report.errors)).toBe(true);
  }, 60000);

  it('should run specific tasks only', async () => {
    const report = await dream(brain, { tasks: ['stats'] });
    expect(report).toBeDefined();
    // stats-only shouldn't refresh anything
    expect(report.stale_refreshed).toBe(0);
  }, 30000);
});
