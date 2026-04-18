/**
 * Meta-Evolve: Self-Evolving Evolution Strategy
 * Inspired by MemSkill + HyperAgents (2026)
 *
 * Strategies auto-improve: after every evolve, record result →
 * low-performing strategies get pruned → new strategies proposed from failure patterns.
 */

import type { Brain } from './brain.js';
import type { Page } from './types.js';

// ── Types ────────────────────────────────────────────────────────

export type MergeMethod = 'similarity' | 'temporal' | 'categorical' | 'hybrid';

export interface MetaEvolveStrategy {
  id: string;
  name: string;
  description: string;
  merge_method: MergeMethod;
  similarity_threshold: number;
  max_merge_count: number;
  effectiveness_score: number;
  usage_count: number;
}

export interface FailedCase {
  strategy_id: string;
  pages: string[];          // slugs
  error?: string;
  before_score: number;
  after_score: number;
}

// ── Constants ────────────────────────────────────────────────────

const META_EVOLVE_SLUG = '_meta_evolve';
const EMA_ALPHA = 0.3;  // Exponential moving average weight for new observations

const DEFAULT_STRATEGIES: MetaEvolveStrategy[] = [
  {
    id: 'sim-strict',
    name: 'Strict Similarity',
    description: 'High similarity threshold, conservative merges',
    merge_method: 'similarity',
    similarity_threshold: 0.85,
    max_merge_count: 3,
    effectiveness_score: 0.5,
    usage_count: 0,
  },
  {
    id: 'sim-loose',
    name: 'Loose Similarity',
    description: 'Lower similarity threshold, aggressive merges',
    merge_method: 'similarity',
    similarity_threshold: 0.6,
    max_merge_count: 10,
    effectiveness_score: 0.5,
    usage_count: 0,
  },
  {
    id: 'temporal',
    name: 'Temporal Merge',
    description: 'Merge pages by temporal proximity',
    merge_method: 'temporal',
    similarity_threshold: 0.5,
    max_merge_count: 5,
    effectiveness_score: 0.5,
    usage_count: 0,
  },
  {
    id: 'categorical',
    name: 'Categorical Merge',
    description: 'Merge pages of the same type/category',
    merge_method: 'categorical',
    similarity_threshold: 0.7,
    max_merge_count: 8,
    effectiveness_score: 0.5,
    usage_count: 0,
  },
  {
    id: 'hybrid-default',
    name: 'Hybrid Default',
    description: 'Combination of similarity + temporal + categorical signals',
    merge_method: 'hybrid',
    similarity_threshold: 0.7,
    max_merge_count: 5,
    effectiveness_score: 0.5,
    usage_count: 0,
  },
];

// ── MetaEvolver ──────────────────────────────────────────────────

export class MetaEvolver {
  private brain: Brain;
  private strategies: MetaEvolveStrategy[] = [];
  private loaded = false;

  constructor(brain: Brain) {
    this.brain = brain;
  }

  /** Load strategies from the brain's special page, or seed defaults */
  async load(): Promise<void> {
    const page = await this.brain.get(META_EVOLVE_SLUG);
    if (page && page.compiled_truth) {
      try {
        this.strategies = JSON.parse(page.compiled_truth);
      } catch {
        this.strategies = [...DEFAULT_STRATEGIES];
      }
    } else {
      this.strategies = [...DEFAULT_STRATEGIES];
    }
    this.loaded = true;
  }

  /** Persist strategies back to brain */
  private async save(): Promise<void> {
    await this.brain.put(META_EVOLVE_SLUG, {
      type: 'system',
      title: 'Meta-Evolve Strategies',
      compiled_truth: JSON.stringify(this.strategies, null, 2),
    });
  }

