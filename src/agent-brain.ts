import type { Brain } from './core/brain.js';
import type { SearchResult } from './core/types.js';
import {
  extractKeywords, similarity, clusterTraces, dedupSentences,
  consolidateMerge, consolidateSummarize, consolidateExtract,
  type EvolveOptions as EvolveOptsNew, type EvolveResult, type TraceItem,
} from './evolve/index.js';

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
}

export { EvolveOptions, EvolveResult } from './evolve/index.js';

export interface EvolveReport {
  tracesProcessed: number;
  pagesCreated: number;
  pagesUpdated: number;
  pagesPromoted: number;
  errors: string[];
  startedAt: Date;
  finishedAt: Date;
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
      limit: options.limit || 10,
      owner: options.agentId,
    });

    // Filter by tags if specified
    if (options.tags?.length) {
      // Tags filtering happens at page level
      return results; // TODO: filter by tags when brain supports it
    }

    return results;
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
  async evolve(options: EvolveOptsNew & { batchSize?: number } = {}): Promise<EvolveResult & EvolveReport> {
    const {
      batchSize = 50,
      minTraces = 5,
      dryRun = false,
      strategy = 'merge',
      topicThreshold = 0.2,
      maxAge,
    } = options;

    const report: EvolveResult & EvolveReport = {
      tracesProcessed: 0,
      pagesCreated: 0,
      pagesUpdated: 0,
      pagesPromoted: 0,
      clusters: [],
      dryRun: !!dryRun,
      errors: [],
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
        report.clusters.push({
          topic,
          traceCount: clusterItems.length,
          outputPage: knowledgeSlug,
        });
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
