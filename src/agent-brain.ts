import type { Brain } from './core/brain.js';
import type { SearchResult } from './core/types.js';
import {
  extractKeywords, similarity, clusterTraces, dedupSentences,
  consolidateMerge, consolidateSummarize, consolidateExtract,
  type EvolveOptions as EvolveOptsNew, type EvolveResult, type TraceItem,
} from './evolve/index.js';

/** Knowledge insight classification (Trajectory-Informed Memory) */
export type InsightType = 'strategy' | 'recovery' | 'optimization';

export interface Trace {
  /** What the agent did */
  action: string;
  /** What happened */
  result: string;
  /** Context/metadata */
  context?: Record<string, unknown>;
  /** Source agent ID */
  agentId?: string;
  /** Timestamp (auto-set if missing) */
  timestamp?: string;
  /** Insight classification (auto-detected if not provided) */
  insight_type?: InsightType;
}

export interface LearnOptions {
  /** Agent ID that produced this knowledge */
  agentId?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Whether to also write to agent's native memory format (dual-write) */
  dualWrite?: boolean;
}

export interface RecallOptions {
  /** Max results */
  limit?: number;
  /** Filter by agent ID */
  agentId?: string;
  /** Filter by tags */
  tags?: string[];
  /** Include higher tier memories (L2/L3/L4) if available */
  includeHigherTiers?: boolean;
  /** Prefer results of this insight type (boost 1.5x) */
  prefer_type?: InsightType;
  /** Recency weight 0-1 (0=no decay, 1=max decay). Default 0 */
  recency_weight?: number;
}

export { EvolveOptions, EvolveResult } from './evolve/index.js';

/** Safety governance options for evolve() (SSGM paper) */
export interface EvolveGovernanceOptions {
  /** Check embedding drift after merge. Warn if cosine distance > 0.3 */
  drift_check?: boolean;
  /** Pages older than this many days get lower merge priority. Default 180 */
  decay_days?: number;
  /** Run quality gate: 3 test recalls before/after, rollback if avg score drops >10% */
  quality_gate?: boolean;
}

export interface EvolveReport {
  tracesProcessed: number;
  pagesCreated: number;
  pagesUpdated: number;
  pagesPromoted: number;
  errors: string[];
  warnings: string[];
  startedAt: Date;
  finishedAt: Date;
}

// ── Insight Classification Heuristics ──────────────────────────

const RECOVERY_PATTERNS = /\b(error|fail(?:ed|ure|s)?|bug|crash|problem|exception|broken|fix|issue|timeout|retry)\b/i;
const OPTIMIZATION_PATTERNS = /\b(faster|efficient|optimize|improve|performance|speed|reduce|cache|batch)\b/i;

export function classifyInsight(text: string): InsightType {
  if (RECOVERY_PATTERNS.test(text)) return 'recovery';
  if (OPTIMIZATION_PATTERNS.test(text)) return 'optimization';
  return 'strategy';
}

export class AgentBrain {
  private brain: Brain;
  private defaultAgentId: string;

  constructor(brain: Brain, agentId: string = 'default') {
    this.brain = brain;
    this.defaultAgentId = agentId;
  }

  /**
   * learn() - Store a trace or knowledge into the brain.
   *
   * Converts agent traces into structured knowledge pages.
   * Each trace becomes a chunk that can be recalled later.
   */
  async learn(input: string | Trace, options: LearnOptions = {}): Promise<{ slug: string }> {
    const agentId = options.agentId || this.defaultAgentId;
    const timestamp = new Date().toISOString();

    let content: string;
    let title: string;

    if (typeof input === 'string') {
      content = input;
      title = input.slice(0, 80);
    } else {
      content = `## Action\n${input.action}\n\n## Result\n${input.result}`;
      if (input.context) {
        content += `\n\n## Context\n${JSON.stringify(input.context, null, 2)}`;
      }
      title = input.action.slice(0, 80);
    }

    // Auto-classify insight type
    const insight_type: InsightType = (typeof input !== 'string' && input.insight_type)
      ? input.insight_type
      : classifyInsight(content);

    const slug = `trace-${agentId}-${Date.now()}`;

    await this.brain.put(slug, {
      type: 'trace',
      title,
      compiled_truth: content,
      owner: agentId,
      frontmatter: {
        tier: 'working',
        source: 'learn',
        agentId,
        tags: options.tags || [],
        learnedAt: timestamp,
        access_count: 0,
        insight_type,
      },
    });

    return { slug };
  }

