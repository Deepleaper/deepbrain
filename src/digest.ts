/**
 * DeepBrain — Smart Digest
 *
 * Weekly/daily digest of new knowledge added.
 * Highlight connections between new and old knowledge.
 */

import type { Brain } from './core/brain.js';
import { createChat } from 'agentkits';
import type { ChatMessage } from 'agentkits';

// ── Types ─────────────────────────────────────────────────────────

export interface DigestConfig {
  period: 'daily' | 'weekly' | 'monthly';
  provider?: string;
  model?: string;
  apiKey?: string;
}

export interface DigestEntry {
  slug: string;
  title: string;
  type: string;
  summary: string;
  tags: string[];
  addedAt: Date;
}

export interface DigestConnection {
  newPage: string;
  oldPage: string;
  reason: string;
}

export interface Digest {
  period: string;
  startDate: string;
  endDate: string;
  newPages: DigestEntry[];
  updatedPages: DigestEntry[];
  connections: DigestConnection[];
  highlights: string[];
  stats: {
    totalNew: number;
    totalUpdated: number;
    topTags: Array<{ tag: string; count: number }>;
    topTypes: Array<{ type: string; count: number }>;
  };
}

// ── Period Helpers ─────────────────────────────────────────────────

function getPeriodRange(period: 'daily' | 'weekly' | 'monthly'): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();

  switch (period) {
    case 'daily':
      start.setDate(start.getDate() - 1);
      break;
    case 'weekly':
      start.setDate(start.getDate() - 7);
      break;
    case 'monthly':
      start.setMonth(start.getMonth() - 1);
      break;
  }

  return { start, end };
}

// ── Digest Generation ─────────────────────────────────────────────

/**
 * Generate a smart digest for the specified period.
 */
export async function generateDigest(brain: Brain, config: DigestConfig): Promise<Digest> {
  const { start, end } = getPeriodRange(config.period);
  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];

  // Get all pages
  const allPages = await brain.list({ limit: 500 });

  // Filter by date
  const newPages: DigestEntry[] = [];
  const updatedPages: DigestEntry[] = [];
  const tagCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();

  for (const page of allPages) {
    const created = new Date(page.created_at);
    const updated = new Date(page.updated_at);
    const tags = await brain.getTags(page.slug);
    const summary = (page.frontmatter as any)?.summary ?? page.compiled_truth.slice(0, 150);

    const entry: DigestEntry = {
      slug: page.slug,
      title: page.title,
      type: page.type,
      summary,
      tags,
      addedAt: created,
    };

    if (created >= start && created <= end) {
      newPages.push(entry);
    } else if (updated >= start && updated <= end) {
      updatedPages.push(entry);
    }

    // Count tags and types for new/updated pages
    if (created >= start || updated >= start) {
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
      typeCounts.set(page.type, (typeCounts.get(page.type) ?? 0) + 1);
    }
  }

  // Find connections between new and old knowledge
  const connections: DigestConnection[] = [];
  for (const newPage of newPages) {
    const links = await brain.getLinks(newPage.slug);
    for (const link of links) {
      const target = allPages.find(p => p.slug === link.to_slug);
      if (target && new Date(target.created_at) < start) {
        connections.push({
          newPage: newPage.title,
          oldPage: target.title,
          reason: link.context || `Linked via ${link.link_type}`,
        });
      }
    }

    // Also check backlinks
    const backlinks = await brain.getBacklinks(newPage.slug);
    for (const link of backlinks) {
      const source = allPages.find(p => p.slug === link.from_slug);
      if (source && new Date(source.created_at) < start) {
        connections.push({
          newPage: newPage.title,
          oldPage: source.title,
          reason: link.context || `Backlinked via ${link.link_type}`,
        });
      }
    }
  }

  // Generate highlights using LLM if available
  let highlights: string[] = [];
  if (config.provider && newPages.length > 0) {
    highlights = await generateHighlights(newPages, updatedPages, connections, config);
  }

  // Build stats
  const topTags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topTypes = Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    period: config.period,
    startDate: startStr,
    endDate: endStr,
    newPages,
    updatedPages,
    connections,
    highlights,
    stats: {
      totalNew: newPages.length,
      totalUpdated: updatedPages.length,
      topTags,
      topTypes,
    },
  };
}

async function generateHighlights(
  newPages: DigestEntry[],
  updatedPages: DigestEntry[],
  connections: DigestConnection[],
  config: DigestConfig,
): Promise<string[]> {
  try {
    const chat = createChat({
      provider: (config.provider ?? 'ollama') as any,
      model: config.model,
      apiKey: config.apiKey,
    });

    const context = [
      'New pages:', ...newPages.map(p => `- ${p.title}: ${p.summary}`),
      'Updated pages:', ...updatedPages.map(p => `- ${p.title}: ${p.summary}`),
      'Connections:', ...connections.map(c => `- "${c.newPage}" connects to "${c.oldPage}": ${c.reason}`),
    ].join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'Generate 3-5 brief insight highlights about the new knowledge. Return ONLY a JSON array of strings. Focus on patterns, connections, and notable additions.',
      },
      { role: 'user', content: context.slice(0, 3000) },
    ];

    const response = await chat.chat(messages, { maxTokens: 500 });
    const match = response.content.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
  } catch {
    // LLM highlights are optional
  }
  return [];
}

// ── Formatting ────────────────────────────────────────────────────

/**
 * Format digest for terminal display.
 */
export function formatDigest(digest: Digest): string {
  const lines: string[] = [];

  lines.push(`\n📋 ${digest.period.charAt(0).toUpperCase() + digest.period.slice(1)} Digest`);
  lines.push(`   Period: ${digest.startDate} → ${digest.endDate}\n`);

  // Stats
  lines.push(`📊 Stats: ${digest.stats.totalNew} new, ${digest.stats.totalUpdated} updated`);
  if (digest.stats.topTags.length > 0) {
    lines.push(`   Top tags: ${digest.stats.topTags.map(t => `${t.tag}(${t.count})`).join(', ')}`);
  }
  if (digest.stats.topTypes.length > 0) {
    lines.push(`   Types: ${digest.stats.topTypes.map(t => `${t.type}(${t.count})`).join(', ')}`);
  }

  // New pages
  if (digest.newPages.length > 0) {
    lines.push(`\n✨ New Knowledge (${digest.newPages.length}):`);
    for (const p of digest.newPages) {
      lines.push(`   📄 ${p.title} (${p.type})`);
      if (p.summary) lines.push(`      ${p.summary.slice(0, 100)}`);
    }
  }

  // Updated pages
  if (digest.updatedPages.length > 0) {
    lines.push(`\n🔄 Updated (${digest.updatedPages.length}):`);
    for (const p of digest.updatedPages) {
      lines.push(`   📝 ${p.title} (${p.type})`);
    }
  }

  // Connections
  if (digest.connections.length > 0) {
    lines.push(`\n🔗 New Connections:`);
    for (const c of digest.connections) {
      lines.push(`   "${c.newPage}" ↔ "${c.oldPage}" — ${c.reason}`);
    }
  }

  // Highlights
  if (digest.highlights.length > 0) {
    lines.push(`\n💡 Highlights:`);
    for (const h of digest.highlights) {
      lines.push(`   • ${h}`);
    }
  }

  if (digest.newPages.length === 0 && digest.updatedPages.length === 0) {
    lines.push('\n   No new knowledge added in this period.');
  }

  return lines.join('\n');
}
