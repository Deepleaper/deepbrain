/**
 * DeepBrain - Temporal Tracking
 *
 * Inspired by Zep. Track when facts were learned, changed,
 * and query knowledge as-of a specific date.
 */

import type { Brain } from './core/brain.js';
import type { Page, TimelineEntry } from './core/types.js';

export interface TemporalMetadata {
  created_at: string;
  updated_at: string;
  valid_from?: string;
  valid_until?: string;
  superseded_by?: string;
  version: number;
}

export interface TemporalSnapshot {
  slug: string;
  title: string;
  content: string;
  asOf: string;
  timeline: TimelineEntry[];
}

export interface KnowledgeEvolution {
  slug: string;
  title: string;
  events: {
    date: string;
    type: 'created' | 'updated' | 'superseded' | 'expired';
    summary: string;
    detail?: string;
  }[];
}

/**
 * Store a memory with temporal metadata.
 */
export async function storeWithTemporal(
  brain: Brain,
  slug: string,
  content: string,
  opts: { title?: string; type?: string; validFrom?: string; validUntil?: string } = {},
): Promise<void> {
  const existing = await brain.get(slug);
  const version = existing ? ((existing.frontmatter as any).version || 0) + 1 : 1;
  const now = new Date().toISOString();

  await brain.put(slug, {
    type: opts.type || existing?.type || 'note',
    title: opts.title || existing?.title || slug,
    compiled_truth: content,
    frontmatter: {
      ...(existing?.frontmatter || {}),
      version,
      valid_from: opts.validFrom || now,
      valid_until: opts.validUntil || null,
      temporal_updated_at: now,
    },
  });

  // Add timeline entry for the change
  await brain.addTimeline(slug, {
    date: now.slice(0, 10),
    source: 'temporal-tracker',
    summary: version === 1 ? 'Initial creation' : `Updated to version ${version}`,
    detail: content.slice(0, 200),
  });
}

/**
 * Query what was known about a topic as of a specific date.
 */
export async function queryAsOf(brain: Brain, slug: string, asOfDate: string): Promise<TemporalSnapshot | null> {
  const page = await brain.get(slug);
  if (!page) return null;

  // Get timeline entries up to the date
  const timeline = await brain.getTimeline(slug, { before: asOfDate });

  // If the page was created after the date, we didn't know about it
  const createdAt = page.created_at instanceof Date ? page.created_at.toISOString() : String(page.created_at);
  if (createdAt.slice(0, 10) > asOfDate) {
    return null;
  }

  // Find the most recent timeline entry as of that date for content
  const relevantEntry = timeline[0]; // Already sorted DESC by date

  return {
    slug: page.slug,
    title: page.title,
    content: relevantEntry?.detail || page.compiled_truth,
    asOf: asOfDate,
    timeline,
  };
}

/**
 * Build a knowledge evolution timeline for a topic.
 */
export async function getKnowledgeEvolution(brain: Brain, slug: string): Promise<KnowledgeEvolution | null> {
  const page = await brain.get(slug);
  if (!page) return null;

  const timeline = await brain.getTimeline(slug, { limit: 100 });

  const events = timeline.reverse().map(entry => ({
    date: entry.date,
    type: entry.summary.includes('Initial') ? 'created' as const :
          entry.summary.includes('superseded') ? 'superseded' as const :
          entry.summary.includes('expired') ? 'expired' as const :
          'updated' as const,
    summary: entry.summary,
    detail: entry.detail || undefined,
  }));

  return { slug, title: page.title, events };
}

/**
 * Format a knowledge evolution as a readable timeline.
 */
export function formatTimeline(evolution: KnowledgeEvolution): string {
  const lines = [`📅 Timeline: ${evolution.title} (${evolution.slug})\n`];

  if (evolution.events.length === 0) {
    lines.push('  No recorded changes.');
    return lines.join('\n');
  }

  for (const event of evolution.events) {
    const icon = event.type === 'created' ? '🟢' :
                 event.type === 'updated' ? '🔄' :
                 event.type === 'superseded' ? '⚠️' : '🔴';
    lines.push(`  ${icon} ${event.date} — ${event.summary}`);
    if (event.detail) {
      lines.push(`    ${event.detail.slice(0, 100)}${event.detail.length > 100 ? '...' : ''}`);
    }
  }

  return lines.join('\n');
}
