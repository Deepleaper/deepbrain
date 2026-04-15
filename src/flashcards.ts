/**
 * DeepBrain — Flashcard Generator (v1.3)
 *
 * Generate Q&A flashcards from knowledge pages.
 * Spaced repetition scheduling via SM-2 algorithm.
 */

import { createChat } from 'agentkits';
import type { ChatMessage } from 'agentkits';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Brain } from './core/brain.js';

// ── Types ────────────────────────────────────────────────────────

export interface Flashcard {
  id: string;
  slug: string;
  question: string;
  answer: string;
  /** SM-2 fields */
  easiness: number;       // EF (≥1.3)
  interval: number;       // days until next review
  repetitions: number;    // consecutive correct
  nextReview: string;     // ISO date string
  created: string;
  lastReviewed?: string;
}

export interface FlashcardDeck {
  version: string;
  cards: Flashcard[];
}

export type ReviewGrade = 0 | 1 | 2 | 3 | 4 | 5;

// ── SM-2 Algorithm ───────────────────────────────────────────────

export function sm2(card: Flashcard, grade: ReviewGrade): Flashcard {
  const today = new Date().toISOString().split('T')[0];
  let { easiness, interval, repetitions } = card;

  if (grade >= 3) {
    // Correct response
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easiness);
    }
    repetitions += 1;
  } else {
    // Incorrect — reset
    repetitions = 0;
    interval = 1;
  }

  // Update easiness factor
  easiness = easiness + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  if (easiness < 1.3) easiness = 1.3;

  const next = new Date();
  next.setDate(next.getDate() + interval);

  return {
    ...card,
    easiness,
    interval,
    repetitions,
    nextReview: next.toISOString().split('T')[0],
    lastReviewed: today,
  };
}

// ── Deck persistence ─────────────────────────────────────────────

function getDeckPath(dataDir: string): string {
  return join(dataDir, 'flashcards.json');
}

export function loadDeck(dataDir: string): FlashcardDeck {
  const path = getDeckPath(dataDir);
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, 'utf8'));
  }
  return { version: '1.0', cards: [] };
}

export function saveDeck(dataDir: string, deck: FlashcardDeck): void {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(getDeckPath(dataDir), JSON.stringify(deck, null, 2));
}

// ── Generate flashcards from brain pages ─────────────────────────

export interface GenerateOpts {
  provider?: string;
  model?: string;
  apiKey?: string;
  slugs?: string[];         // specific pages, or all
  maxPerPage?: number;       // default 5
}

export async function generateFlashcards(
  brain: Brain,
  dataDir: string,
  opts: GenerateOpts = {},
): Promise<Flashcard[]> {
  const deck = loadDeck(dataDir);
  const existingSlugs = new Set(deck.cards.map(c => `${c.slug}::${c.question}`));

  // Get pages
  let pages: Array<{ slug: string; compiled_truth: string; title: string }>;
  if (opts.slugs && opts.slugs.length > 0) {
    pages = [];
    for (const slug of opts.slugs) {
      const p = await brain.get(slug);
      if (p) pages.push(p);
    }
  } else {
    pages = await brain.list({ limit: 100 });
  }

  const chat = createChat({
    provider: (opts.provider as any) ?? undefined,
    model: opts.model,
    apiKey: opts.apiKey,
  });

  const maxPerPage = opts.maxPerPage ?? 5;
  const newCards: Flashcard[] = [];
  const today = new Date().toISOString().split('T')[0];

  for (const page of pages) {
    if (!page.compiled_truth || page.compiled_truth.length < 50) continue;

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Generate up to ${maxPerPage} flashcard Q&A pairs from the given knowledge content.
Return ONLY valid JSON array: [{"question":"...","answer":"..."},...]
Questions should test key concepts. Answers should be concise but complete.
Use the same language as the content.`,
      },
      { role: 'user', content: page.compiled_truth.slice(0, 4000) },
    ];

    try {
      const response = await chat.chat(messages, { maxTokens: 1500 });
      const text = response.content.trim();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) continue;

      const pairs: Array<{ question: string; answer: string }> = JSON.parse(jsonMatch[0]);

      for (const pair of pairs) {
        const key = `${page.slug}::${pair.question}`;
        if (existingSlugs.has(key)) continue;

        const card: Flashcard = {
          id: `${page.slug}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          slug: page.slug,
          question: pair.question,
          answer: pair.answer,
          easiness: 2.5,
          interval: 0,
          repetitions: 0,
          nextReview: today,
          created: today,
        };
        newCards.push(card);
        existingSlugs.add(key);
      }

      console.log(`  📄 ${page.slug}: generated ${pairs.length} cards`);
    } catch (e: any) {
      console.error(`  ⚠️  ${page.slug}: ${e.message}`);
    }
  }

  deck.cards.push(...newCards);
  saveDeck(dataDir, deck);

  return newCards;
}

// ── Get cards due for review ─────────────────────────────────────

export function getDueCards(dataDir: string, limit = 20): Flashcard[] {
  const deck = loadDeck(dataDir);
  const today = new Date().toISOString().split('T')[0];

  return deck.cards
    .filter(c => c.nextReview <= today)
    .sort((a, b) => a.nextReview.localeCompare(b.nextReview))
    .slice(0, limit);
}

// ── Review a card ────────────────────────────────────────────────

export function reviewCard(dataDir: string, cardId: string, grade: ReviewGrade): Flashcard | null {
  const deck = loadDeck(dataDir);
  const idx = deck.cards.findIndex(c => c.id === cardId);
  if (idx === -1) return null;

  deck.cards[idx] = sm2(deck.cards[idx], grade);
  saveDeck(dataDir, deck);
  return deck.cards[idx];
}

// ── Stats ────────────────────────────────────────────────────────

export interface FlashcardStats {
  total: number;
  dueToday: number;
  mastered: number;       // repetitions >= 5
  learning: number;       // repetitions 1-4
  newCards: number;        // repetitions 0
  avgEasiness: number;
}

export function getFlashcardStats(dataDir: string): FlashcardStats {
  const deck = loadDeck(dataDir);
  const today = new Date().toISOString().split('T')[0];
  const cards = deck.cards;

  const mastered = cards.filter(c => c.repetitions >= 5).length;
  const learning = cards.filter(c => c.repetitions >= 1 && c.repetitions < 5).length;
  const newCards = cards.filter(c => c.repetitions === 0).length;
  const dueToday = cards.filter(c => c.nextReview <= today).length;
  const avgEasiness = cards.length > 0
    ? cards.reduce((s, c) => s + c.easiness, 0) / cards.length
    : 0;

  return { total: cards.length, dueToday, mastered, learning, newCards, avgEasiness };
}