  /**
   * recall() - Semantic search across brain memories.
   *
   * Searches all accessible tiers and returns relevant memories.
   */
  async recall(query: string, options: RecallOptions = {}): Promise<SearchResult[]> {
    const results = await this.brain.query(query, {
      limit: (options.limit || 10) * 2, // fetch extra for re-ranking
      owner: options.agentId,
    });

    let reranked = results;

    // Re-rank by insight type preference and recency
    if (options.prefer_type || options.recency_weight) {
      const recencyWeight = Math.max(0, Math.min(1, options.recency_weight ?? 0));
      const now = Date.now();

      reranked = await Promise.all(results.map(async (r) => {
        let score = r.score;

        // Boost by insight_type match
        if (options.prefer_type) {
          const page = await this.brain.get(r.slug);
          const fm = (page?.frontmatter || {}) as Record<string, unknown>;
          if (fm.insight_type === options.prefer_type) {
            score *= 1.5;
          }
        }

        // Time decay
        if (recencyWeight > 0) {
          const page = await this.brain.get(r.slug);
          const fm = (page?.frontmatter || {}) as Record<string, unknown>;
          const learnedAt = fm.learnedAt as string;
          if (learnedAt) {
            const daysSince = (now - new Date(learnedAt).getTime()) / (1000 * 60 * 60 * 24);
            score *= (1 - recencyWeight * Math.min(daysSince, 365) / 365);
          }
        }

        return { ...r, score };
      }));

      reranked.sort((a, b) => b.score - a.score);
    }

    // Apply final limit
    return reranked.slice(0, options.limit || 10);
  }

