/**
 * DeepBrain - Memory Compression
 *
 * Compress old memories by summarizing similar items.
 * Reduces token usage when injecting memories into context.
 * Keeps originals as archival, uses compressed versions for context.
 */

import type { Brain } from './core/brain.js';
import type { Page } from './core/types.js';

export interface CompressionConfig {
  /** Target compression ratio (0.3 = compress to 30% of original) */
  ratio: number;
  /** Minimum age in days before compressing */
  minAgeDays: number;
  /** Minimum content length to consider for compression */
  minLength: number;
  /** Whether to keep original as archival */
  keepOriginal: boolean;
}

export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  ratio: 0.3,
  minAgeDays: 7,
  minLength: 200,
  keepOriginal: true,
};

export interface CompressionResult {
  slug: string;
  originalLength: number;
  compressedLength: number;
  ratio: number;
}

/**
 * Compress a single page's content using extractive summarization.
 * (No LLM needed — uses sentence scoring.)
 */
export function compressText(text: string, targetRatio: number): string {
  const sentences = text
    .split(/[.!?\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);

  if (sentences.length <= 2) return text;

  const targetCount = Math.max(1, Math.ceil(sentences.length * targetRatio));

  // Score sentences by: position (first/last are important), length, keyword density
  const scored = sentences.map((s, i) => {
    let score = 0;
    // Position bonus
    if (i === 0) score += 3;
    if (i === sentences.length - 1) score += 2;
    // Length bonus (prefer medium-length sentences)
    if (s.length > 30 && s.length < 200) score += 1;
    // Keyword indicators
    if (/important|key|critical|must|always|never|note|remember/i.test(s)) score += 2;
    // Numbers and data
    if (/\d/.test(s)) score += 1;
    // Headings or emphasis
    if (/^#+\s|^\*\*/.test(s)) score += 2;
    return { sentence: s, score, index: i };
  });

  // Take top-scored sentences, maintaining original order
  const selected = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, targetCount)
    .sort((a, b) => a.index - b.index);

  return selected.map(s => s.sentence).join('. ') + '.';
}

/**
 * Compress a page and store the compressed version.
 */
export async function compressPage(
  brain: Brain,
  slug: string,
  config: Partial<CompressionConfig> = {},
): Promise<CompressionResult | null> {
  const cfg = { ...DEFAULT_COMPRESSION_CONFIG, ...config };
  const page = await brain.get(slug);
  if (!page) return null;

  const content = page.compiled_truth;
  if (content.length < cfg.minLength) return null;

  // Check if already compressed
  if ((page.frontmatter as any).compressed) return null;

  const compressed = compressText(content, cfg.ratio);

  if (cfg.keepOriginal) {
    // Store original as archival version
    const archivalSlug = `${slug}--full`;
    await brain.put(archivalSlug, {
      type: page.type,
      title: `${page.title} (Full)`,
      compiled_truth: content,
      frontmatter: { ...page.frontmatter, is_archival_copy: true, original_slug: slug },
    });
    await brain.link(slug, archivalSlug, 'full version', 'archival');
  }

  // Update page with compressed content
  await brain.put(slug, {
    ...page,
    compiled_truth: compressed,
    frontmatter: {
      ...page.frontmatter,
      compressed: true,
      compressed_at: new Date().toISOString(),
      original_length: content.length,
      compressed_length: compressed.length,
    },
  });

  return {
    slug,
    originalLength: content.length,
    compressedLength: compressed.length,
    ratio: compressed.length / content.length,
  };
}

/**
 * Run compression on all eligible pages.
 */
export async function runCompression(
  brain: Brain,
  config: Partial<CompressionConfig> = {},
): Promise<CompressionResult[]> {
  const cfg = { ...DEFAULT_COMPRESSION_CONFIG, ...config };
  const allPages = await brain.list({ limit: 10000 });
  const now = Date.now();
  const results: CompressionResult[] = [];

  for (const page of allPages) {
    // Skip recently updated
    const updatedAt = page.updated_at instanceof Date ? page.updated_at.getTime() : new Date(page.updated_at).getTime();
    const ageDays = (now - updatedAt) / 86400000;
    if (ageDays < cfg.minAgeDays) continue;

    // Skip locked or already compressed
    const fm = page.frontmatter as any;
    if (fm.locked || fm.compressed || fm.is_archival_copy) continue;

    const result = await compressPage(brain, page.slug, cfg);
    if (result) results.push(result);
  }

  return results;
}

/**
 * Get the full (uncompressed) version of a page if available.
 */
export async function getFullVersion(brain: Brain, slug: string): Promise<Page | null> {
  return brain.get(`${slug}--full`);
}
