/**
 * DeepBrain — Reranker
 *
 * Rerank search results for better relevance.
 * Zero external deps.
 */

export interface RankedResult {
  content: string;
  score: number;
  rerankedScore: number;
  metadata?: any;
}

export class Reranker {
  /**
   * Keyword frequency reranking — score by query term overlap.
   */
  rerankKeyword(query: string, results: any[], options?: { topK?: number }): RankedResult[] {
    const topK = options?.topK ?? 10;
    const queryTerms = this.tokenize(query);

    const ranked: RankedResult[] = results.map(r => {
      const content = this.extractContent(r);
      const originalScore = typeof r.score === 'number' ? r.score : 0;
      const docTerms = this.tokenize(content);

      // TF-based score: count query terms in document
      let termScore = 0;
      for (const qt of queryTerms) {
        const count = docTerms.filter(dt => dt === qt || dt.includes(qt) || qt.includes(dt)).length;
        termScore += count / Math.max(docTerms.length, 1);
      }

      // Normalize
      const rerankedScore = originalScore * 0.4 + (termScore / queryTerms.length) * 0.6;

      return {
        content,
        score: originalScore,
        rerankedScore,
        metadata: r.metadata ?? r,
      };
    });

    return ranked
      .sort((a, b) => b.rerankedScore - a.rerankedScore)
      .slice(0, topK);
  }

  /**
   * Semantic reranking — uses LLM if available, falls back to keyword.
   */
  async rerankSemantic(query: string, results: any[], options?: { topK?: number; llmProvider?: any }): Promise<RankedResult[]> {
    const topK = options?.topK ?? 10;
    const llm = options?.llmProvider;

    if (!llm) {
      return this.rerankKeyword(query, results, { topK });
    }

    // Use LLM to score relevance
    const ranked: RankedResult[] = [];
    for (const r of results) {
      const content = this.extractContent(r);
      const originalScore = typeof r.score === 'number' ? r.score : 0;

      try {
        const prompt = `Rate the relevance of this text to the query on a scale of 0-10. Reply with ONLY a number.\n\nQuery: ${query}\n\nText: ${content.slice(0, 500)}\n\nScore:`;
        const response = await llm.chat([{ role: 'user', content: prompt }]);
        const llmScore = parseFloat(response?.content ?? '5') / 10;
        ranked.push({
          content,
          score: originalScore,
          rerankedScore: Math.min(1, Math.max(0, isNaN(llmScore) ? originalScore : llmScore)),
          metadata: r.metadata ?? r,
        });
      } catch {
        ranked.push({
          content,
          score: originalScore,
          rerankedScore: originalScore,
          metadata: r.metadata ?? r,
        });
      }
    }

    return ranked
      .sort((a, b) => b.rerankedScore - a.rerankedScore)
      .slice(0, topK);
  }

  /**
   * Reciprocal Rank Fusion — combine multiple result sets.
   */
  fusionRank(resultSets: any[][], options?: { k?: number }): RankedResult[] {
    const k = options?.k ?? 60;
    const scores = new Map<string, { content: string; score: number; metadata: any }>();

    for (const results of resultSets) {
      for (let rank = 0; rank < results.length; rank++) {
        const r = results[rank];
        const content = this.extractContent(r);
        const key = content.slice(0, 100);
        const existing = scores.get(key);
        const rrfScore = 1 / (k + rank + 1);

        scores.set(key, {
          content,
          score: (existing?.score ?? 0) + rrfScore,
          metadata: existing?.metadata ?? r.metadata ?? r,
        });
      }
    }

    return Array.from(scores.values())
      .map(s => ({
        content: s.content,
        score: s.score,
        rerankedScore: s.score,
        metadata: s.metadata,
      }))
      .sort((a, b) => b.rerankedScore - a.rerankedScore);
  }

  /**
   * Maximal Marginal Relevance — balance relevance with diversity.
   */
  rerankMMR(query: string, results: any[], options?: { lambda?: number; topK?: number }): RankedResult[] {
    const lambda = options?.lambda ?? 0.7;
    const topK = options?.topK ?? 10;

    if (results.length === 0) return [];

    // First, score all by keyword relevance
    const scored = this.rerankKeyword(query, results, { topK: results.length });

    const selected: RankedResult[] = [];
    const remaining = [...scored];

    // Greedy MMR selection
    while (selected.length < topK && remaining.length > 0) {
      let bestIdx = 0;
      let bestMMR = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const relevance = remaining[i].rerankedScore;

        // Max similarity to already selected
        let maxSim = 0;
        for (const s of selected) {
          const sim = this.jaccardSimilarity(remaining[i].content, s.content);
          maxSim = Math.max(maxSim, sim);
        }

        const mmrScore = lambda * relevance - (1 - lambda) * maxSim;
        if (mmrScore > bestMMR) {
          bestMMR = mmrScore;
          bestIdx = i;
        }
      }

      const chosen = remaining.splice(bestIdx, 1)[0];
      selected.push({ ...chosen, rerankedScore: bestMMR });
    }

    return selected;
  }

  // ── Internal ───────────────────────────────────────────────

  private extractContent(result: any): string {
    return result.content ?? result.chunk_text ?? result.text ?? result.compiled_truth ?? String(result);
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  private jaccardSimilarity(a: string, b: string): number {
    const setA = new Set(this.tokenize(a));
    const setB = new Set(this.tokenize(b));
    let intersection = 0;
    for (const t of setA) { if (setB.has(t)) intersection++; }
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }
}
