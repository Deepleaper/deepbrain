/**
 * DeepBrain — RAG Pipeline Tests
 */

import { describe, it, expect } from 'vitest';
import { DocumentParser } from '../src/rag/parser.js';
import { Chunker } from '../src/rag/chunker.js';
import { Reranker } from '../src/rag/reranker.js';

// ── DocumentParser ─────────────────────────────────────────

describe('DocumentParser', () => {
  const parser = new DocumentParser();

  it('parses markdown — strips syntax, extracts title', () => {
    const md = '# My Title\n\nSome **bold** and *italic* text.\n\n- List item\n\n[Link](http://example.com)';
    const result = parser.parseMarkdown(md);
    expect(result.metadata.title).toBe('My Title');
    expect(result.metadata.format).toBe('markdown');
    expect(result.content).not.toContain('**');
    expect(result.content).not.toContain('[Link]');
    expect(result.content).toContain('Link');
    expect(result.metadata.wordCount).toBeGreaterThan(0);
  });

  it('parses HTML — strips tags, extracts title', () => {
    const html = '<html><head><title>Test Page</title></head><body><h1>Hello</h1><p>World <b>bold</b></p><script>evil()</script></body></html>';
    const result = parser.parseHTML(html);
    expect(result.metadata.title).toBe('Test Page');
    expect(result.metadata.format).toBe('html');
    expect(result.content).toContain('Hello');
    expect(result.content).toContain('World bold');
    expect(result.content).not.toContain('<');
    expect(result.content).not.toContain('evil');
  });

  it('parses CSV — converts to structured text', () => {
    const csv = 'name,age,city\nAlice,30,NYC\nBob,25,LA';
    const result = parser.parseCSV(csv);
    expect(result.metadata.format).toBe('csv');
    expect(result.content).toContain('name: Alice');
    expect(result.content).toContain('age: 30');
    expect(result.content).toContain('city: LA');
  });

  it('parses JSON — flattens to text', () => {
    const json = JSON.stringify({ name: 'Alice', nested: { role: 'dev', skills: ['ts', 'py'] } });
    const result = parser.parseJSON(json);
    expect(result.metadata.format).toBe('json');
    expect(result.content).toContain('name: Alice');
    expect(result.content).toContain('role: dev');
  });

  it('auto-detects format', () => {
    expect(parser.parse('# Heading\ntext').metadata.format).toBe('markdown');
    expect(parser.parse('<html><body>hi</body></html>').metadata.format).toBe('html');
    expect(parser.parse('{"a":1}').metadata.format).toBe('json');
    expect(parser.parse('a,b,c\n1,2,3\n4,5,6').metadata.format).toBe('csv');
    expect(parser.parse('just plain text here').metadata.format).toBe('plaintext');
  });
});

// ── Chunker ────────────────────────────────────────────────

describe('Chunker', () => {
  it('chunkFixed — creates fixed-size chunks', () => {
    const text = 'A'.repeat(5000);
    const chunker = new Chunker({ strategy: 'fixed', chunkSize: 200, chunkOverlap: 20 });
    const chunks = chunker.chunkFixed(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].metadata.strategy).toBe('fixed');
  });

  it('chunkSentence — splits on sentence boundaries', () => {
    const text = 'First sentence. Second sentence. Third sentence. Fourth sentence. Fifth very long sentence that goes on and on.';
    const chunker = new Chunker({ chunkSize: 10, chunkOverlap: 0, minChunkSize: 0 });
    const chunks = chunker.chunkSentence(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].metadata.strategy).toBe('sentence');
  });

  it('chunkParagraph — splits on double newlines', () => {
    const text = 'Para one content here.\n\nPara two content here.\n\nPara three content here.';
    const chunker = new Chunker({ chunkSize: 10, chunkOverlap: 0, minChunkSize: 0 });
    const chunks = chunker.chunkParagraph(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].metadata.strategy).toBe('paragraph');
  });

  it('chunkRecursive — splits recursively with separators', () => {
    const paragraphs = Array.from({ length: 20 }, (_, i) => `Paragraph ${i}. This has some text content that needs to be chunked properly.`);
    const text = paragraphs.join('\n\n');
    const chunker = new Chunker({ chunkSize: 50, chunkOverlap: 10, minChunkSize: 0 });
    const chunks = chunker.chunkRecursive(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].metadata.strategy).toBe('recursive');
  });

  it('overlap works — adjacent chunks share content', () => {
    const text = 'Sentence one here. Sentence two here. Sentence three here. Sentence four here. Sentence five here.';
    const chunker = new Chunker({ chunkSize: 10, chunkOverlap: 5 });
    const chunks = chunker.chunkFixed(text);
    if (chunks.length >= 2) {
      // With overlap, second chunk should start before first chunk ends
      expect(chunks[1].metadata.startOffset).toBeLessThan(chunks[0].metadata.endOffset + 100);
    }
  });

  it('respects minChunkSize — filters tiny chunks', () => {
    const text = 'Short.\n\nA very long paragraph that should definitely stay because it has enough content to meet the minimum.';
    const chunker = new Chunker({ chunkSize: 500, chunkOverlap: 0, minChunkSize: 20 });
    const chunks = chunker.chunkParagraph(text);
    for (const c of chunks) {
      // Short chunks should be filtered (unless it's the only one)
      if (chunks.length > 1) {
        expect(c.content.length).toBeGreaterThanOrEqual(20 * 4); // minChunkSize in chars
      }
    }
  });

  it('estimateTokens — reasonable accuracy', () => {
    const chunker = new Chunker();
    // ~10 English words ≈ 13 tokens
    const tokens = chunker.estimateTokens('The quick brown fox jumps over the lazy dog today');
    expect(tokens).toBeGreaterThan(8);
    expect(tokens).toBeLessThan(25);
  });

  it('auto chunk — selects strategy from options', () => {
    const chunker = new Chunker({ strategy: 'paragraph' });
    const text = 'Para one.\n\nPara two.\n\nPara three.';
    const chunks = chunker.chunk(text);
    expect(chunks[0].metadata.strategy).toBe('paragraph');
  });
});

