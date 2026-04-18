import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  extractKeywords,
  similarity,
  clusterTraces,
  dedupSentences,
  consolidateMerge,
  consolidateSummarize,
  consolidateExtract,
  AutoEvolveScheduler,
} from '../src/evolve/index.js';
import type { TraceItem } from '../src/evolve/index.js';

// ── extractKeywords ─────────────────────────────────────────────

describe('extractKeywords', () => {
  it('returns top keywords from text', () => {
    const kws = extractKeywords('The user prefers dark mode and dark themes for better readability');
    expect(kws).toContain('dark');
    expect(kws).toContain('user');
    expect(kws.length).toBeGreaterThan(0);
    expect(kws.length).toBeLessThanOrEqual(10);
  });

  it('handles empty string', () => {
    expect(extractKeywords('')).toEqual([]);
    expect(extractKeywords('   ')).toEqual([]);
  });

  it('filters English stopwords', () => {
    const kws = extractKeywords('the is a an was are were');
    expect(kws).toEqual([]);
  });

  it('filters Chinese stopwords', () => {
    const kws = extractKeywords('的 了 在 是 我 pricing enterprise');
    expect(kws).toContain('pricing');
    expect(kws).toContain('enterprise');
    expect(kws).not.toContain('的');
  });

  it('ranks by frequency', () => {
    const kws = extractKeywords('pricing pricing pricing enterprise plan enterprise');
    expect(kws[0]).toBe('pricing');
    expect(kws[1]).toBe('enterprise');
  });

  it('filters short words (<=2 chars)', () => {
    const kws = extractKeywords('AI is ok go run');
    // 'ai', 'ok', 'go' are <=2 chars, should be filtered
    expect(kws).not.toContain('ai');
    expect(kws).not.toContain('ok');
  });
});

// ── similarity ──────────────────────────────────────────────────

describe('similarity', () => {
  it('returns 1 for identical sets', () => {
    expect(similarity(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(1);
  });

  it('returns 0 for disjoint sets', () => {
    expect(similarity(['a', 'b'], ['c', 'd'])).toBe(0);
  });

  it('returns 0 for two empty arrays', () => {
    expect(similarity([], [])).toBe(0);
  });

  it('returns correct partial overlap', () => {
    // {a,b,c} ∩ {b,c,d} = {b,c}, union = {a,b,c,d} => 2/4 = 0.5
    expect(similarity(['a', 'b', 'c'], ['b', 'c', 'd'])).toBe(0.5);
  });
});

// ── clusterTraces ───────────────────────────────────────────────

describe('clusterTraces', () => {
  it('groups similar traces together', () => {
    const traces = [
      { slug: 'a', keywords: ['dark', 'mode', 'theme'] },
      { slug: 'b', keywords: ['dark', 'mode', 'settings'] },
      { slug: 'c', keywords: ['pricing', 'enterprise', 'plan'] },
    ];
    const clusters = clusterTraces(traces, 0.2);
    // a and b should be in same cluster, c separate
    let foundTogether = false;
    for (const [, slugs] of clusters) {
      if (slugs.includes('a') && slugs.includes('b')) foundTogether = true;
    }
    expect(foundTogether).toBe(true);
  });

  it('creates separate clusters for different topics', () => {
    const traces = [
      { slug: 'a', keywords: ['alpha', 'beta'] },
      { slug: 'b', keywords: ['gamma', 'delta'] },
    ];
    const clusters = clusterTraces(traces, 0.2);
    expect(clusters.size).toBe(2);
  });

  it('handles empty input', () => {
    const clusters = clusterTraces([], 0.2);
    expect(clusters.size).toBe(0);
  });

  it('single trace becomes its own cluster', () => {
    const clusters = clusterTraces([{ slug: 'a', keywords: ['test'] }], 0.2);
    expect(clusters.size).toBe(1);
  });
});

// ── dedupSentences ──────────────────────────────────────────────

describe('dedupSentences', () => {
  it('removes near-identical sentences', () => {
    const result = dedupSentences([
      'User prefers dark mode',
      'User prefers the dark mode',
      'Something completely different',
    ]);
    expect(result.length).toBe(2);
  });

  it('preserves unique sentences', () => {
    const result = dedupSentences([
      'Pricing is important',
      'Dark mode is preferred',
      'Team size is fifty',
    ]);
    expect(result.length).toBe(3);
  });

  it('handles empty input', () => {
    expect(dedupSentences([])).toEqual([]);
  });

  it('skips blank strings', () => {
    expect(dedupSentences(['', '  ', 'hello'])).toEqual(['hello']);
  });
});

// ── Consolidation strategies ────────────────────────────────────

const sampleTraces: TraceItem[] = [
  { slug: 'a', title: 'User pricing', content: 'User asked about pricing. Wants enterprise plan.', keywords: ['user', 'pricing', 'enterprise', 'plan'], frontmatter: {}, type: 'trace' },
  { slug: 'b', title: 'Team size', content: 'User mentioned team size is 50 people.', keywords: ['user', 'team', 'size', 'people'], frontmatter: {}, type: 'trace' },
  { slug: 'c', title: 'Billing', content: 'User interested in annual billing for discount.', keywords: ['user', 'annual', 'billing', 'discount'], frontmatter: {}, type: 'trace' },
];

describe('consolidateMerge', () => {
  it('combines traces and dedup sentences', () => {
    const result = consolidateMerge(sampleTraces);
    expect(result).toContain('Consolidated from 3 traces');
    expect(result).toContain('pricing');
    expect(result).toContain('team size');
  });
});

describe('consolidateSummarize', () => {
  it('creates summary with key themes', () => {
    const result = consolidateSummarize(sampleTraces);
    expect(result).toContain('Patterns');
    expect(result).toContain('Key Themes');
    expect(result).toContain('user');
  });
});

describe('consolidateExtract', () => {
  it('extracts key-value facts', () => {
    const traces: TraceItem[] = [
      { slug: 'a', title: 'Name', content: 'name: Ray', keywords: ['name', 'ray'], frontmatter: {}, type: 'trace' },
      { slug: 'b', title: 'Company', content: 'company: Deepleaper', keywords: ['company', 'deepleaper'], frontmatter: {}, type: 'trace' },
    ];
    const result = consolidateExtract(traces);
    expect(result).toContain('Extracted Facts');
    expect(result).toContain('Ray');
    expect(result).toContain('Deepleaper');
  });

  it('falls back to listing sentences when no key-value patterns found', () => {
    const traces: TraceItem[] = [
      { slug: 'a', title: 'Random', content: 'Just some random text here', keywords: ['random', 'text'], frontmatter: {}, type: 'trace' },
    ];
    const result = consolidateExtract(traces);
    expect(result).toContain('random text');
  });
});

// ── AutoEvolveScheduler ─────────────────────────────────────────

describe('AutoEvolveScheduler', () => {
  it('starts and stops', () => {
    const scheduler = new AutoEvolveScheduler();
    expect(scheduler.isRunning()).toBe(false);

    const mockBrain = {
      evolve: async () => ({ tracesProcessed: 0, pagesCreated: 0, pagesUpdated: 0, clusters: [], dryRun: false }),
    };
    scheduler.start(mockBrain, 100000);
    expect(scheduler.isRunning()).toBe(true);

    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
  });

  it('can be stopped multiple times safely', () => {
    const scheduler = new AutoEvolveScheduler();
    scheduler.stop();
    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
  });
});
