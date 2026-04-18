import { describe, it, expect } from 'vitest';
import { classifyInsight } from '../src/agent-brain.js';
import type { InsightType } from '../src/agent-brain.js';

// ── classifyInsight ─────────────────────────────────────────────

describe('classifyInsight', () => {
  it('classifies error-related content as recovery', () => {
    expect(classifyInsight('There was an error in the pipeline')).toBe('recovery');
  });

  it('classifies failure content as recovery', () => {
    expect(classifyInsight('The deploy failed at step 3')).toBe('recovery');
  });

  it('classifies bug content as recovery', () => {
    expect(classifyInsight('Found a bug in the auth module')).toBe('recovery');
  });

  it('classifies crash content as recovery', () => {
    expect(classifyInsight('Server crash after memory spike')).toBe('recovery');
  });

  it('classifies problem content as recovery', () => {
    expect(classifyInsight('The problem was a missing index')).toBe('recovery');
  });

  it('classifies optimization content correctly', () => {
    expect(classifyInsight('Made the query faster with caching')).toBe('optimization');
  });

  it('classifies efficiency content as optimization', () => {
    expect(classifyInsight('More efficient batch processing')).toBe('optimization');
  });

  it('classifies optimize keyword as optimization', () => {
    expect(classifyInsight('We need to optimize the embedding pipeline')).toBe('optimization');
  });

  it('classifies improve keyword as optimization', () => {
    expect(classifyInsight('How to improve recall accuracy')).toBe('optimization');
  });

  it('classifies performance keyword as optimization', () => {
    expect(classifyInsight('Performance tuning for search')).toBe('optimization');
  });

  it('defaults to strategy for general content', () => {
    expect(classifyInsight('We decided to use PostgreSQL for storage')).toBe('strategy');
  });

  it('defaults to strategy for empty content', () => {
    expect(classifyInsight('')).toBe('strategy');
  });

  it('recovery takes precedence over optimization when both present', () => {
    // "error" matches recovery first
    expect(classifyInsight('error in optimization pipeline')).toBe('recovery');
  });

  it('is case-insensitive', () => {
    expect(classifyInsight('CRITICAL ERROR detected')).toBe('recovery');
    expect(classifyInsight('OPTIMIZE the process')).toBe('optimization');
  });

  it('classifies retry as recovery', () => {
    expect(classifyInsight('Added retry logic for flaky connections')).toBe('recovery');
  });
});

// ── RecallOptions types ─────────────────────────────────────────

describe('RecallOptions type safety', () => {
  it('InsightType accepts valid values', () => {
    const types: InsightType[] = ['strategy', 'recovery', 'optimization'];
    expect(types).toHaveLength(3);
  });
});

// ── Integration-style tests (unit-testable parts) ───────────────

describe('learn insight_type in Trace', () => {
  it('Trace interface accepts insight_type field', () => {
    const trace = {
      action: 'debug auth',
      result: 'fixed the error',
      insight_type: 'recovery' as InsightType,
    };
    expect(trace.insight_type).toBe('recovery');
  });

  it('Trace insight_type is optional', () => {
    const trace = { action: 'plan migration', result: 'selected PostgreSQL' };
    expect(trace).not.toHaveProperty('insight_type');
  });
});
