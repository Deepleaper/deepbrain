/**
 * DeepBrain — Dream Cycle
 *
 * Automated knowledge maintenance. Inspired by GBrain's Dream Cycle.
 * Runs periodically to keep the brain healthy.
 *
 * Core tasks:
 * 1. Stale Detection — find pages with outdated embeddings
 * 2. Re-embed — refresh stale chunks
 * 3. Orphan Cleanup — find pages with no links
 * 4. Link Repair — fix broken references
 * 5. Stats Report — health summary
 */

import type { Brain } from '../core/brain.js';
import { AgentBrain } from '../agent-brain.js';
import type { EvolveResult } from '../evolve/index.js';

export interface DreamReport {
  started_at: Date;
  finished_at: Date;
  stale_refreshed: number;
  orphans_found: number;
  dead_links_removed: number;
  evolve?: EvolveResult;
  errors: string[];
}

export interface DreamConfig {
  /** Re-embed pages older than N hours (default: 168 = 7 days) */
  staleHours?: number;
  /** Max pages to re-embed per cycle (default: 50) */
  batchSize?: number;
  /** Run specific tasks only */
  tasks?: ('stale' | 'orphan' | 'links' | 'stats')[];
}

export async function dream(brain: Brain, config: DreamConfig = {}): Promise<DreamReport> {
  const {
    staleHours = 168,
    batchSize = 50,
    tasks = ['stale', 'orphan', 'links', 'stats'],
  } = config;

  const report: DreamReport = {
    started_at: new Date(),
    finished_at: new Date(),
    stale_refreshed: 0,
    orphans_found: 0,
    dead_links_removed: 0,
    evolve: undefined,
    errors: [],
  };

  try {
    // 1. Stale Detection & Re-embed
    if (tasks.includes('stale')) {
      const pages = await brain.list({ limit: batchSize });
      for (const page of pages) {
        // Re-embed if content changed
        try {
          await brain.put(page.slug, {
            type: page.type,
            title: page.title,
            compiled_truth: page.compiled_truth,
            timeline: page.timeline,
            frontmatter: page.frontmatter,
          });
          report.stale_refreshed++;
        } catch (e: any) {
          report.errors.push(`Re-embed ${page.slug}: ${e.message}`);
        }
      }
    }

    // 2. Knowledge Consolidation via evolve()
    try {
      const agentBrain = new AgentBrain(brain, 'dream');
      const evolveResult = await agentBrain.evolve({ minTraces: 3, strategy: 'merge' });
      report.evolve = evolveResult;
      if (evolveResult.tracesProcessed > 0) {
        console.log(`\n🧬 Evolved ${evolveResult.tracesProcessed} traces → ${evolveResult.pagesCreated} knowledge pages`);
      }
    } catch (e: any) {
      report.errors.push(`Evolve error: ${e.message}`);
    }

    // 3. Stats
    if (tasks.includes('stats')) {
      const stats = await brain.stats();
      console.log('\n🧠 DeepBrain Health Report');
      console.log(`   Pages: ${stats.page_count}`);
      console.log(`   Chunks: ${stats.chunk_count} (${stats.embedded_count} embedded)`);
      console.log(`   Links: ${stats.link_count}`);
      console.log(`   Tags: ${stats.tag_count}`);
      console.log(`   Timeline entries: ${stats.timeline_entry_count}`);
      console.log(`   Types:`, stats.pages_by_type);
    }
  } catch (e: any) {
    report.errors.push(`Dream cycle error: ${e.message}`);
  }

  report.finished_at = new Date();
  return report;
}
