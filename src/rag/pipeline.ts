/**
 * DeepBrain — RAG Pipeline
 *
 * Orchestrates: parse → chunk → embed → store → retrieve → rerank
 */

import { DocumentParser, type ParsedDocument } from './parser.js';
import { Chunker, type ChunkOptions } from './chunker.js';
import { Reranker, type RankedResult } from './reranker.js';
import type { Brain } from '../core/brain.js';

export interface RAGOptions {
  chunkStrategy?: ChunkOptions['strategy'];
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
  rerank?: boolean;
  rerankStrategy?: 'keyword' | 'semantic' | 'mmr' | 'fusion';
}

const DEFAULT_RAG_OPTIONS: RAGOptions = {
  chunkStrategy: 'recursive',
  chunkSize: 500,
  chunkOverlap: 50,
  topK: 5,
  rerank: true,
  rerankStrategy: 'keyword',
};

export class RAGPipeline {
  private brain: Brain;
  private options: RAGOptions;
  private parser: DocumentParser;
  private chunker: Chunker;
  private reranker: Reranker;

  constructor(brain: Brain, options?: RAGOptions) {
    this.brain = brain;
    this.options = { ...DEFAULT_RAG_OPTIONS, ...options };
    this.parser = new DocumentParser();
    this.chunker = new Chunker({
      strategy: this.options.chunkStrategy,
      chunkSize: this.options.chunkSize,
      chunkOverlap: this.options.chunkOverlap,
    });
    this.reranker = new Reranker();
  }

  /**
   * Ingest: parse → chunk → store via Brain.put()
   * Each chunk becomes a separate page with slug: {baseSlug}/chunk-{index}
   */
  async ingest(content: string, slug: string, options?: { format?: string; tags?: string[] }): Promise<{ chunks: number; tokens: number }> {
    const parsed = this.parser.parse(content, options?.format);
    const chunks = this.chunker.chunk(parsed.content);

    let totalTokens = 0;

    // Store the full document as main page
    await this.brain.put(slug, {
      type: 'document',
      title: parsed.metadata.title ?? slug,
      compiled_truth: parsed.content,
    });

    // Tag if requested
    if (options?.tags) {
      for (const tag of options.tags) {
        await this.brain.tag(slug, tag);
      }
    }

    // Store individual chunks as linked pages for fine-grained retrieval
    for (const chunk of chunks) {
      const chunkSlug = `${slug}/chunk-${chunk.index}`;
      await this.brain.put(chunkSlug, {
        type: 'chunk',
        title: `${parsed.metadata.title ?? slug} [chunk ${chunk.index}]`,
        compiled_truth: chunk.content,
      });
      await this.brain.link(chunkSlug, slug, `chunk ${chunk.index} of ${slug}`, 'chunk-of');
      totalTokens += chunk.metadata.tokenEstimate;

      if (options?.tags) {
        for (const tag of options.tags) {
          await this.brain.tag(chunkSlug, tag);
        }
      }
    }

    return { chunks: chunks.length, tokens: totalTokens };
  }

  /**
   * Ingest from file path.
   */
  async ingestFile(filePath: string, slug?: string, options?: { tags?: string[] }): Promise<{ chunks: number; tokens: number }> {
    const parsed = this.parser.parseFile(filePath);
    const effectiveSlug = slug ?? this.slugify(parsed.metadata.title ?? filePath);
    return this.ingest(parsed.content, effectiveSlug, {
      format: parsed.metadata.format,
      tags: options?.tags,
    });
  }

  /**
   * Retrieve: query → Brain.query() → rerank → return
   */
  async retrieve(query: string, options?: { topK?: number; rerank?: boolean }): Promise<RankedResult[]> {
    const topK = options?.topK ?? this.options.topK ?? 5;
    const shouldRerank = options?.rerank ?? this.options.rerank ?? true;

    // Search via Brain's hybrid search
    const results = await this.brain.query(query, { limit: topK * 3 });

    if (!shouldRerank || results.length === 0) {
      return results.map(r => ({
        content: r.chunk_text,
        score: r.score,
        rerankedScore: r.score,
        metadata: { slug: r.slug, title: r.title, type: r.type },
      }));
    }

    // Rerank
    const toRerank = results.map(r => ({
      content: r.chunk_text,
      score: r.score,
      metadata: { slug: r.slug, title: r.title, type: r.type },
    }));

    switch (this.options.rerankStrategy) {
      case 'mmr':
        return this.reranker.rerankMMR(query, toRerank, { topK });
      case 'semantic':
        return this.reranker.rerankSemantic(query, toRerank, { topK });
      case 'fusion':
        return this.reranker.fusionRank([toRerank], { k: 60 }).slice(0, topK);
      case 'keyword':
      default:
        return this.reranker.rerankKeyword(query, toRerank, { topK });
    }
  }

  /**
   * Full RAG: retrieve + format as context string.
   */
  async getContext(query: string, options?: { maxTokens?: number }): Promise<string> {
    const maxTokens = options?.maxTokens ?? 4000;
    const results = await this.retrieve(query);

    let context = '';
    let tokens = 0;

    for (const r of results) {
      const chunkTokens = this.chunker.estimateTokens(r.content);
      if (tokens + chunkTokens > maxTokens) break;
      context += `---\n${r.content}\n\n`;
      tokens += chunkTokens;
    }

    return context.trim();
  }

  // ── Internal ───────────────────────────────────────────────

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80);
  }
}
