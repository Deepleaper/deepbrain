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
   * Actual knowledge consolidation:
   * 1. Find traces that haven't been consolidated
   * 2. Group related traces by semantic similarity
   * 3. Create consolidated knowledge pages from groups
   * 4. Track lineage (which traces contributed)
   * 5. Promote frequently-accessed knowledge to higher tiers
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
      // 1. Find unprocessed traces (not yet evolved)
      const allTraces = await this.brain.list({
        type: 'trace',
        limit: batchSize,
      });

      const traces = allTraces.filter(t => {
        const fm = (t.frontmatter || {}) as Record<string, unknown>;
        return !fm.evolved;
      });

      report.tracesProcessed = traces.length;

      if (traces.length < minTraces) {
        report.finishedAt = new Date();
        return report;
      }

      if (!dryRun) {
        // 2. Group related traces by semantic similarity
        const groups = await this.groupRelatedTraces(traces);

        // 3. Create consolidated knowledge pages from each group
        for (const group of groups) {
          if (group.length < 2) {
            // Single trace — just mark as evolved, don't consolidate
            const trace = group[0];
            const fm = (trace.frontmatter || {}) as Record<string, unknown>;
            await this.brain.put(trace.slug, {
              type: trace.type,
              title: trace.title,
              compiled_truth: trace.compiled_truth || '',
              frontmatter: { ...fm, evolved: true, evolvedAt: new Date().toISOString() },
            });
            continue;
          }

          try {
            // Create consolidated knowledge page
            const slugSuffix = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
            const knowledgeSlug = `knowledge-${this.defaultAgentId}-${slugSuffix}`;

            // Build compiled_truth from all traces in the group
            const traceContents = group.map(t => t.compiled_truth || t.title || '').filter(Boolean);
            const traceSlugs = group.map(t => t.slug);
            const traceTitles = group.map(t => t.title).filter(Boolean);

            // Auto-summarize: create a compiled truth that merges the traces
            const summary = this.summarizeTraces(traceTitles, traceContents);

            // Collect all tags from contributing traces
            const allTags = new Set<string>();
            for (const t of group) {
              const fm = (t.frontmatter || {}) as Record<string, unknown>;
              const tags = (fm.tags as string[]) || [];
              tags.forEach(tag => allTags.add(tag));
            }

            await this.brain.put(knowledgeSlug, {
              type: 'knowledge',
              title: `Consolidated: ${traceTitles[0] || 'traces'}`,
              compiled_truth: summary,
              frontmatter: {
                tier: 'working',
                source: 'evolve',
                agentId: this.defaultAgentId,
                tags: Array.from(allTags),
                sourceTraces: traceSlugs,
                traceCount: group.length,
                consolidatedAt: new Date().toISOString(),
                access_count: 0,
              },
            });
            report.pagesCreated++;

            // Mark all source traces as evolved with lineage reference
            for (const trace of group) {
              const fm = (trace.frontmatter || {}) as Record<string, unknown>;
              await this.brain.put(trace.slug, {
                type: trace.type,
                title: trace.title,
                compiled_truth: trace.compiled_truth || '',
                frontmatter: {
                  ...fm,
                  evolved: true,
                  evolvedAt: new Date().toISOString(),
                  consolidatedInto: knowledgeSlug,
                },
              });
            }
          } catch (err) {
            report.errors.push(`Group consolidation error: ${String(err)}`);
          }
        }

        // 4. Auto-promote high-access pages
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

  /**
   * Group related traces by semantic similarity using the brain's query() method.
   * Uses a simple greedy clustering: for each unassigned trace, find similar ones.
   */
  private async groupRelatedTraces(traces: import('./core/types.js').Page[]): Promise<import('./core/types.js').Page[][]> {
    const groups: import('./core/types.js').Page[][] = [];
    const assigned = new Set<string>();

    for (const trace of traces) {
      if (assigned.has(trace.slug)) continue;

      const group: import('./core/types.js').Page[] = [trace];
      assigned.add(trace.slug);

      // Use the trace's content to find similar traces
      const queryText = trace.compiled_truth || trace.title || '';
      if (!queryText) continue;

      try {
        const similar = await this.brain.query(queryText, { limit: 10 });

        for (const result of similar) {
          // Only group with other unassigned traces
          if (assigned.has(result.slug)) continue;
          if (result.type !== 'trace') continue;
          // Similarity threshold: score > 0.5 indicates meaningful relation
          if (result.score < 0.5) continue;

          // Find the matching trace object
          const matchingTrace = traces.find(t => t.slug === result.slug);
          if (matchingTrace) {
            group.push(matchingTrace);
            assigned.add(result.slug);
          }
        }
      } catch {
        // If query fails, just keep the single-trace group
      }

      groups.push(group);
    }

    return groups;
  }

  /**
   * Summarize a group of traces into a consolidated compiled_truth.
   */
  private summarizeTraces(titles: string[], contents: string[]): string {
    const sections: string[] = [];

    sections.push(`# Consolidated Knowledge`);
    sections.push('');
    sections.push(`> Auto-consolidated from ${contents.length} related traces.`);
    sections.push('');

    // Deduplicate and merge content
    const uniqueContents = [...new Set(contents)];
    for (let i = 0; i < uniqueContents.length; i++) {
      const title = titles[i] || `Trace ${i + 1}`;
      sections.push(`## ${title}`);
      sections.push('');
      sections.push(uniqueContents[i]);
      sections.push('');
    }

    return sections.join('\n');
  }

  /** Get the underlying Brain instance */
  getBrain(): Brain { return this.brain; }
}