  /**
   * evolve() - Real algorithmic knowledge consolidation.
   *
   * 1. Gather unprocessed traces
   * 2. Extract keywords & cluster by Jaccard similarity
   * 3. Consolidate each cluster using chosen strategy (merge/summarize/extract)
   * 4. Mark traces as evolved
   * 5. Return detailed stats
   *
   * Also supports the legacy EvolveOptions shape for backward compat.
   */
  async evolve(options: EvolveOptsNew & { batchSize?: number } & EvolveGovernanceOptions = {}): Promise<EvolveResult & EvolveReport> {
    const {
      batchSize = 50,
      minTraces = 5,
      dryRun = false,
      strategy = 'merge',
      topicThreshold = 0.2,
      maxAge,
      drift_check = false,
      decay_days = 180,
      quality_gate = false,
    } = options;

    const report: EvolveResult & EvolveReport = {
      tracesProcessed: 0,
      pagesCreated: 0,
      pagesUpdated: 0,
      pagesPromoted: 0,
      clusters: [],
      dryRun: !!dryRun,
      errors: [],
      warnings: [],
      startedAt: new Date(),
      finishedAt: new Date(),
    };

    try {
      // 1. Find unprocessed traces
      const allTraces = await this.brain.list({
        type: 'trace',
        limit: batchSize,
      });

      let traces = allTraces.filter(t => {
        const fm = (t.frontmatter || {}) as Record<string, unknown>;
        return !fm.evolved;
      });

      // Filter by maxAge if specified
      if (maxAge !== undefined) {
        const cutoff = Date.now() - maxAge * 24 * 60 * 60 * 1000;
        traces = traces.filter(t => {
          const fm = (t.frontmatter || {}) as Record<string, unknown>;
          const learnedAt = fm.learnedAt as string;
          if (!learnedAt) return true;
          return new Date(learnedAt).getTime() <= cutoff;
        });
      }

      report.tracesProcessed = traces.length;

      if (traces.length < minTraces) {
        report.finishedAt = new Date();
        return report;
      }

      // 2. Extract keywords for each trace
      const traceItems: TraceItem[] = traces.map(t => ({
        slug: t.slug,
        title: t.title || '',
        content: t.compiled_truth || t.title || '',
        keywords: extractKeywords((t.compiled_truth || '') + ' ' + (t.title || '')),
        frontmatter: (t.frontmatter || {}) as Record<string, unknown>,
        type: t.type,
      }));

      // Apply decay_days: sort traces so older ones come last (lower merge priority)
      if (decay_days > 0) {
        const cutoff = Date.now() - decay_days * 24 * 60 * 60 * 1000;
        traceItems.sort((a, b) => {
          const aOld = new Date(a.frontmatter.learnedAt as string || 0).getTime() < cutoff ? 1 : 0;
          const bOld = new Date(b.frontmatter.learnedAt as string || 0).getTime() < cutoff ? 1 : 0;
          return aOld - bOld;
        });
      }

      // Quality gate: capture pre-evolve recall scores
      let preEvolveScores: number[] = [];
      const qualityQueries = ['test query alpha', 'test query beta', 'test query gamma'];
      if (quality_gate && !dryRun) {
        for (const q of qualityQueries) {
          const results = await this.recall(q, { limit: 3 });
          const avgScore = results.length > 0 ? results.reduce((s, r) => s + r.score, 0) / results.length : 0;
          preEvolveScores.push(avgScore);
        }
      }

      // 3. Cluster by keyword similarity
      const clusterMap = clusterTraces(
        traceItems.map(t => ({ slug: t.slug, keywords: t.keywords })),
        topicThreshold,
      );

      // 4. Consolidate each cluster
      for (const [_centroid, slugs] of clusterMap) {
        const clusterItems = slugs.map(s => traceItems.find(t => t.slug === s)!).filter(Boolean);

        if (clusterItems.length < 2) {
          // Single trace — mark evolved but don't create knowledge page
          if (!dryRun) {
            const item = clusterItems[0];
            const page = traces.find(t => t.slug === item.slug)!;
            await this.brain.put(page.slug, {
              type: page.type,
              title: page.title,
              compiled_truth: page.compiled_truth || '',
              frontmatter: { ...item.frontmatter, evolved: true, evolvedAt: new Date().toISOString() },
            });
          }
          continue;
        }

        // Pick consolidation strategy
        let compiled: string;
        switch (strategy) {
          case 'summarize':
            compiled = consolidateSummarize(clusterItems);
            break;
          case 'extract':
            compiled = consolidateExtract(clusterItems);
            break;
          case 'merge':
          default:
            compiled = consolidateMerge(clusterItems);
            break;
        }

        const topic = clusterItems[0].keywords.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' / ') || 'General';
        const slugSuffix = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        const knowledgeSlug = `knowledge-${this.defaultAgentId}-${slugSuffix}`;

        // Collect all tags
        const allTags = new Set<string>();
        for (const item of clusterItems) {
          const tags = (item.frontmatter.tags as string[]) || [];
          tags.forEach(tag => allTags.add(tag));
        }

        if (!dryRun) {
          await this.brain.put(knowledgeSlug, {
            type: 'knowledge',
            title: `Consolidated: ${topic}`,
            compiled_truth: compiled,
            frontmatter: {
              tier: 'working',
              source: 'evolve',
              strategy,
              agentId: this.defaultAgentId,
              tags: Array.from(allTags),
              sourceTraces: slugs,
              traceCount: clusterItems.length,
              consolidatedAt: new Date().toISOString(),
              access_count: 0,
            },
          });

          // Mark source traces as evolved
          for (const item of clusterItems) {
            const page = traces.find(t => t.slug === item.slug)!;
            await this.brain.put(page.slug, {
              type: page.type,
              title: page.title,
              compiled_truth: page.compiled_truth || '',
              frontmatter: {
                ...item.frontmatter,
                evolved: true,
                evolvedAt: new Date().toISOString(),
                consolidatedInto: knowledgeSlug,
              },
            });
          }
        }

        report.pagesCreated++;

        // Drift check: compare new page embedding with source trace content
        if (drift_check && !dryRun) {
          // Simple content-based drift: compare keyword overlap between merged and sources
          const mergedKeywords = extractKeywords(compiled);
          const sourceKeywords = clusterItems.flatMap(t => t.keywords);
          const sourceSet = new Set(sourceKeywords);
          const mergedSet = new Set(mergedKeywords);
          const intersection = [...mergedSet].filter(k => sourceSet.has(k)).length;
          const union = new Set([...mergedSet, ...sourceSet]).size;
          const overlapScore = union > 0 ? intersection / union : 0;
          // If overlap < 0.3 (i.e., cosine-distance-like divergence > 0.7), warn
          if (overlapScore < 0.3) {
            report.warnings.push(`Drift detected in ${knowledgeSlug}: keyword overlap ${(overlapScore * 100).toFixed(0)}% < 30% threshold`);
          }
        }

        report.clusters.push({
          topic,
          traceCount: clusterItems.length,
          outputPage: knowledgeSlug,
        });
      }

      // Quality gate: compare post-evolve recall scores
      if (quality_gate && !dryRun && preEvolveScores.length > 0) {
        const postEvolveScores: number[] = [];
        for (const q of qualityQueries) {
          const results = await this.recall(q, { limit: 3 });
          const avgScore = results.length > 0 ? results.reduce((s, r) => s + r.score, 0) / results.length : 0;
          postEvolveScores.push(avgScore);
        }
        const preAvg = preEvolveScores.reduce((a, b) => a + b, 0) / preEvolveScores.length;
        const postAvg = postEvolveScores.reduce((a, b) => a + b, 0) / postEvolveScores.length;
        if (preAvg > 0 && (preAvg - postAvg) / preAvg > 0.1) {
          // Score dropped >10% — rollback created pages
          for (const cluster of report.clusters) {
            await this.brain.delete(cluster.outputPage);
          }
          report.warnings.push(`Quality gate failed: avg recall score dropped ${(((preAvg - postAvg) / preAvg) * 100).toFixed(1)}%. Rolled back ${report.pagesCreated} pages.`);
          report.pagesCreated = 0;
          report.clusters = [];
        }
      }

      // 5. Auto-promote high-access pages
      if (!dryRun) {
        const allPages = await this.brain.list({ limit: 1000 });
        for (const page of allPages) {
          const fm = (page.frontmatter || {}) as Record<string, unknown>;
          const accessCount = (fm.access_count as number) || 0;
          const currentTier = (fm.tier as string) || 'archival';

          if (accessCount >= 5 && currentTier === 'archival') {
            await this.brain.put(page.slug, {
              type: page.type,
              title: page.title,
              compiled_truth: page.compiled_truth || '',
              frontmatter: { ...fm, tier: 'working', promotedAt: new Date().toISOString() },
            });
            report.pagesPromoted++;
          } else if (accessCount >= 15 && currentTier === 'working') {
            await this.brain.put(page.slug, {
              type: page.type,
              title: page.title,
              compiled_truth: page.compiled_truth || '',
              frontmatter: { ...fm, tier: 'core', promotedAt: new Date().toISOString() },
            });
            report.pagesPromoted++;
          }
        }
      }
    } catch (err) {
      report.errors.push(String(err));
    }

    report.finishedAt = new Date();
    return report;
  }

  /**
   * dream() - Full maintenance cycle.
   *
   * Combines evolve() (trace consolidation) with the dream cycle
   * (stale detection, re-embedding, orphan cleanup).
   */
  async dream(): Promise<{ evolveReport: EvolveReport; dreamReport: import('./dream/index.js').DreamReport }> {
    const evolveReport = await this.evolve();
    const { dream } = await import('./dream/index.js');
    const dreamReport = await dream(this.brain);
    return { evolveReport, dreamReport };
  }

  /** Get the underlying Brain instance */
  getBrain(): Brain { return this.brain; }
}
