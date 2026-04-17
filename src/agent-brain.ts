import type { Brain } from './core/brain.js';
import type { SearchResult } from './core/types.js';

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

export interface EvolveOptions {
  /** Max traces to process per cycle */
  batchSize?: number;
  /** Min traces before triggering consolidation */
  minTraces?: number;
  /** Dry run (report what would change without changing) */
  dryRun?: boolean;
}

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
   * evolve() - Consolidate traces into refined knowledge.
   *
   * Similar to dream() but focused on trace consolidation:
   * 1. Find traces that haven't been consolidated
   * 2. Group related traces
   * 3. Extract patterns and create/update knowledge pages
   * 4. Promote frequently-accessed knowledge to higher tiers
   */
  async evolve(options: EvolveOptions = {}): Promise<EvolveReport> {
    const { batchSize = 50, minTraces = 3, dryRun = false } = options;

    const report: EvolveReport = {
      tracesProcessed: 0,
      pagesCreated: 0,
      pagesUpdated: 0,
      pagesPromoted: 0,
      errors: [],
      startedAt: new Date(),
      finishedAt: new Date(),
    };

    try {
      // 1. Find unprocessed traces
      const traces = await this.brain.list({
        type: 'trace',
        limit: batchSize,
      });

      report.tracesProcessed = traces.length;

      if (traces.length < minTraces) {
        report.finishedAt = new Date();
        return report;
      }

      if (!dryRun) {
        // 2. Mark traces as processed
        for (const trace of traces) {
          const fm = (trace.frontmatter || {}) as Record<string, unknown>;
          if (!fm.evolved) {
            await this.brain.put(trace.slug, {
              type: trace.type,
              title: trace.title,
              compiled_truth: trace.compiled_truth || '',
              frontmatter: { ...fm, evolved: true, evolvedAt: new Date().toISOString() },
            });
          }
        }

        // 3. Auto-promote high-access pages
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

  /** Get the underlying Brain instance */
  getBrain(): Brain { return this.brain; }
}
