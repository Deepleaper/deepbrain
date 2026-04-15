/**
 * DeepBrain - Memory Hierarchy (Tiers)
 *
 * Inspired by Letta + memU. Three-tier memory system:
 * - Core: Always in context, high priority
 * - Working: Current session context
 * - Archival: Long-term searchable storage
 *
 * Auto-promotion/demotion based on access patterns.
 */

import type { Brain } from './core/brain.js';
import type { Page } from './core/types.js';

export type MemoryTier = 'core' | 'working' | 'archival';

export interface TierConfig {
  /** Access count threshold for auto-promotion to core */
  promoteThreshold: number;
  /** Days without access before demotion to archival */
  demoteDays: number;
  /** Max items in core memory */
  coreMaxItems: number;
  /** Max items in working memory */
  workingMaxItems: number;
}

export const DEFAULT_TIER_CONFIG: TierConfig = {
  promoteThreshold: 5,
  demoteDays: 30,
  coreMaxItems: 20,
  workingMaxItems: 50,
};

export interface TierStats {
  core: number;
  working: number;
  archival: number;
}

/**
 * Get the tier of a memory page from its frontmatter.
 */
export function getPageTier(page: Page): MemoryTier {
  return (page.frontmatter?.tier as MemoryTier) || 'archival';
}

/**
 * Get all pages in a specific tier.
 */
export async function getByTier(brain: Brain, tier: MemoryTier): Promise<Page[]> {
  const allPages = await brain.list({ limit: 1000 });
  return allPages.filter(p => getPageTier(p) === tier);
}

/**
 * Get tier statistics.
 */
export async function getTierStats(brain: Brain): Promise<TierStats> {
  const allPages = await brain.list({ limit: 10000 });
  const stats: TierStats = { core: 0, working: 0, archival: 0 };
  for (const p of allPages) {
    const tier = getPageTier(p);
    stats[tier]++;
  }
  return stats;
}

/**
 * Record an access to a page (for auto-promotion tracking).
 */
export async function recordAccess(brain: Brain, slug: string): Promise<void> {
  const page = await brain.get(slug);
  if (!page) return;

  const fm = page.frontmatter as Record<string, unknown>;
  const accessCount = ((fm.access_count as number) || 0) + 1;
  const lastAccess = new Date().toISOString();

  await brain.put(slug, {
    ...page,
    frontmatter: { ...fm, access_count: accessCount, last_access: lastAccess },
  });
}

/**
 * Set a page's tier explicitly.
 */
export async function setTier(brain: Brain, slug: string, tier: MemoryTier): Promise<void> {
  const page = await brain.get(slug);
  if (!page) throw new Error(`Page not found: ${slug}`);

  await brain.put(slug, {
    ...page,
    frontmatter: { ...page.frontmatter, tier, tier_changed_at: new Date().toISOString() },
  });
}

/**
 * Run auto-promotion/demotion cycle.
 */
export async function runTierCycle(brain: Brain, config: Partial<TierConfig> = {}): Promise<{ promoted: string[]; demoted: string[] }> {
  const cfg = { ...DEFAULT_TIER_CONFIG, ...config };
  const allPages = await brain.list({ limit: 10000 });
  const promoted: string[] = [];
  const demoted: string[] = [];
  const now = Date.now();

  for (const page of allPages) {
    const fm = page.frontmatter as Record<string, unknown>;
    const tier = getPageTier(page);
    const accessCount = (fm.access_count as number) || 0;
    const lastAccess = fm.last_access ? new Date(fm.last_access as string).getTime() : page.updated_at.getTime();
    const daysSinceAccess = (now - lastAccess) / 86400000;

    // Auto-promote: high access count → core
    if (tier !== 'core' && accessCount >= cfg.promoteThreshold) {
      await setTier(brain, page.slug, 'core');
      promoted.push(page.slug);
    }
    // Auto-demote: old unused → archival
    else if (tier !== 'archival' && daysSinceAccess > cfg.demoteDays) {
      await setTier(brain, page.slug, 'archival');
      demoted.push(page.slug);
    }
  }

  // Enforce core max items (demote lowest access count)
  const corePages = allPages
    .filter(p => getPageTier(p) === 'core' || promoted.includes(p.slug))
    .sort((a, b) => ((b.frontmatter as any).access_count || 0) - ((a.frontmatter as any).access_count || 0));

  if (corePages.length > cfg.coreMaxItems) {
    for (const page of corePages.slice(cfg.coreMaxItems)) {
      await setTier(brain, page.slug, 'working');
      demoted.push(page.slug);
    }
  }

  return { promoted, demoted };
}

/**
 * Get core memories formatted for context injection.
 */
export async function getCoreContext(brain: Brain): Promise<string> {
  const corePages = await getByTier(brain, 'core');
  if (corePages.length === 0) return '';

  const lines = ['🧠 Core Memories:'];
  for (const p of corePages) {
    lines.push(`\n### ${p.title}`);
    lines.push(p.compiled_truth.slice(0, 300));
  }
  return lines.join('\n');
}
