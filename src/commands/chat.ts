/**
 * DeepBrain — Enhanced Chat with Brain (v1.7.0)
 *
 * Multi-turn conversation, session persistence, /save, /context,
 * better RAG with re-ranking, streaming, inline citations,
 * conversation memory summary, /topics, /export, /related.
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
  topicSummaries: string[];
  conversationSummary: string;
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
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  return {
    topicSummaries: [],
    conversationSummary: '',
    ...raw,
  };
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

    if (textLower.includes(queryLower)) boost += 0.3;

    let overlap = 0;
    for (const token of queryTokens) {
      if (textLower.includes(token)) overlap++;
    }
    boost += (overlap / Math.max(queryTokens.size, 1)) * 0.2;

    const titleLower = r.title.toLowerCase();
    for (const token of queryTokens) {
      if (titleLower.includes(token)) boost += 0.05;
    }

    return { ...r, score: r.score + boost };
  }).sort((a, b) => b.score - a.score);
}

// ── Conversation Memory Summary ──────────────────────────────────

async function summarizeConversation(
  chat: ReturnType<typeof createChat>,
  messages: ChatMessage[],
): Promise<string> {
  const userMsgs = messages.filter(m => m.role === 'user');
  const assistantMsgs = messages.filter(m => m.role === 'assistant');
  const pairs = userMsgs.map((u, i) => {
    const a = assistantMsgs[i];
    return `Q: ${u.content.slice(0, 200)}\nA: ${a ? a.content.slice(0, 200) : '(no answer)'}`;
  }).join('\n\n');

  const summaryMessages: ChatMessage[] = [
    {
      role: 'system',
      content: 'Summarize this conversation in 3-5 bullet points. Focus on key topics discussed, decisions made, and important facts. Be concise. Respond in the same language as the conversation.',
    },
    { role: 'user', content: pairs },
  ];

  try {
    const response = await chat.chat(summaryMessages, { maxTokens: 500 });
    return response.content.trim();
  } catch {
    return '';
  }
}

async function extractTopics(
  chat: ReturnType<typeof createChat>,
  messages: ChatMessage[],
): Promise<string[]> {
  const userQuestions = messages
    .filter(m => m.role === 'user')
    .map(m => m.content.slice(0, 150))
    .join('\n');

  const topicMessages: ChatMessage[] = [
    {
      role: 'system',
      content: 'Extract the main topics discussed from these questions. Return ONLY a JSON array of topic strings, e.g. ["topic1", "topic2"]. Max 10 topics. Respond in the same language as the questions.',
    },
    { role: 'user', content: userQuestions },
  ];

  try {
    const response = await chat.chat(topicMessages, { maxTokens: 300 });
    const match = response.content.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
  } catch { /* best effort */ }
  return [];
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
  const limit = opts.limit ?? 8;

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

  const ranked = rerank(allResults, question);
  const topResults = ranked.slice(0, limit);

  let context = '';
  if (topResults.length > 0) {
    context = topResults
      .map((r) => {
        const brainLabel = brains.length > 1 ? ` [${r.brain}]` : '';
        return `[Source: ${r.title}]${brainLabel} (${r.slug})\n${r.chunk_text}`;
      })
      .join('\n\n---\n\n');
  }

  const brainList = brains.length > 1
    ? `\nYou are searching across these brains: ${brains.map(b => b.name).join(', ')}.`
    : '';

  const systemPrompt = `You are a helpful AI assistant with access to the user's personal knowledge base (DeepBrain).${brainList}
Answer the user's question based on the provided context from their knowledge base.
IMPORTANT: Include inline citations using [Source: page-title] format when referencing specific sources.
If the context doesn't contain relevant information, say so honestly.
Respond in the same language as the user's question.`;

  const userMessage = context
    ? `Here is relevant context from my knowledge base:\n\n${context}\n\n---\n\nMy question: ${question}`
    : `My question (no relevant context found in knowledge base): ${question}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  const chat = createChat({
    provider: (opts.provider as any) ?? undefined,
    model: opts.model,
    apiKey: opts.apiKey,
  });

  if (topResults.length > 0) {
    console.log(`\n📚 Found ${topResults.length} relevant sources${brains.length > 1 ? ` across ${brains.length} brains` : ''}:\n`);
    for (const r of topResults) {
      const brainLabel = brains.length > 1 ? ` [${r.brain}]` : '';
      console.log(`  ${brainLabel} 📄 ${r.slug} — [Source: ${r.title}] (score: ${r.score.toFixed(4)})`);
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

// ── Interactive Multi-turn Chat ──────────────────────────────────

export async function interactiveChat(
  brains: Array<{ brain: Brain; name: string }>,
  opts: MultiBrainChatOptions & { sessionId?: string; maxTurns?: number } = {},
): Promise<void> {
  const limit = opts.limit ?? 8;
  const maxHistory = opts.maxTurns ?? 10;
  const SUMMARY_INTERVAL = 10;

  let session: ChatSession;
  if (opts.sessionId) {
    const loaded = loadSession(opts.sessionId);
    if (loaded) {
      session = loaded;
      console.log(`\n📂 Resumed session: ${session.id} (${session.messages.filter(m => m.role === 'user').length} turns)\n`);
    } else {
      console.log(`\n⚠️  Session not found: ${opts.sessionId}. Starting new session.\n`);
      session = { id: generateSessionId(), created: new Date().toISOString(), messages: [], bookmarks: [], topicSummaries: [], conversationSummary: '' };
    }
  } else {
    session = { id: generateSessionId(), created: new Date().toISOString(), messages: [], bookmarks: [], topicSummaries: [], conversationSummary: '' };
  }

  const brainLabel = brains.length > 1 ? ` across ${brains.length} brains` : '';
  console.log(`🧠 DeepBrain Interactive Chat${brainLabel}`);
  console.log(`   Session: ${session.id}`);
  console.log(`   Commands: /save, /context, /sessions, /topics, /export, /related, /quit`);
  console.log(`   Type your question to begin.\n`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const chat = createChat({
    provider: (opts.provider as any) ?? undefined,
    model: opts.model,
    apiKey: opts.apiKey,
  });

  let lastContext: RankedResult[] = [];
  let lastAnswer = '';

  const prompt = (): Promise<string> => new Promise(resolve => {
    rl.question('\n💬 You: ', answer => resolve(answer.trim()));
  });

  while (true) {
    const input = await prompt();
    if (!input) continue;

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
          console.log(`  [${i + 1}] 📄 ${r.slug} — [Source: ${r.title}]`);
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

    if (input === '/topics') {
      const userMsgCount = session.messages.filter(m => m.role === 'user').length;
      if (userMsgCount === 0) {
        console.log('No conversation yet. Ask some questions first.');
        continue;
      }
      console.log('\n🔍 Extracting topics...');
      const topics = await extractTopics(chat, session.messages);
      if (topics.length > 0) {
        console.log(`\n📋 Topics discussed (${topics.length}):\n`);
        for (const [i, topic] of topics.entries()) {
          console.log(`   ${i + 1}. ${topic}`);
        }
      } else {
        console.log('\n📋 Questions asked:\n');
        const questions = session.messages.filter(m => m.role === 'user').map(m => m.content);
        for (const [i, q] of questions.entries()) {
          console.log(`   ${i + 1}. ${q.slice(0, 80)}${q.length > 80 ? '...' : ''}`);
        }
      }
      continue;
    }

    if (input === '/export') {
      if (session.messages.length === 0) {
        console.log('No conversation to export.');
        continue;
      }
      const filename = `${session.id}.md`;
      const lines: string[] = [
        `# DeepBrain Chat: ${session.id}`,
        `> Created: ${session.created}`,
        `> Turns: ${session.messages.filter(m => m.role === 'user').length}`,
        '',
        '---',
        '',
      ];
      for (const msg of session.messages) {
        if (msg.role === 'user') {
          lines.push(`## 💬 You\n\n${msg.content}\n`);
        } else if (msg.role === 'assistant') {
          lines.push(`## 🤖 DeepBrain\n\n${msg.content}\n`);
        }
      }
      if (session.bookmarks.length > 0) {
        lines.push('\n---\n\n## 🔖 Bookmarks\n');
        for (const b of session.bookmarks) {
          lines.push(`### Q: ${b.question.slice(0, 100)}\n\n${b.answer.slice(0, 500)}\n`);
        }
      }
      writeFileSync(filename, lines.join('\n'));
      console.log(`📄 Exported to ${filename}`);
      continue;
    }

    if (input === '/related') {
      if (lastContext.length === 0) {
        console.log('No context available. Ask a question first to find related pages.');
        continue;
      }
      console.log('\n🔗 Related pages in your brain:\n');
      const relatedQuery = lastAnswer.slice(0, 200);
      const allRelated: RankedResult[] = [];
      for (const { brain, name } of brains) {
        const results = await brain.query(relatedQuery, { limit: 10 });
        for (const r of results) {
          const alreadyShown = lastContext.some(c => c.slug === r.slug);
          if (!alreadyShown) {
            allRelated.push({ brain: name, slug: r.slug, title: r.title, chunk_text: r.chunk_text, score: r.score });
          }
        }
      }
      const topRelated = allRelated.sort((a, b) => b.score - a.score).slice(0, 5);
      if (topRelated.length === 0) {
        console.log('  No additional related pages found.');
      } else {
        for (const r of topRelated) {
          const brainTag = brains.length > 1 ? ` [${r.brain}]` : '';
          console.log(`  📄 ${r.slug}${brainTag} — [Source: ${r.title}]`);
          console.log(`     ${r.chunk_text.slice(0, 120)}...\n`);
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

    let contextStr = '';
    if (lastContext.length > 0) {
      contextStr = lastContext.map((r) => `[Source: ${r.title}] (${r.slug})\n${r.chunk_text}`).join('\n\n---\n\n');
      console.log(`\n  📚 ${lastContext.length} sources found`);
    }

    let summaryContext = '';
    if (session.conversationSummary) {
      summaryContext = `\n\nPrevious conversation summary:\n${session.conversationSummary}`;
    }

    const systemPrompt: ChatMessage = {
      role: 'system',
      content: `You are a helpful AI assistant with access to the user's personal knowledge base (DeepBrain).
Answer based on the provided context. Include inline citations using [Source: page-title] format when referencing specific sources.
If context is insufficient, say so. Respond in the user's language.${summaryContext}`,
    };

    const recentHistory = session.messages.slice(-maxHistory * 2);
    const userMsg = contextStr
      ? `Context from knowledge base:\n\n${contextStr}\n\n---\n\nQuestion: ${input}`
      : `Question (no relevant context): ${input}`;

    const messagesForLLM: ChatMessage[] = [
      systemPrompt,
      ...recentHistory,
      { role: 'user', content: userMsg },
    ];

    session.messages.push({ role: 'user', content: input });

    console.log('\n🤖 ');
    let fullResponse = '';
    for await (const chunk of chat.stream(messagesForLLM)) {
      if (chunk.content) {
        process.stdout.write(chunk.content);
        fullResponse += chunk.content;
      }
    }
    console.log('');
    lastAnswer = fullResponse;

    session.messages.push({ role: 'assistant', content: fullResponse });

    // Show citation sources
    const sourceRefs = fullResponse.match(/\[Source:\s*([^\]]+)\]/g);
    if (sourceRefs && lastContext.length > 0) {
      const citedTitles = new Set(sourceRefs.map(r => r.replace(/\[Source:\s*/, '').replace(/\]$/, '')));
      if (citedTitles.size > 0) {
        console.log(`\n  📎 Sources cited:`);
        for (const title of citedTitles) {
          const match = lastContext.find(c => c.title === title);
          if (match) {
            console.log(`     [Source: ${title}] — ${match.slug}`);
          } else {
            console.log(`     [Source: ${title}]`);
          }
        }
      }
    }
    // Backward compat: handle numbered [1], [2] citations
    const numRefs = fullResponse.match(/\[(\d+)\]/g);
    if (numRefs && lastContext.length > 0 && !sourceRefs) {
      const cited = new Set(numRefs.map(r => parseInt(r.slice(1, -1)) - 1).filter(i => i >= 0 && i < lastContext.length));
      if (cited.size > 0) {
        console.log(`\n  📎 Sources cited:`);
        for (const i of cited) {
          console.log(`     [${i + 1}] [Source: ${lastContext[i].title}]`);
        }
      }
    }

    // Auto-summarize conversation every SUMMARY_INTERVAL user messages
    const userMsgCount = session.messages.filter(m => m.role === 'user').length;
    if (userMsgCount > 0 && userMsgCount % SUMMARY_INTERVAL === 0) {
      console.log('\n  💭 Summarizing conversation...');
      const summary = await summarizeConversation(chat, session.messages);
      if (summary) {
        session.conversationSummary = summary;
        session.topicSummaries.push(`[Turn ${userMsgCount}] ${summary}`);
        console.log('  ✅ Conversation memory updated');
      }
    }

    if (session.messages.length % 6 === 0) {
      saveSession(session);
    }
  }

  saveSession(session);
  rl.close();
}
