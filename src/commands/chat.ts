/**
 * DeepBrain — Chat with Brain (v1.3 — Multi-Brain)
 *
 * Hybrid search for context across one or multiple brains, then stream LLM response.
 */

import { createChat } from 'agentkits';
import type { ChatMessage } from 'agentkits';
import type { Brain } from '../core/brain.js';

export interface ChatOptions {
  provider?: string;
  model?: string;
  apiKey?: string;
  limit?: number;
}

export interface MultiBrainChatOptions extends ChatOptions {
  /** When chatting across multiple brains, which brain names are involved */
  brainNames?: string[];
}

interface RankedResult {
  brain: string;
  slug: string;
  title: string;
  chunk_text: string;
  score: number;
}

/**
 * Chat with a single brain (backward-compatible).
 */
export async function chatWithBrain(
  brain: Brain,
  question: string,
  opts: ChatOptions = {},
): Promise<void> {
  return chatWithBrains([{ brain, name: 'default' }], question, opts);
}

/**
 * Chat across multiple brains. Results are merged and ranked by score.
 */
export async function chatWithBrains(
  brains: Array<{ brain: Brain; name: string }>,
  question: string,
  opts: MultiBrainChatOptions = {},
): Promise<void> {
  const limit = opts.limit ?? 5;

  // 1. Query all brains in parallel
  const allResults: RankedResult[] = [];
  const queryPromises = brains.map(async ({ brain, name }) => {
    const results = await brain.query(question, { limit });
    return results.map(r => ({
      brain: name,
      slug: r.slug,
      title: r.title,
      chunk_text: r.chunk_text,
      score: r.score,
    }));
  });

  const resultSets = await Promise.all(queryPromises);
  for (const set of resultSets) {
    allResults.push(...set);
  }

  // 2. Sort by relevance score (descending) and take top results
  allResults.sort((a, b) => b.score - a.score);
  const topResults = allResults.slice(0, limit);

  // 3. Build context
  let context = '';
  if (topResults.length > 0) {
    context = topResults
      .map((r, i) => {
        const brainLabel = brains.length > 1 ? ` [${r.brain}]` : '';
        return `[${i + 1}]${brainLabel} ${r.title} (${r.slug})\n${r.chunk_text}`;
      })
      .join('\n\n---\n\n');
  }

  // 4. Build messages
  const brainList = brains.length > 1
    ? `\nYou are searching across these brains: ${brains.map(b => b.name).join(', ')}.`
    : '';

  const systemPrompt = `You are a helpful AI assistant with access to the user's personal knowledge base (DeepBrain).${brainList}
Answer the user's question based on the provided context from their knowledge base.
If the context doesn't contain relevant information, say so honestly.
Respond in the same language as the user's question.`;

  const userMessage = context
    ? `Here is relevant context from my knowledge base:\n\n${context}\n\n---\n\nMy question: ${question}`
    : `My question (no relevant context found in knowledge base): ${question}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  // 5. Create chat client
  const chat = createChat({
    provider: (opts.provider as any) ?? undefined,
    model: opts.model,
    apiKey: opts.apiKey,
  });

  // 6. Stream response
  if (topResults.length > 0) {
    console.log(`\n📚 Found ${topResults.length} relevant pages${brains.length > 1 ? ` across ${brains.length} brains` : ''}:\n`);
    for (const r of topResults) {
      const brainLabel = brains.length > 1 ? ` [${r.brain}]` : '';
      console.log(`  📄${brainLabel} ${r.slug} (score: ${r.score.toFixed(4)})`);
    }
    console.log('');
  } else {
    console.log('\n⚠️  No relevant context found in brain.\n');
  }

  console.log('🤖 ');
  for await (const chunk of chat.stream(messages)) {
    if (chunk.content) {
      process.stdout.write(chunk.content);
    }
  }
  console.log('\n');
}
