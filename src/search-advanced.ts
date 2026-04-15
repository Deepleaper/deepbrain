/**
 * DeepBrain — Advanced Search
 *
 * Faceted search, fuzzy matching, search suggestions, autocomplete.
 */

import type { Brain } from './core/brain.js';
import type { SearchResult, SearchOpts } from './core/types.js';

// ── Types ─────────────────────────────────────────────────────────

export interface AdvancedSearchOpts extends SearchOpts {
  tag?: string;
  tags?: string[];
  after?: string;   // date string YYYY-MM-DD
  before?: string;
  source?: string;  // chunk_source filter
  tier?: string;    // memory tier filter
  fuzzy?: boolean;
  suggest?: boolean;
}

export interface SearchSuggestion {
  term: string;
  score: number;
  source: 'tag' | 'title' | 'slug';
}

export interface FacetedResults {
  results: SearchResult[];
  facets: {
    types: Array<{ value: string; count: number }>;
    tags: Array<{ value: string; count: number }>;
  };
  suggestions: SearchSuggestion[];
  total: number;
}

// ── Fuzzy Matching ────────────────────────────────────────────────

/**
 * Simple Levenshtein distance for fuzzy matching.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

/**
 * Fuzzy match score (0-1, higher is better).
 */
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Exact substring match
  if (t.includes(q)) return 1.0;

  // Prefix match
  if (t.startsWith(q)) return 0.95;

  // Levenshtein-based score
  const distance = levenshtein(q, t.slice(0, q.length + 2));
  const maxLen = Math.max(q.length, t.length);
  return Math.max(0, 1 - distance / maxLen);
}

// ── Advanced Search ───────────────────────────────────────────────

/**
 * Advanced search with facets, fuzzy matching, and suggestions.
 */
export async function advancedSearch(
  brain: Brain,
  queryText: string,
  opts: AdvancedSearchOpts = {},
): Promise<FacetedResults> {
  const limit = opts.limit ?? 20;

  // Base search — use semantic or keyword depending on query length
  let baseResults: SearchResult[];
  if (queryText.length > 3) {
    try {
      baseResults = await brain.query(queryText, { limit: limit * 3, type: opts.type });
    } catch {
      baseResults = await brain.search(queryText, { limit: limit * 3, type: opts.type });
    }
  } else {
    baseResults = await brain.search(queryText, { limit: limit * 3, type: opts.type });
  }

  // Get all pages for facet data
  const allPages = await brain.list({ limit: 500 });
  const pageMap = new Map(allPages.map(p => [p.slug, p]));

  // Apply filters
  let filtered = baseResults;

  // Tag filter
  if (opts.tag || opts.tags?.length) {
    const requiredTags = opts.tags ?? (opts.tag ? [opts.tag] : []);
    const filteredSlugs = new Set<string>();

    for (const result of baseResults) {
      const tags = await brain.getTags(result.slug);
      if (requiredTags.every(t => tags.includes(t))) {
        filteredSlugs.add(result.slug);
      }
    }

    filtered = filtered.filter(r => filteredSlugs.has(r.slug));
  }

  // Date filter
  if (opts.after || opts.before) {
    filtered = filtered.filter(r => {
      const page = pageMap.get(r.slug);
      if (!page) return true;
      const updated = new Date(page.updated_at);
      if (opts.after && updated < new Date(opts.after)) return false;
      if (opts.before && updated > new Date(opts.before)) return false;
      return true;
    });
  }

  // Tier filter
  if (opts.tier) {
    filtered = filtered.filter(r => {
      const page = pageMap.get(r.slug);
      if (!page) return true;
      return (page.frontmatter as any)?.tier === opts.tier;
    });
  }

  // Fuzzy matching boost
  if (opts.fuzzy) {
    filtered = filtered.map(r => ({
      ...r,
      score: r.score + fuzzyScore(queryText, r.title ?? r.slug) * 0.3,
    }));
    filtered.sort((a, b) => b.score - a.score);
  }

  // Build facets
  const typeCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();

  for (const r of filtered) {
    const page = pageMap.get(r.slug);
    if (page) {
      typeCounts.set(page.type, (typeCounts.get(page.type) ?? 0) + 1);
    }
    const tags = await brain.getTags(r.slug);
    for (const tag of tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  // Generate suggestions
  const suggestions: SearchSuggestion[] = [];
  if (opts.suggest !== false) {
    // From tags
    const allTags = new Set<string>();
    for (const page of allPages) {
      const tags = await brain.getTags(page.slug);
      tags.forEach(t => allTags.add(t));
    }
    for (const tag of allTags) {
      const score = fuzzyScore(queryText, tag);
      if (score > 0.3) {
        suggestions.push({ term: tag, score, source: 'tag' });
      }
    }

    // From titles
    for (const page of allPages) {
      const score = fuzzyScore(queryText, page.title);
      if (score > 0.3) {
        suggestions.push({ term: page.title, score, source: 'title' });
      }
    }

    // From slugs
    for (const page of allPages) {
      const score = fuzzyScore(queryText, page.slug);
      if (score > 0.4) {
        suggestions.push({ term: page.slug, score, source: 'slug' });
      }
    }

    suggestions.sort((a, b) => b.score - a.score);
  }

  const finalResults = filtered.slice(0, limit);

  return {
    results: finalResults,
    facets: {
      types: Array.from(typeCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      tags: Array.from(tagCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
    },
    suggestions: suggestions.slice(0, 10),
    total: filtered.length,
  };
}

// ── Formatting ────────────────────────────────────────────────────

export function formatAdvancedResults(results: FacetedResults, query: string): string {
  const lines: string[] = [];

  lines.push(`\n🔍 Advanced Search: "${query}" — ${results.total} results\n`);

  // Results
  if (results.results.length > 0) {
    for (const r of results.results) {
      lines.push(`  📄 ${r.slug} (${r.type}) — score: ${r.score.toFixed(4)}`);
      lines.push(`     ${(r.chunk_text ?? '').slice(0, 120)}\n`);
    }
  } else {
    lines.push('  No results found.');
  }

  // Facets
  if (results.facets.types.length > 0) {
    lines.push(`📊 Types: ${results.facets.types.map(f => `${f.value}(${f.count})`).join(', ')}`);
  }
  if (results.facets.tags.length > 0) {
    lines.push(`🏷️  Tags: ${results.facets.tags.map(f => `${f.value}(${f.count})`).join(', ')}`);
  }

  // Suggestions
  if (results.suggestions.length > 0) {
    lines.push(`\n💡 Did you mean: ${results.suggestions.slice(0, 5).map(s => s.term).join(', ')}`);
  }

  return lines.join('\n');
}
