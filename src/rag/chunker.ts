/**
 * DeepBrain — Advanced Chunker
 *
 * Multiple chunking strategies for RAG.
 */

import { createHash } from 'node:crypto';

export interface Chunk {
  id: string;
  content: string;
  index: number;
  metadata: {
    strategy: string;
    startOffset: number;
    endOffset: number;
    tokenEstimate: number;
    headings?: string[];
  };
}

export interface ChunkOptions {
  strategy: 'fixed' | 'sentence' | 'paragraph' | 'semantic' | 'recursive';
  chunkSize: number;
  chunkOverlap: number;
  minChunkSize?: number;
  maxChunkSize?: number;
}

const DEFAULT_OPTIONS: ChunkOptions = {
  strategy: 'recursive',
  chunkSize: 500,
  chunkOverlap: 50,
  minChunkSize: 50,
  maxChunkSize: 2000,
};

export class Chunker {
  private options: ChunkOptions;

  constructor(options?: Partial<ChunkOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  chunkFixed(text: string): Chunk[] {
    const charSize = this.tokensToChars(this.options.chunkSize);
    const charOverlap = this.tokensToChars(this.options.chunkOverlap);
    const chunks: Chunk[] = [];
    let offset = 0;
    let index = 0;

    while (offset < text.length) {
      const end = Math.min(offset + charSize, text.length);
      const content = text.slice(offset, end);
      if (content.trim()) {
        chunks.push(this.makeChunk(content, index, offset, end, 'fixed'));
        index++;
      }
      offset += charSize - charOverlap;
      if (offset >= text.length) break;
    }

    return this.applyMinMax(chunks);
  }

  chunkSentence(text: string): Chunk[] {
    // Split on sentence boundaries
    const sentences = text.match(/[^.!?。！？]+[.!?。！？]+[\s]*/g) ?? [text];
    return this.mergeSegments(sentences, text, 'sentence');
  }

  chunkParagraph(text: string): Chunk[] {
    const paragraphs = text.split(/\n{2,}/).filter(p => p.trim());
    return this.mergeSegments(paragraphs, text, 'paragraph');
  }

  chunkSemantic(text: string): Chunk[] {
    // Split on headings (markdown-style)
    const sections: { heading: string; content: string }[] = [];
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let lastIndex = 0;
    let currentHeadings: string[] = [];
    let match: RegExpExecArray | null;

    const headingPositions: { level: number; title: string; index: number }[] = [];
    while ((match = headingRegex.exec(text)) !== null) {
      headingPositions.push({ level: match[1].length, title: match[2], index: match.index });
    }

    if (headingPositions.length === 0) {
      // No headings — fall back to paragraph chunking
      return this.chunkParagraph(text);
    }

    for (let i = 0; i < headingPositions.length; i++) {
      const h = headingPositions[i];
      const nextStart = headingPositions[i + 1]?.index ?? text.length;

      // Text before first heading
      if (i === 0 && h.index > 0) {
        const preContent = text.slice(0, h.index).trim();
        if (preContent) {
          sections.push({ heading: '', content: preContent });
        }
      }

      const sectionContent = text.slice(h.index, nextStart).trim();
      sections.push({ heading: h.title, content: sectionContent });
    }

    // Merge sections that are too small, split ones that are too big
    const chunks: Chunk[] = [];
    let index = 0;
    let searchOffset = 0;

    for (const section of sections) {
      const tokens = this.estimateTokens(section.content);
      if (tokens > this.options.chunkSize * 2) {
        // Section too large — recursive split within it
        const subChunks = this.chunkRecursive(section.content);
        for (const sc of subChunks) {
          const startOffset = text.indexOf(sc.content.slice(0, 50), searchOffset);
          const so = startOffset >= 0 ? startOffset : searchOffset;
          chunks.push(this.makeChunk(sc.content, index, so, so + sc.content.length, 'semantic', section.heading ? [section.heading] : undefined));
          index++;
          searchOffset = so + sc.content.length;
        }
      } else {
        const startOffset = text.indexOf(section.content.slice(0, 50), searchOffset);
        const so = startOffset >= 0 ? startOffset : searchOffset;
        chunks.push(this.makeChunk(section.content, index, so, so + section.content.length, 'semantic', section.heading ? [section.heading] : undefined));
        index++;
        searchOffset = so + section.content.length;
      }
    }

    return this.applyMinMax(chunks);
  }

  chunkRecursive(text: string, separators?: string[]): Chunk[] {
    const seps = separators ?? ['\n\n', '\n', '. ', ' ', ''];
    const charSize = this.tokensToChars(this.options.chunkSize);
    const charOverlap = this.tokensToChars(this.options.chunkOverlap);

    const splitRecursive = (t: string, sepIdx: number): string[] => {
      if (t.length <= charSize) return [t];
      if (sepIdx >= seps.length) {
        // Final fallback: hard split
        const parts: string[] = [];
        for (let i = 0; i < t.length; i += charSize - charOverlap) {
          parts.push(t.slice(i, i + charSize));
        }
        return parts;
      }

      const sep = seps[sepIdx];
      const splits = sep ? t.split(sep) : [t];

      if (splits.length <= 1) {
        return splitRecursive(t, sepIdx + 1);
      }

      const merged: string[] = [];
      let buffer = '';

      for (const s of splits) {
        const candidate = buffer ? buffer + sep + s : s;
        if (candidate.length > charSize && buffer) {
          merged.push(buffer);
          buffer = s;
        } else {
          buffer = candidate;
        }
      }
      if (buffer) merged.push(buffer);

      // Recursively split any chunks still too large
      const result: string[] = [];
      for (const m of merged) {
        if (m.length > charSize) {
          result.push(...splitRecursive(m, sepIdx + 1));
        } else {
          result.push(m);
        }
      }
      return result;
    };

    const parts = splitRecursive(text, 0);

    // Add overlap
    const chunks: Chunk[] = [];
    let searchOffset = 0;
    for (let i = 0; i < parts.length; i++) {
      let content = parts[i];
      // Prepend overlap from previous chunk
      if (i > 0 && charOverlap > 0) {
        const prev = parts[i - 1];
        const overlap = prev.slice(-charOverlap);
        content = overlap + content;
      }

      const startOffset = text.indexOf(content.slice(0, 50), Math.max(0, searchOffset - charOverlap));
      const so = startOffset >= 0 ? startOffset : searchOffset;
      chunks.push(this.makeChunk(content.trim(), i, so, so + content.length, 'recursive'));
      searchOffset = so + parts[i].length;
    }

    return this.applyMinMax(chunks);
  }

  chunk(text: string): Chunk[] {
    switch (this.options.strategy) {
      case 'fixed': return this.chunkFixed(text);
      case 'sentence': return this.chunkSentence(text);
      case 'paragraph': return this.chunkParagraph(text);
      case 'semantic': return this.chunkSemantic(text);
      case 'recursive': return this.chunkRecursive(text);
      default: return this.chunkRecursive(text);
    }
  }

  estimateTokens(text: string): number {
    // Simple estimation: split on whitespace, multiply by 1.3 for subword tokens
    const words = text.split(/\s+/).filter(w => w.length > 0).length;
    // CJK characters count roughly as 1 token each
    const cjk = (text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
    return Math.ceil((words - cjk) * 1.3 + cjk);
  }

  // ── Internal ───────────────────────────────────────────────

  private tokensToChars(tokens: number): number {
    // Rough: 1 token ≈ 4 chars for English
    return Math.ceil(tokens * 4);
  }

  private makeChunk(content: string, index: number, startOffset: number, endOffset: number, strategy: string, headings?: string[]): Chunk {
    const hash = createHash('md5').update(content).digest('hex').slice(0, 8);
    return {
      id: `chunk-${index}-${hash}`,
      content,
      index,
      metadata: {
        strategy,
        startOffset,
        endOffset,
        tokenEstimate: this.estimateTokens(content),
        ...(headings ? { headings } : {}),
      },
    };
  }

  private mergeSegments(segments: string[], originalText: string, strategy: string): Chunk[] {
    const charSize = this.tokensToChars(this.options.chunkSize);
    const charOverlap = this.tokensToChars(this.options.chunkOverlap);
    const chunks: Chunk[] = [];
    let buffer = '';
    let bufferStart = 0;
    let index = 0;
    let searchOffset = 0;

    for (const seg of segments) {
      if (buffer && (buffer.length + seg.length) > charSize) {
        const so = originalText.indexOf(buffer.slice(0, 50), Math.max(0, searchOffset - 10));
        const start = so >= 0 ? so : searchOffset;
        chunks.push(this.makeChunk(buffer.trim(), index, start, start + buffer.length, strategy));
        index++;
        searchOffset = start + buffer.length;
        // Keep overlap
        if (charOverlap > 0) {
          buffer = buffer.slice(-charOverlap) + seg;
        } else {
          buffer = seg;
        }
      } else {
        buffer += (buffer ? '\n\n' : '') + seg;
      }
    }

    if (buffer.trim()) {
      const so = originalText.indexOf(buffer.slice(0, 50), Math.max(0, searchOffset - 10));
      const start = so >= 0 ? so : searchOffset;
      chunks.push(this.makeChunk(buffer.trim(), index, start, start + buffer.length, strategy));
    }

    return this.applyMinMax(chunks);
  }

  private applyMinMax(chunks: Chunk[]): Chunk[] {
    const minChars = this.tokensToChars(this.options.minChunkSize ?? 0);
    const maxChars = this.tokensToChars(this.options.maxChunkSize ?? Infinity);

    // Filter out chunks below minimum
    let result = chunks.filter(c => c.content.length >= minChars || chunks.length === 1);

    // If any are above max, we just leave them (already handled by splitting)
    // Re-index
    return result.map((c, i) => ({ ...c, index: i }));
  }
}