  /** Ensure loaded */
  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) await this.load();
  }

  /** Returns all strategies sorted by effectiveness (desc) */
  async getStrategies(): Promise<MetaEvolveStrategy[]> {
    await this.ensureLoaded();
    return [...this.strategies].sort((a, b) => b.effectiveness_score - a.effectiveness_score);
  }

  /**
   * Select the best strategy for given pages based on content characteristics.
   * - If all pages share the same type → prefer categorical
   * - If pages have timeline data → prefer temporal
   * - Otherwise → pick highest effectiveness
   */
  async selectStrategy(pages: Page[]): Promise<MetaEvolveStrategy> {
    await this.ensureLoaded();

    const sorted = [...this.strategies].sort((a, b) => b.effectiveness_score - a.effectiveness_score);
    if (sorted.length === 0) {
      return DEFAULT_STRATEGIES[0];
    }

    // Heuristic: check page characteristics
    const types = new Set(pages.map(p => p.type));
    const hasTimeline = pages.some(p => p.timeline && p.timeline.length > 0);

    // Prefer categorical if all same type
    if (types.size === 1) {
      const cat = sorted.find(s => s.merge_method === 'categorical');
      if (cat) return cat;
    }

    // Prefer temporal if pages have timeline data
    if (hasTimeline) {
      const temp = sorted.find(s => s.merge_method === 'temporal');
      if (temp) return temp;
    }

    // Default: highest effectiveness
    return sorted[0];
  }

  /**
   * Record the result of an evolve operation.
   * Updates effectiveness_score using exponential moving average.
   */
  async recordResult(strategyId: string, before_score: number, after_score: number): Promise<void> {
    await this.ensureLoaded();

    const strategy = this.strategies.find(s => s.id === strategyId);
    if (!strategy) return;

    const improvement = after_score - before_score;
    // Normalize improvement to 0-1 range (assuming scores are 0-1)
    const normalized = Math.max(0, Math.min(1, (improvement + 1) / 2));

    // EMA update
    strategy.effectiveness_score =
      EMA_ALPHA * normalized + (1 - EMA_ALPHA) * strategy.effectiveness_score;
    strategy.usage_count += 1;

    await this.save();
  }

  /**
   * Analyze failed evolve cases and propose a new strategy with different params.
   * Returns null if no meaningful strategy can be proposed.
   */
  async proposeNewStrategy(failedCases: FailedCase[]): Promise<MetaEvolveStrategy | null> {
    await this.ensureLoaded();

    if (failedCases.length === 0) return null;

    // Analyze failure patterns
    const failedMethods = failedCases.map(c => {
      const s = this.strategies.find(s => s.id === c.strategy_id);
      return s?.merge_method ?? 'similarity';
    });

    // Find which method failed most
    const methodCounts: Record<string, number> = {};
    for (const m of failedMethods) {
      methodCounts[m] = (methodCounts[m] || 0) + 1;
    }

    // Pick a method that failed least (or hasn't been tried)
    const allMethods: MergeMethod[] = ['similarity', 'temporal', 'categorical', 'hybrid'];
    const bestMethod = allMethods
      .sort((a, b) => (methodCounts[a] || 0) - (methodCounts[b] || 0))[0];

    // Average the failed thresholds and adjust
    const avgThreshold = failedCases.reduce((sum, c) => {
      const s = this.strategies.find(s => s.id === c.strategy_id);
      return sum + (s?.similarity_threshold ?? 0.7);
    }, 0) / failedCases.length;

    const newId = `auto-${Date.now()}`;
    const newStrategy: MetaEvolveStrategy = {
      id: newId,
      name: `Auto-${bestMethod}-${newId.slice(-6)}`,
      description: `Auto-proposed strategy based on ${failedCases.length} failure(s)`,
      merge_method: bestMethod,
      similarity_threshold: Math.max(0.3, Math.min(0.95, avgThreshold + (Math.random() * 0.2 - 0.1))),
      max_merge_count: Math.floor(Math.random() * 8) + 2,
      effectiveness_score: 0.5,  // Start neutral
      usage_count: 0,
    };

    this.strategies.push(newStrategy);
    await this.save();

    return newStrategy;
  }

  /**
   * Remove strategies below the minimum effectiveness threshold.
   * Never removes all strategies — keeps at least one.
   */
  async pruneStrategies(min_effectiveness: number): Promise<number> {
    await this.ensureLoaded();

    const before = this.strategies.length;
    const kept = this.strategies.filter(s => s.effectiveness_score >= min_effectiveness);

    // Keep at least one strategy
    if (kept.length === 0 && this.strategies.length > 0) {
      const best = [...this.strategies].sort((a, b) => b.effectiveness_score - a.effectiveness_score);
      this.strategies = [best[0]];
    } else {
      this.strategies = kept;
    }

    const pruned = before - this.strategies.length;
    if (pruned > 0) await this.save();
    return pruned;
  }
}