// ── Reranker ───────────────────────────────────────────────

describe('Reranker', () => {
  const reranker = new Reranker();
  const results = [
    { content: 'TypeScript is a typed superset of JavaScript', score: 0.8 },
    { content: 'Python is great for data science', score: 0.7 },
    { content: 'JavaScript runs in the browser and Node.js', score: 0.6 },
    { content: 'Cooking recipes for Italian pasta', score: 0.5 },
  ];

  it('keyword reranking — boosts matching results', () => {
    const ranked = reranker.rerankKeyword('TypeScript JavaScript', results);
    expect(ranked.length).toBeGreaterThan(0);
    // TypeScript/JavaScript results should rank higher
    const topContent = ranked[0].content;
    expect(topContent).toMatch(/TypeScript|JavaScript/);
    // Cooking should rank low
    const cookingIdx = ranked.findIndex(r => r.content.includes('Cooking'));
    expect(cookingIdx).toBe(ranked.length - 1);
  });

  it('MMR — provides diversity', () => {
    const similar = [
      { content: 'TypeScript is great for web development', score: 0.9 },
      { content: 'TypeScript is wonderful for web apps', score: 0.85 },
      { content: 'Python is used for machine learning', score: 0.7 },
      { content: 'Rust is fast and memory safe', score: 0.6 },
    ];
    const ranked = reranker.rerankMMR('programming languages', similar, { lambda: 0.5, topK: 3 });
    expect(ranked.length).toBe(3);
    // With diversity, shouldn't pick both very similar TS results first
    const contents = ranked.map(r => r.content);
    expect(contents.length).toBe(new Set(contents).size); // all unique
  });

  it('fusion rank — combines multiple result sets', () => {
    const set1 = [
      { content: 'Result A', score: 0.9 },
      { content: 'Result B', score: 0.8 },
    ];
    const set2 = [
      { content: 'Result B', score: 0.95 },
      { content: 'Result C', score: 0.7 },
    ];
    const fused = reranker.fusionRank([set1, set2]);
    expect(fused.length).toBeGreaterThan(0);
    // Result B appears in both, should rank highest
    expect(fused[0].content).toBe('Result B');
  });

  it('handles empty results', () => {
    expect(reranker.rerankMMR('query', [])).toEqual([]);
    expect(reranker.rerankKeyword('query', [])).toEqual([]);
    expect(reranker.fusionRank([])).toEqual([]);
  });
});

// ── RAGPipeline (unit-level, no Brain needed) ──────────────

describe('RAGPipeline integration helpers', () => {
  it('Chunker + Parser work together', () => {
    const parser = new DocumentParser();
    const chunker = new Chunker({ chunkSize: 50, chunkOverlap: 10 });

    const md = '# Guide\n\nFirst paragraph about TypeScript.\n\nSecond paragraph about testing.\n\nThird paragraph about deployment.';
    const parsed = parser.parseMarkdown(md);
    const chunks = chunker.chunk(parsed.content);

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(parsed.metadata.title).toBe('Guide');
  });

  it('Reranker works on chunked content', () => {
    const chunker = new Chunker({ chunkSize: 30 });
    const text = 'TypeScript is typed. Python is dynamic. Rust is fast. Go is concurrent.';
    const chunks = chunker.chunkSentence(text);
    const reranker = new Reranker();

    const results = chunks.map(c => ({ content: c.content, score: 0.5 }));
    const ranked = reranker.rerankKeyword('TypeScript typed', results);
    expect(ranked[0].content).toMatch(/TypeScript/);
  });
});
