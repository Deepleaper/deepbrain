/**
 * DeepBrain — Auto-Tagging
 *
 * Uses LLM to automatically generate tags for pages.
 * Configurable: enable/disable, max tags per page.
 */

import { createChat } from 'agentkits';
import type { ChatMessage } from 'agentkits';
import type { Brain } from './core/brain.js';

export interface AutoTagConfig {
  enabled: boolean;
  maxTags: number;
  provider?: string;
  model?: string;
  apiKey?: string;
}

export interface AutoTagResult {
  slug: string;
  tags: string[];
  skipped: boolean;
  reason?: string;
}

const TAG_SYSTEM_PROMPT = `You are a knowledge tagging assistant. Given content, extract meaningful tags.
Rules:
- Return ONLY a JSON array of strings: ["tag1", "tag2", "tag3"]
- Tags should be lowercase, concise (1-3 words)
- Mix specific and general tags
- Use the same language as the content (Chinese content → Chinese tags)
- No markdown, no explanation, just the JSON array`;

/** Generate tags for content using LLM */
export async function generateTags(
  content: string,
  config: AutoTagConfig,
): Promise<string[]> {
  if (!config.enabled) return [];

  const chat = createChat({
    provider: (config.provider ?? 'ollama') as any,
    model: config.model,
    apiKey: config.apiKey,
  });

  const messages: ChatMessage[] = [
    { role: 'system', content: TAG_SYSTEM_PROMPT },
    { role: 'user', content: `Generate up to ${config.maxTags} tags for:\n\n${content.slice(0, 3000)}` },
  ];

  try {
    const response = await chat.chat(messages, { maxTokens: 200 });
    const text = response.content.trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const tags = JSON.parse(match[0]);
      if (Array.isArray(tags)) {
        return tags
          .filter((t: unknown) => typeof t === 'string' && t.length > 0)
          .slice(0, config.maxTags);
      }
    }
  } catch {
    // LLM unavailable
  }
  return [];
}

/** Auto-tag a single page */
export async function autoTagPage(
  brain: Brain,
  slug: string,
  config: AutoTagConfig,
): Promise<AutoTagResult> {
  if (!config.enabled) {
    return { slug, tags: [], skipped: true, reason: 'auto-tagging disabled' };
  }

  const page = await brain.get(slug);
  if (!page) {
    return { slug, tags: [], skipped: true, reason: 'page not found' };
  }

  const content = `${page.title}\n\n${page.compiled_truth}`;
  const tags = await generateTags(content, config);

  if (tags.length === 0) {
    return { slug, tags: [], skipped: true, reason: 'no tags generated' };
  }

  // Apply tags
  for (const tag of tags) {
    await brain.tag(slug, tag);
  }

  return { slug, tags, skipped: false };
}

/** Re-tag all pages in the brain */
export async function retagAll(
  brain: Brain,
  config: AutoTagConfig,
  onProgress?: (slug: string, tags: string[]) => void,
): Promise<AutoTagResult[]> {
  const pages = await brain.list({ limit: 1000 });
  const results: AutoTagResult[] = [];

  for (const page of pages) {
    const result = await autoTagPage(brain, page.slug, config);
    results.push(result);
    if (!result.skipped && onProgress) {
      onProgress(result.slug, result.tags);
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  return results;
}

/** Load auto-tag config from deepbrain config */
export function loadAutoTagConfig(config: Record<string, unknown>): AutoTagConfig {
  const at = (config.auto_tag ?? config.autoTag ?? {}) as Record<string, unknown>;
  return {
    enabled: (at.enabled as boolean) ?? true,
    maxTags: (at.maxTags as number) ?? (at.max_tags as number) ?? 5,
    provider: (config.llm_provider ?? config.embedding_provider) as string | undefined,
    model: config.llm_model as string | undefined,
    apiKey: config.api_key as string | undefined,
  };
}
