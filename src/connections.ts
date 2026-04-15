/**
 * DeepBrain — Smart Connections
 *
 * Auto-find related pages using embedding similarity.
 * CLI: deepbrain related <slug>
 */

import type { Brain } from './core/brain.js';

export interface Connection {
  slug: string;
  title: string;
  type: string;
  score: number;
  sharedTags: string[];
  preview: string;
}

export interface ConnectionsResult {
  slug: string;
  title: string;
  connections: Connection[];
}

/**
 * Find pages related to the given slug by semantic similarity + shared tags.
 */
export async function findConnections(
  brain: Brain,
  slug: string,
  limit: number = 10,
): Promise<ConnectionsResult | null> {
  const page = await brain.get(slug);
  if (!page) return null;

  // Semantic search using the page content
  const queryText = (page.title + ' ' + page.compiled_truth).slice(0, 1000);
  const results = await brain.query(queryText, { limit: limit + 5, exclude_slugs: [slug] });

  // Get tags for source page
  const sourceTags = await brain.getTags(slug);
  const sourceTagSet = new Set(sourceTags);

  // Build connections with shared tag info
  const connections: Connection[] = [];

  for (const r of results) {
    if (r.slug === slug) continue;
    if (connections.length >= limit) break;

    const pageTags = await brain.getTags(r.slug);
    const sharedTags = pageTags.filter(t => sourceTagSet.has(t));

    // Boost score for shared tags
    const boostedScore = r.score + sharedTags.length * 0.05;

    connections.push({
      slug: r.slug,
      title: r.title,
      type: r.type,
      score: boostedScore,
      sharedTags,
      preview: r.chunk_text.slice(0, 200),
    });
  }

  // Sort by boosted score
  connections.sort((a, b) => b.score - a.score);

  return {
    slug,
    title: page.title,
    connections,
  };
}

/**
 * Format connections for CLI output.
 */
export function formatConnections(result: ConnectionsResult): string {
  if (result.connections.length === 0) {
    return `No connections found for "${result.title}".`;
  }

  const lines = [`\n🔗 Related to "${result.title}" (${result.connections.length} connections)\n`];

  for (const c of result.connections) {
    const tagStr = c.sharedTags.length > 0 ? ` [shared: ${c.sharedTags.join(', ')}]` : '';
    lines.push(`  📄 ${c.title} (${c.type}) — score: ${c.score.toFixed(4)}${tagStr}`);
    lines.push(`     ${c.preview.slice(0, 120)}...\n`);
  }

  return lines.join('\n');
}
