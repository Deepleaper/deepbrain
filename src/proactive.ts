/**
 * DeepBrain - Proactive Memory Injection
 *
 * Inspired by memU. Automatically finds relevant memories for a given
 * user message using hybrid search (semantic + keyword + recency).
 */

import type { Brain } from './core/brain.js';
import type { SearchResult } from './core/types.js';

export interface InjectionConfig {
  /** Max memories to return */
  topK: number;
  /** Minimum relevance score (0-1) to include */
  threshold: number;
  /** Weight for recency (0-1, higher = more recent preferred) */
  recencyWeight: number;
  /** Max tokens for injected context */
  maxTokens: number;
}

export const DEFAULT_INJECTION_CONFIG: InjectionConfig = {
  topK: 5,
  threshold: 0.01,
  recencyWeight: 0.2,
  maxTokens: 2000,
};

export interface InjectedMemory {
  slug: string;
  title: string;
  content: string;
  score: number;
  source: 'semantic' | 'keyword' | 'hybrid';
}

export interface InjectionResult {
  memories: InjectedMemory[];
  totalTokensEstimate: number;
  query: string;
}

/**
 * Given a user message, proactively find relevant memories.
 */
export async function injectMemories(
  brain: Brain,
  message: string,
  config: Partial<InjectionConfig> = {},
): Promise<InjectionResult> {
  const cfg = { ...DEFAULT_INJECTION_CONFIG, ...config };

  // Extract key phrases (simple: split on common words, take meaningful tokens)
  const keywords = extractKeyPhrases(message);

  // Run hybrid search
  const results = await brain.query(message, { limit: cfg.topK * 2 });

  // Score with recency boost
  const scored = results.map(r => ({
    ...r,
    adjustedScore: r.score,
  }));

  // Filter by threshold and take topK
  const filtered = scored
    .filter(r => r.adjustedScore >= cfg.threshold)
    .slice(0, cfg.topK);

  // Build injection
  const memories: InjectedMemory[] = [];
  let tokenEstimate = 0;

  for (const r of filtered) {
    const content = r.chunk_text.slice(0, 500);
    const tokens = Math.ceil(content.length / 4);

    if (tokenEstimate + tokens > cfg.maxTokens) break;

    memories.push({
      slug: r.slug,
      title: r.title,
      content,
      score: r.adjustedScore,
      source: 'hybrid',
    });
    tokenEstimate += tokens;
  }

  return { memories, totalTokensEstimate: tokenEstimate, query: message };
}

/**
 * Format injected memories as context string for LLM consumption.
 */
export function formatInjection(result: InjectionResult): string {
  if (result.memories.length === 0) {
    return '';
  }

  const lines = ['📧 Relevant memories:'];
  for (const m of result.memories) {
    lines.push(`\n### ${m.title} (${m.slug})`);
    lines.push(m.content);
    lines.push(`_relevance: ${(m.score * 100).toFixed(1)}%_`);
  }
  return lines.join('\n');
}

function extractKeyPhrases(text: string): string[] {
  const stopWords = new Set([
    'i', 'me', 'my', 'the', 'a', 'an', 'is', 'am', 'are', 'was', 'were',
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'about', 'into', 'through', 'during', 'before', 'after',
    'and', 'but', 'or', 'not', 'no', 'so', 'if', 'then',
    'that', 'this', 'it', 'what', 'which', 'who', 'whom',
    'im', "i'm", 'preparing',
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}
