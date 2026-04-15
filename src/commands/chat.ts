/**
 * DeepBrain — Enhanced Chat with Brain (v1.6.0)
 *
 * Multi-turn conversation, session persistence, /save, /context,
 * better RAG with re-ranking, streaming, inline citations.
 */

import { createChat } from 'agentkits';
import type { ChatMessage } from 'agentkits';
import type { Brain } from '../core/brain.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

export interface ChatOptions {
  provider?: string;
  model?: string;
  apiKey?: string;
  limit?: number;
}

export interface MultiBrainChatOptions extends ChatOptions {
  brainNames?: string[];
}

interface RankedResult {
  brain: string;
  slug: string;
  title: string;
  chunk_text: string;
  score: number;
}

interface ChatSession {
  id: string;
  created: string;
  messages: ChatMessage[];
  bookmarks: Array<{ question: string; answer: string; timestamp: string }>;
}

// ── Session Management ───────────────────────────────────────────

function getSessionDir(): string {
  const dir = join(process.cwd(), '.deepbrain-sessions');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function generateSessionId(): string {
  const now = new Date();
  return `chat-${now.toISOString().slice(0, 10)}-${now.getTime().toString(36)}`;
}

function saveSession(session: ChatSession): void {
  const file = join(getSessionDir(), `${session.id}.json`);
  writeFileSync(file, JSON.stringify(session, null, 2));
}

function loadSession(id: string): ChatSession | null {
  const file = join(getSessionDir(), `${id}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}

function listSessions(): Array<{ id: string; created: string; turns: number }> {
  const dir = getSessionDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const s = JSON.parse(readFileSync(join(dir, f), 'utf8'));
        return { id: s.id, created: s.created, turns: s.messages.filter((m: ChatMessage) => m.role === 'user').length };
      } catch { return null; }
    })
    .filter(Boolean) as any;
}

// ── Re-ranking ───────────────────────────────────────────────────

function rerank(results: RankedResult[], query: string): RankedResult[] {
  const queryLower = query.toLowerCase();
  const queryTokens = new Set(queryLower.split(/\s+/).filter(t => t.length > 2));

  return results.map(r => {
    let boost = 0;
    const textLower = r.chunk_text.toLowerCase();

    // Exact phrase match boost
    if (textLower.includes(queryLower)) boost += 0.3;

    // Token overlap boost
    let overlap = 0;
    for (const token of queryTokens) {
      if (textLower.includes(token)) overlap++;
    }
    boost += (overlap / Math.max(queryTokens.size, 1)) * 0.2;

    // Title relevance boost
    const titleLower = r.title.toLowerCase();
    for (const token of queryTokens) {
      if (titleLower.includes(token)) boost += 0.05;
    }

    return { ...r, score: r.score + boost };
  }).sort((a, b) => b.score - a.score);
}

// ── Single-shot Chat (backward-compatible) ───────────────────────

export async function chatWithBrain(
  brain: Brain,
  question: string,
  opts: ChatOptions = {},
): Promise<void> {
  return chatWithBrains([{ brain, name: 'default' }], question, opts);
}

export async function chatWithBrains(
  brains: Array<{ brain: Brain; name: string }>,
  question: string,
  opts: MultiBrainChatOptions = {},
): Promise<void> {
  const limit = opts.limit ?? 8; // Increased from 5 for better RAG

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
  for (const set of resultSets) allResults.push(...set);

  // 2. Re-rank by relevance
  const ranked = rerank(allResults, question);
  const topResults = ranked.slice(0, limit);

  // 3. Build context with numbered citations
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
IMPORTANT: Include inline citations like [1], [2] when referencing specific sources.
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

  // 6. Show sources
  if (topResults.length > 0) {
    console.log(`\n📚 Found ${topResults.length} relevant sources${brains.length > 1 ? ` across ${brains.length} brains` : ''}:\n`);
    for (const [i, r] of topResults.entries()) {
      const brainLabel = brains.length > 1 ? ` [${r.brain}]` : '';
      console.log(`  [${i + 1}]${brainLabel} 📄 ${r.slug} — ${r.title} (score: ${r.score.toFixed(4)})`);
    }
    console.log('');
  } else {
    console.log('\n⚠️  No relevant context found in brain.\n');
  }

  // 7. Stream response
  console.log('🤖 ');
  for await (const chunk of chat.stream(messages)) {
    if (chunk.content) {
      process.stdout.write(chunk.content);
    }
  }
  console.log('\n');
}

// ── Interactive Multi-turn Chat ──────────────────────────────────

export async function interactiveChat(
  brains: Array<{ brain: Brain; name: string }>,
  opts: MultiBrainChatOptions & { sessionId?: string; maxTurns?: number } = {},
): Promise<void> {
  const limit = opts.limit ?? 8;
  const maxHistory = opts.maxTurns ?? 10;

  // Load or create session
  let session: ChatSession;
  if (opts.sessionId) {
    const loaded = loadSession(opts.sessionId);
    if (loaded) {
      session = loaded;
      console.log(`\n📂 Resumed session: ${session.id} (${session.messages.filter(m => m.role === 'user').length} turns)\n`);
    } else {
      console.log(`\n⚠️  Session not found: ${opts.sessionId}. Starting new session.\n`);
      session = { id: generateSessionId(), created: new Date().toISOString(), messages: [], bookmarks: [] };
    }
  } else {
    session = { id: generateSessionId(), created: new Date().toISOString(), messages: [], bookmarks: [] };
  }

  const brainLabel = brains.length > 1 ? ` across ${brains.length} brains` : '';
  console.log(`🧠 DeepBrain Interactive Chat${brainLabel}`);
  console.log(`   Session: ${session.id}`);
  console.log(`   Commands: /save, /context, /sessions, /quit`);
  console.log(`   Type your question to begin.\n`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const chat = createChat({
    provider: (opts.provider as any) ?? undefined,
    model: opts.model,
    apiKey: opts.apiKey,
  });

  let lastContext: RankedResult[] = [];

  const prompt = (): Promise<string> => new Promise(resolve => {
    rl.question('\n💬 You: ', answer => resolve(answer.trim()));
  });

  while (true) {
    const input = await prompt();
    if (!input) continue;

    // Handle commands
    if (input === '/quit' || input === '/exit' || input === '/q') {
      saveSession(session);
      console.log(`\n💾 Session saved: ${session.id}`);
      break;
    }

    if (input === '/save') {
      if (session.messages.length < 2) {
        console.log('No conversation to bookmark yet.');
        continue;
      }
      const lastUser = [...session.messages].reverse().find(m => m.role === 'user');
      const lastAssistant = [...session.messages].reverse().find(m => m.role === 'assistant');
      if (lastUser && lastAssistant) {
        session.bookmarks.push({
          question: lastUser.content,
          answer: lastAssistant.content,
          timestamp: new Date().toISOString(),
        });
        saveSession(session);
        console.log(`🔖 Bookmarked! (${session.bookmarks.length} total)`);
      }
      continue;
    }

    if (input === '/context') {
      if (lastContext.length === 0) {
        console.log('No context retrieved yet. Ask a question first.');
      } else {
        console.log(`\n📚 Last retrieved context (${lastContext.length} chunks):\n`);
        for (const [i, r] of lastContext.entries()) {
          console.log(`  [${i + 1}] 📄 ${r.slug} — ${r.title}`);
          console.log(`      Score: ${r.score.toFixed(4)}`);
          console.log(`      ${r.chunk_text.slice(0, 150)}...\n`);
        }
      }
      continue;
    }

    if (input === '/sessions') {
      const sessions = listSessions();
      if (sessions.length === 0) {
        console.log('No saved sessions.');
      } else {
        console.log(`\n📂 Saved sessions:\n`);
        for (const s of sessions) {
          const marker = s.id === session.id ? ' ← current' : '';
          console.log(`  ${s.id} (${s.turns} turns, ${s.created})${marker}`);
        }
      }
      continue;
    }

    // Regular question — retrieve context
    const allResults: RankedResult[] = [];
    for (const { brain, name } of brains) {
      const results = await brain.query(input, { limit });
      for (const r of results) {
        allResults.push({ brain: name, slug: r.slug, title: r.title, chunk_text: r.chunk_text, score: r.score });
      }
    }
    const ranked = rerank(allResults, input);
    lastContext = ranked.slice(0, limit);

    // Build context string
    let contextStr = '';
    if (lastContext.length > 0) {
      contextStr = lastContext.map((r, i) => `[${i + 1}] ${r.title} (${r.slug})\n${r.chunk_text}`).join('\n\n---\n\n');
      console.log(`\n  📚 ${lastContext.length} sources found`);
    }

    // Build messages with history (keep last N turns)
    const systemPrompt: ChatMessage = {
      role: 'system',
      content: `You are a helpful AI assistant with access to the user's personal knowledge base (DeepBrain).
Answer based on the provided context. Include inline citations like [1], [2].
If context is insufficient, say so. Respond in the user's language.`,
    };

    // Keep recent history
    const recentHistory = session.messages.slice(-maxHistory * 2);
    const userMsg = contextStr
      ? `Context from knowledge base:\n\n${contextStr}\n\n---\n\nQuestion: ${input}`
      : `Question (no relevant context): ${input}`;

    const messagesForLLM: ChatMessage[] = [
      systemPrompt,
      ...recentHistory,
      { role: 'user', content: userMsg },
    ];

    // Store clean user message in session
    session.messages.push({ role: 'user', content: input });

    // Stream response
    console.log('\n🤖 ');
    let fullResponse = '';
    for await (const chunk of chat.stream(messagesForLLM)) {
      if (chunk.content) {
        process.stdout.write(chunk.content);
        fullResponse += chunk.content;
      }
    }
    console.log('');

    // Store assistant response
    session.messages.push({ role: 'assistant', content: fullResponse });

    // Show citation sources if any were referenced
    const citationRefs = fullResponse.match(/\[(\d+)\]/g);
    if (citationRefs && lastContext.length > 0) {
      const cited = new Set(citationRefs.map(r => parseInt(r.slice(1, -1)) - 1).filter(i => i >= 0 && i < lastContext.length));
      if (cited.size > 0) {
        console.log(`\n  📎 Sources cited:`);
        for (const i of cited) {
          console.log(`     [${i + 1}] ${lastContext[i].title}`);
        }
      }
    }

    // Auto-save session periodically
    if (session.messages.length % 6 === 0) {
      saveSession(session);
    }
  }

  saveSession(session);
  rl.close();
}
