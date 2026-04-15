/**
 * DeepBrain — Chat with Brain
 *
 * Hybrid search for context, then stream LLM response.
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

export async function chatWithBrain(
  brain: Brain,
  question: string,
  opts: ChatOptions = {},
): Promise<void> {
  // 1. Hybrid search for relevant context
  const results = await brain.query(question, { limit: opts.limit ?? 5 });

  // 2. Build context from search results
  let context = '';
  if (results.length > 0) {
    context = results
      .map((r, i) => `[${i + 1}] ${r.title} (${r.slug})\n${r.chunk_text}`)
      .join('\n\n---\n\n');
  }

  // 3. Build messages
  const systemPrompt = `You are a helpful AI assistant with access to the user's personal knowledge base (DeepBrain).
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

  // 4. Create chat client
  const chat = createChat({
    provider: (opts.provider as any) ?? undefined,
    model: opts.model,
    apiKey: opts.apiKey,
  });

  // 5. Stream response
  if (results.length > 0) {
    console.log(`\n📚 Found ${results.length} relevant pages:\n`);
    for (const r of results) {
      console.log(`  📄 ${r.slug} (score: ${r.score.toFixed(4)})`);
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
