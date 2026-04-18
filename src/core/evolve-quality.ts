/**
 * Evolve Quality Gate (inspired by Memento-Skills paper)
 *
 * Provides checkpoint/validate/rollback for the evolve() cycle,
 * ensuring memory consolidation doesn't degrade recall quality.
 */

import type { Brain } from './brain.js';
import type { AgentBrain } from '../agent-brain.js';
import type { Page, SearchResult } from './types.js';

export interface QualitySnapshot {
  timestamp: string;
  queries: string[];
  scores: number[];
  avgScore: number;
  topResults: Map<string, string[]>; // query → slug[]
  pageData?: Array<{ slug: string; type: string; title: string; compiled_truth: string; frontmatter: Record<string, unknown> }>;
}

export interface QualityReport {
  passed: boolean;
  beforeAvg: number;
  afterAvg: number;
  degradation: number; // percentage
  degradedQueries: string[];
  improvedQueries: string[];
}

export class EvolveQualityGate {
  /**
   * Take a quality checkpoint by running test queries against the brain.
   */
  async checkpoint(agent: AgentBrain, testQueries: string[]): Promise<QualitySnapshot> {
    const scores: number[] = [];
    const topResults = new Map<string, string[]>();

    for (const query of testQueries) {
      const results = await agent.recall(query, { limit: 5 });
      // Use the average similarity score of returned results
      const queryScore = results.length > 0
        ? results.reduce((sum, r) => sum + (r.score ?? 0), 0) / results.length
        : 0;
      scores.push(queryScore);
      topResults.set(query, results.map(r => r.slug));
    }

    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    // Snapshot all pages for potential rollback
    const brain = agent.getBrain();
    const allPages = await brain.list({ limit: 10000 });
    const pageData = allPages.map(p => ({
      slug: p.slug,
      type: p.type,
      title: p.title,
      compiled_truth: p.compiled_truth || '',
      frontmatter: (p.frontmatter || {}) as Record<string, unknown>,
    }));

    return {
      timestamp: new Date().toISOString(),
      queries: testQueries,
      scores,
      avgScore,
      topResults,
      pageData,
    };
  }

  /**
   * Validate quality by comparing before/after snapshots.
   * Flags degradation > 10%.
   */
  validate(before: QualitySnapshot, after: QualitySnapshot): QualityReport {
    const degradedQueries: string[] = [];
    const improvedQueries: string[] = [];

    for (let i = 0; i < before.queries.length; i++) {
      const query = before.queries[i];
      const beforeScore = before.scores[i] || 0;
      const afterScore = after.scores[i] || 0;

      if (beforeScore > 0 && afterScore < beforeScore * 0.9) {
        degradedQueries.push(query);
      } else if (afterScore > beforeScore * 1.1) {
        improvedQueries.push(query);
      }
    }

    const degradation = before.avgScore > 0
      ? ((before.avgScore - after.avgScore) / before.avgScore) * 100
      : 0;

    return {
      passed: degradation <= 10,
      beforeAvg: before.avgScore,
      afterAvg: after.avgScore,
      degradation,
      degradedQueries,
      improvedQueries,
    };
  }

  /**
   * Rollback brain pages from a snapshot.
   */
  async autoRollback(brain: Brain, snapshotData: QualitySnapshot['pageData']): Promise<void> {
    if (!snapshotData) return;

    for (const page of snapshotData) {
      await brain.put(page.slug, {
        type: page.type,
        title: page.title,
        compiled_truth: page.compiled_truth,
        frontmatter: page.frontmatter,
      });
    }
  }
}
