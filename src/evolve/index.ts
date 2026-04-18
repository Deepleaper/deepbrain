/**
 * DeepBrain — Evolve Engine
 *
 * Algorithmic knowledge consolidation — NO LLM required.
 * Uses keyword extraction, Jaccard similarity clustering, and sentence dedup.
 */

// ── Types ────────────────────────────────────────────────────────

export interface EvolveOptions {
  minTraces?: number;
  maxAge?: number;
  dryRun?: boolean;
  strategy?: 'merge' | 'summarize' | 'extract';
  topicThreshold?: number;
  batchSize?: number;
}

export interface EvolveResult {
  tracesProcessed: number;
  pagesCreated: number;
  pagesUpdated: number;
  clusters: Array<{
    topic: string;
    traceCount: number;
    outputPage: string;
  }>;
  dryRun: boolean;
}

export interface TraceItem {
  slug: string;
  title: string;
  content: string;
  keywords: string[];
  frontmatter: Record<string, unknown>;
  type: string;
}

// ── Stopwords (EN + CN) ─────────────────────────────────────────

const STOPWORDS = new Set([
  // English
  'the', 'a', 'an', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'just', 'because', 'but', 'and', 'or', 'if', 'while', 'that', 'this',
  'these', 'those', 'what', 'which', 'who', 'whom', 'its', 'it', 'he',
  'she', 'they', 'them', 'his', 'her', 'their', 'my', 'your', 'our',
  'about', 'also', 'get', 'got', 'like', 'make', 'made', 'much', 'well',
  // Chinese
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
  '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着',
  '没有', '看', '好', '自己', '这', '他', '她', '它', '们', '那', '个',
  '但', '还', '把', '被', '从', '对', '让', '用', '所', '能', '吗', '吧',
  '啊', '呢', '什么', '这个', '那个', '可以', '因为', '所以', '如果',
]);

// ── Keyword Extraction ──────────────────────────────────────────

export function extractKeywords(text: string): string[] {
  if (!text || !text.trim()) return [];

  const words = text.toLowerCase().split(/[\s\W]+/).filter(w =>
    w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w)
  );

  const freq = new Map<string, number>();
  words.forEach(w => freq.set(w, (freq.get(w) || 0) + 1));

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w);
}

// ── Similarity ──────────────────────────────────────────────────

export function similarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

// ── Sentence Dedup ──────────────────────────────────────────────

function wordSet(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[\s\W]+/).filter(w => w.length > 0));
}

function wordOverlap(a: string, b: string): number {
  const sa = wordSet(a);
  const sb = wordSet(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  const intersection = [...sa].filter(x => sb.has(x)).length;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : intersection / union;
}

export function dedupSentences(sentences: string[], threshold = 0.8): string[] {
  const result: string[] = [];
  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    const isDup = result.some(existing => wordOverlap(existing, trimmed) >= threshold);
    if (!isDup) result.push(trimmed);
  }
  return result;
}

// ── Clustering ──────────────────────────────────────────────────

export function clusterTraces(
  traces: Array<{ slug: string; keywords: string[] }>,
  threshold = 0.2
): Map<string, string[]> {
  const clusters = new Map<string, string[]>(); // centroid key -> slugs
  const centroidKeywords = new Map<string, string[]>();

  for (const trace of traces) {
    let bestCluster: string | null = null;
    let bestScore = 0;

    for (const [key, kws] of centroidKeywords) {
      const score = similarity(trace.keywords, kws);
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestCluster = key;
      }
    }

    if (bestCluster) {
      clusters.get(bestCluster)!.push(trace.slug);
    } else {
      // New cluster
      const key = trace.slug;
      clusters.set(key, [trace.slug]);
      centroidKeywords.set(key, [...trace.keywords]);
    }
  }

  return clusters;
}

// ── Consolidation Strategies ────────────────────────────────────

function splitSentences(text: string): string[] {
  return text.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length > 0);
}

function topicFromKeywords(keywords: string[]): string {
  if (keywords.length === 0) return 'General';
  return keywords.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' / ');
}

export function consolidateMerge(traces: TraceItem[]): string {
  const allSentences: string[] = [];
  for (const t of traces) {
    allSentences.push(...splitSentences(t.content));
  }
  const unique = dedupSentences(allSentences);
  const topic = topicFromKeywords(traces[0]?.keywords || []);

  const lines = [`## ${topic}`, '', `> Consolidated from ${traces.length} traces.`, ''];
  for (const s of unique) {
    lines.push(`- ${s}`);
  }
  return lines.join('\n');
}

export function consolidateSummarize(traces: TraceItem[]): string {
  const topic = topicFromKeywords(traces[0]?.keywords || []);
  // Count keyword frequencies across all traces for pattern detection
  const kwFreq = new Map<string, number>();
  for (const t of traces) {
    for (const kw of t.keywords) {
      kwFreq.set(kw, (kwFreq.get(kw) || 0) + 1);
    }
  }
  const topKw = [...kwFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const lines = [`## ${topic} — Patterns`, '', `> Summary of ${traces.length} traces.`, ''];
  lines.push(`### Key Themes`);
  for (const [kw, count] of topKw) {
    const pct = Math.round((count / traces.length) * 100);
    lines.push(`- **${kw}**: mentioned in ${pct}% of traces (${count}/${traces.length})`);
  }

  lines.push('', `### Representative Facts`);
  // Pick longest sentence from each trace as representative
  for (const t of traces.slice(0, 10)) {
    const sentences = splitSentences(t.content);
    const longest = sentences.sort((a, b) => b.length - a.length)[0];
    if (longest) lines.push(`- ${longest}`);
  }

  return lines.join('\n');
}

export function consolidateExtract(traces: TraceItem[]): string {
  const topic = topicFromKeywords(traces[0]?.keywords || []);
  // Extract key-value-like patterns
  const facts = new Map<string, string>();

  for (const t of traces) {
    const sentences = splitSentences(t.content);
    for (const s of sentences) {
      // Pattern: "X is Y", "X: Y", "X = Y", "X — Y"
      const kvMatch = s.match(/^(.+?)(?:\s+is\s+|\s*[:=—]\s*)(.+)$/i);
      if (kvMatch) {
        const key = kvMatch[1].trim().toLowerCase();
        const val = kvMatch[2].trim();
        if (key.length < 50 && val.length < 200) {
          facts.set(key, val); // later values override earlier
        }
      }
    }
  }

  const lines = [`## ${topic} — Extracted Facts`, '', `> Extracted from ${traces.length} traces.`, ''];
  if (facts.size > 0) {
    for (const [k, v] of facts) {
      lines.push(`- **${k}**: ${v}`);
    }
  } else {
    // Fallback: just list unique sentences
    const allSentences = traces.flatMap(t => splitSentences(t.content));
    const unique = dedupSentences(allSentences);
    for (const s of unique) {
      lines.push(`- ${s}`);
    }
  }

  return lines.join('\n');
}

// ── AutoEvolveScheduler ─────────────────────────────────────────

export class AutoEvolveScheduler {
  private interval: ReturnType<typeof setInterval> | null = null;

  start(brain: { evolve: (opts?: EvolveOptions) => Promise<EvolveResult> }, intervalMs: number = 3600000): void {
    this.interval = setInterval(async () => {
      try {
        const result = await brain.evolve({ minTraces: 5 });
        if (result.tracesProcessed > 0) {
          console.log(`[evolve] Processed ${result.tracesProcessed} traces → ${result.pagesCreated} pages`);
        }
      } catch (e) {
        console.error(`[evolve] Error:`, e);
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  isRunning(): boolean {
    return this.interval !== null;
  }
}
