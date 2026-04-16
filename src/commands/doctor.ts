/**
 * DeepBrain — Doctor Command (v1.6.0)
 * 
 * Health check: config, API key, DB, embedding model.
 */

import { existsSync, readFileSync } from 'node:fs';
import { createEmbedding, createChat } from 'agentkits';
import type { DeepBrainConfig } from '../core/types.js';

export interface DoctorResult {
  checks: Array<{ name: string; status: 'pass' | 'fail' | 'warn'; message: string }>;
  healthy: boolean;
}

const SYMBOLS = { pass: '✅', fail: '❌', warn: '⚠️' };

export async function runDoctor(configFile: string, config: Partial<DeepBrainConfig>): Promise<DoctorResult> {
  const checks: DoctorResult['checks'] = [];

  // 1. Config exists
  if (existsSync(configFile)) {
    checks.push({ name: 'Config file', status: 'pass', message: `Found: ${configFile}` });
  } else {
    checks.push({ name: 'Config file', status: 'fail', message: `Not found: ${configFile}. Run 'deepbrain init'.` });
    return { checks, healthy: false };
  }

  // 2. Provider configured
  const provider = config.embedding_provider;
  if (provider) {
    checks.push({ name: 'Embedding provider', status: 'pass', message: provider });
  } else {
    checks.push({ name: 'Embedding provider', status: 'fail', message: 'No embedding_provider in config' });
  }

  // 3. Embedding API key (if needed)
  const embeddingKey = config.embedding_api_key ?? config.api_key;
  if (provider === 'ollama') {
    checks.push({ name: 'Embedding API key', status: 'pass', message: 'Not required (local Ollama)' });
  } else if (embeddingKey) {
    const masked = embeddingKey.slice(0, 8) + '...' + embeddingKey.slice(-4);
    checks.push({ name: 'Embedding API key', status: 'pass', message: `Configured: ${masked}` });
  } else {
    checks.push({ name: 'Embedding API key', status: 'fail', message: 'No embedding_api_key (or api_key) in config' });
  }

  // 3b. LLM API key — only shown when llm_provider differs from embedding_provider
  const llmProvider = config.llm_provider;
  if (llmProvider && llmProvider !== provider) {
    const llmKey = config.llm_api_key ?? config.api_key;
    if (llmProvider === 'ollama') {
      checks.push({ name: 'LLM API key', status: 'pass', message: 'Not required (local Ollama)' });
    } else if (llmKey) {
      const masked = llmKey.slice(0, 8) + '...' + llmKey.slice(-4);
      checks.push({ name: 'LLM API key', status: 'pass', message: `Configured: ${masked}` });
    } else {
      checks.push({ name: 'LLM API key', status: 'fail', message: `No llm_api_key (or api_key) for provider '${llmProvider}'` });
    }
  }

  // 4. Database directory
  const dbPath = config.database ?? './deepbrain-data';
  if (existsSync(dbPath)) {
    checks.push({ name: 'Database', status: 'pass', message: `Found: ${dbPath}` });
  } else {
    checks.push({ name: 'Database', status: 'warn', message: `Not found: ${dbPath} (will be created on first use)` });
  }

  // 5. Test embedding model
  const embeddingApiKey = config.embedding_api_key ?? config.api_key;
  if (provider && (provider === 'ollama' || embeddingApiKey)) {
    try {
      const embedder = createEmbedding({
        provider: provider as any,
        model: config.embedding_model,
        apiKey: embeddingApiKey,
      });
      const vec = await embedder.embed('doctor test');
      checks.push({ name: 'Embedding model', status: 'pass', message: `Working (${vec.length} dimensions)` });
    } catch (e: any) {
      checks.push({ name: 'Embedding model', status: 'fail', message: `Failed: ${e.message?.slice(0, 100)}` });
    }
  } else {
    checks.push({ name: 'Embedding model', status: 'warn', message: 'Skipped (no provider/key)' });
  }

  // 6. Test LLM (if configured)
  const effectiveLlmProvider = config.llm_provider ?? config.embedding_provider;
  const llmApiKey = config.llm_api_key ?? config.api_key;
  if (effectiveLlmProvider && (effectiveLlmProvider === 'ollama' || llmApiKey)) {
    try {
      const chat = createChat({
        provider: effectiveLlmProvider as any,
        model: config.llm_model,
        apiKey: llmApiKey,
      });
      const resp = await chat.chat([{ role: 'user', content: 'Say "ok"' }], { maxTokens: 10 });
      checks.push({ name: 'LLM connectivity', status: 'pass', message: `Working (${effectiveLlmProvider})` });
    } catch (e: any) {
      checks.push({ name: 'LLM connectivity', status: 'warn', message: `Failed: ${e.message?.slice(0, 100)}` });
    }
  }

  const healthy = checks.every(c => c.status !== 'fail');
  return { checks, healthy };
}

export function formatDoctorResult(result: DoctorResult): string {
  const lines = ['\n🩺 DeepBrain Doctor\n'];
  for (const c of result.checks) {
    lines.push(`  ${SYMBOLS[c.status]} ${c.name}: ${c.message}`);
  }
  lines.push('');
  lines.push(result.healthy ? '  🟢 Brain is healthy!' : '  🔴 Issues found. Fix the above errors.');
  lines.push('');
  return lines.join('\n');
}
