#!/usr/bin/env node

/**
 * DeepBrain — CLI
 *
 * Commands:
 *   deepbrain init [provider]          Initialize a new brain
 *   deepbrain put <slug> <file>        Add/update a page
 *   deepbrain get <slug>               Read a page
 *   deepbrain query "text"             Semantic search
 *   deepbrain search "keyword"         Keyword search
 *   deepbrain chat "question"          Chat with your brain
 *   deepbrain link <from> <to>         Create a link
 *   deepbrain timeline <slug> "text"   Add timeline entry
 *   deepbrain stats                    Brain statistics
 *   deepbrain dream                    Run Dream Cycle
 *   deepbrain list [--type X]          List pages
 *   deepbrain list-brains              List all brains
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { Brain } from './core/brain.js';
import type { DeepBrainConfig } from './core/types.js';
import { dream } from './dream/index.js';
import { chatWithBrain } from './commands/chat.js';
import { createChat } from 'agentkits';
import type { ChatMessage } from 'agentkits';
import { parseOp, executeOp } from './operations.js';
import { injectMemories, formatInjection } from './proactive.js';
import { getTierStats, runTierCycle, setTier, getCoreContext, type MemoryTier } from './memory-tiers.js';
import { getKnowledgeEvolution, formatTimeline } from './temporal.js';
import { runCompression, compressPage } from './compression.js';
import { buildKnowledgeGraph, queryGraph, formatGraph, formatQueryResult } from './knowledge-graph.js';
import { generateDigest, formatDigest } from './digest.js';
import { shareBrain, unshareBrain, listShared, mergeBrains, formatMergeResult, formatSharedList } from './collaboration.js';
import { startServer } from './server.js';
import { PluginRegistry, formatPluginList } from './plugins.js';
import { advancedSearch, formatAdvancedResults } from './search-advanced.js';
import type { AdvancedSearchOpts } from './search-advanced.js';

// ── Multi-brain helpers ──────────────────────────────────────────

function getBrainBaseDir(): string {
  return resolve('.deepbrain-brains');
}

function getBrainDir(brainName: string): string {
  return join(getBrainBaseDir(), brainName);
}

function getConfigFile(brainName: string): string {
  if (brainName === 'default' && existsSync('deepbrain.json')) {
    // Backward compat: default brain can use root config
    return 'deepbrain.json';
  }
  return join(getBrainDir(brainName), 'deepbrain.json');
}

// ── Flag parsing ─────────────────────────────────────────────────

function extractFlag(args: string[], flag: string, defaultValue: string): { value: string; args: string[] } {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) {
    const value = args[idx + 1];
    const newArgs = [...args.slice(0, idx), ...args.slice(idx + 2)];
    return { value, args: newArgs };
  }
  return { value: defaultValue, args };
}

function hasFlag(args: string[], flag: string): { present: boolean; args: string[] } {
  const idx = args.indexOf(flag);
  if (idx !== -1) {
    return { present: true, args: [...args.slice(0, idx), ...args.slice(idx + 1)] };
  }
  return { present: false, args };
}

// ── Config / Brain ───────────────────────────────────────────────

function loadConfig(brainName: string): Partial<DeepBrainConfig> {
  const configFile = getConfigFile(brainName);
  if (existsSync(configFile)) {
    return JSON.parse(readFileSync(configFile, 'utf8'));
  }
  return {};
}

async function getBrain(brainName: string): Promise<Brain> {
  const config = loadConfig(brainName);
  if (!config.database && brainName !== 'default') {
    config.database = join(getBrainDir(brainName), 'data');
  }
  const brain = new Brain(config);
  await brain.connect();
  return brain;
}

// ── Auto-summary helper ─────────────────────────────────────────

async function generateSummaryAndTags(
  content: string,
  config: Partial<DeepBrainConfig>,
): Promise<{ summary: string; tags: string[] }> {
  const chat = createChat({
    provider: (config.llm_provider ?? config.embedding_provider ?? 'ollama') as any,
    model: config.llm_model,
    apiKey: config.api_key,
  });

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a knowledge assistant. Given content, return ONLY valid JSON with:
{"summary": "1-2 sentence summary", "tags": ["tag1", "tag2", "tag3"]}
Extract 3-5 meaningful tags. Respond in the same language as the content. No markdown, just JSON.`,
    },
    { role: 'user', content: content.slice(0, 3000) },
  ];

  try {
    const response = await chat.chat(messages, { maxTokens: 300 });
    const text = response.content.trim();
    // Try to parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary ?? '',
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      };
    }
  } catch {
    // Silently fail - summary is optional
  }
  return { summary: '', tags: [] };
}

// ── Available providers ──────────────────────────────────────────

const AVAILABLE_PROVIDERS = ['ollama', 'openai', 'gemini', 'deepseek', 'dashscope', 'zhipu', 'moonshot'];

const ENV_KEYS: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  dashscope: 'DASHSCOPE_API_KEY',
  zhipu: 'ZHIPU_API_KEY',
  moonshot: 'MOONSHOT_API_KEY',
};

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  let args = process.argv.slice(2);

  // Extract --brain flag (applies to all commands)
  const brainResult = extractFlag(args, '--brain', 'default');
  const brainName = brainResult.value;
  args = brainResult.args;

  const command = args[0];

  switch (command) {
    case 'init': {
      const provider = args[1] ?? 'ollama';
      const brainDir = getBrainDir(brainName);
      const dataDir = join(brainDir, 'brain');
      const dbDir = join(brainDir, 'data');

      const config: Partial<DeepBrainConfig> = {
        engine: 'pglite',
        database: dbDir,
        embedding_provider: provider,
        data_dir: dataDir,
      };

      // Auto-detect API key from env
      const envKey = ENV_KEYS[provider];
      if (envKey && process.env[envKey]) {
        config.api_key = process.env[envKey];
      }

      mkdirSync(brainDir, { recursive: true });
      mkdirSync(dataDir, { recursive: true });
      mkdirSync(dbDir, { recursive: true });

      const configFile = join(brainDir, 'deepbrain.json');
      writeFileSync(configFile, JSON.stringify(config, null, 2));

      // Also write root config for backward compat if default brain
      if (brainName === 'default') {
        const rootConfig = { ...config, database: './deepbrain-data', data_dir: './brain' };
        writeFileSync('deepbrain.json', JSON.stringify(rootConfig, null, 2));
        mkdirSync('./brain', { recursive: true });
        mkdirSync('./deepbrain-data', { recursive: true });
      }

      console.log(`\n🧠 DeepBrain initialized!`);
      console.log(`   Brain: ${brainName}`);
      console.log(`   Provider: ${provider}`);
      console.log(`   Config: ${configFile}`);
      console.log(`   Data: ${dbDir}`);
      console.log(`\n   Try: deepbrain put my-first-note notes.md`);
      break;
    }

    case 'put': {
      const noSummaryResult = hasFlag(args, '--no-summary');
      const noSummary = noSummaryResult.present;
      args = noSummaryResult.args;

      const slug = args[1];
      const file = args[2];
      if (!slug) { console.error('Usage: deepbrain put <slug> [file] [--no-summary]'); break; }

      const brain = await getBrain(brainName);
      let content: string;

      if (file && existsSync(file)) {
        content = readFileSync(file, 'utf8');
      } else if (file) {
        content = args.slice(2).join(' ');
      } else {
        // Read from stdin
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) chunks.push(chunk);
        content = Buffer.concat(chunks).toString();
      }

      // Parse frontmatter if present
      let title = slug;
      let type = 'note';
      let body = content;
      let frontmatter: Record<string, unknown> = {};

      const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (fmMatch) {
        const fm = fmMatch[1];
        body = fmMatch[2];
        const titleMatch = fm.match(/title:\s*(.+)/);
        const typeMatch = fm.match(/type:\s*(.+)/);
        if (titleMatch) title = titleMatch[1].trim();
        if (typeMatch) type = typeMatch[1].trim();
      }

      const page = await brain.put(slug, {
        type,
        title,
        compiled_truth: body.trim(),
        frontmatter,
      });

      console.log(`✅ ${slug} saved (${body.length} chars, type: ${type})`);

      // Auto-summary
      if (!noSummary) {
        try {
          const config = loadConfig(brainName);
          const { summary, tags } = await generateSummaryAndTags(body, config);
          if (summary || tags.length > 0) {
            // Update frontmatter with summary and tags
            frontmatter = { ...frontmatter, summary, auto_tags: tags };
            await brain.put(slug, {
              type,
              title,
              compiled_truth: body.trim(),
              frontmatter,
            });
            if (summary) console.log(`📝 Summary: ${summary}`);
            if (tags.length > 0) {
              console.log(`🏷️  Tags: ${tags.join(', ')}`);
              // Also store as actual tags
              for (const tag of tags) {
                await brain.tag(slug, tag);
              }
            }
          }
        } catch {
          // Summary generation is best-effort
          console.log(`ℹ️  Auto-summary skipped (LLM unavailable). Use --no-summary to suppress.`);
        }
      }

      await brain.disconnect();
      break;
    }

    case 'get': {
      const slug = args[1];
      if (!slug) { console.error('Usage: deepbrain get <slug>'); break; }

      const brain = await getBrain(brainName);
      const page = await brain.get(slug);

      if (page) {
        console.log(`# ${page.title}\n`);
        console.log(`Type: ${page.type} | Updated: ${page.updated_at}\n`);
        if (page.frontmatter && (page.frontmatter as any).summary) {
          console.log(`Summary: ${(page.frontmatter as any).summary}\n`);
        }
        console.log(page.compiled_truth);
        if (page.timeline) {
          console.log(`\n---\n## Timeline\n${page.timeline}`);
        }
      } else {
        console.log(`Page not found: ${slug}`);
      }
      await brain.disconnect();
      break;
    }

    case 'query':
    case 'q': {
      const text = args.slice(1).join(' ');
      if (!text) { console.error('Usage: deepbrain query "search text"'); break; }

      const brain = await getBrain(brainName);
      const results = await brain.query(text, { limit: 10 });

      if (results.length === 0) {
        console.log('No results found.');
      } else {
        console.log(`\n🔍 ${results.length} results for "${text}"\n`);
        for (const r of results) {
          console.log(`  📄 ${r.slug} (${r.type}) — score: ${r.score.toFixed(4)}`);
          console.log(`     ${r.chunk_text.slice(0, 120)}...\n`);
        }
      }
      await brain.disconnect();
      break;
    }

    case 'search':
    case 's': {
      // Check for advanced search flags
      const tagResult = extractFlag(args, '--tag', '');
      args = tagResult.args;
      const afterResult = extractFlag(args, '--after', '');
      args = afterResult.args;
      const beforeResult = extractFlag(args, '--before', '');
      args = beforeResult.args;
      const tierResult = extractFlag(args, '--tier', '');
      args = tierResult.args;
      const fuzzyResult = hasFlag(args, '--fuzzy');
      args = fuzzyResult.args;

      const keyword = args.slice(1).join(' ');
      if (!keyword) { console.error('Usage: deepbrain search "keyword" [--tag X] [--after YYYY-MM-DD] [--fuzzy]'); break; }

      const brain = await getBrain(brainName);

      const isAdvanced = tagResult.value || afterResult.value || beforeResult.value || tierResult.value || fuzzyResult.present;

      if (isAdvanced) {
        const opts: AdvancedSearchOpts = {
          limit: 20,
          tag: tagResult.value || undefined,
          after: afterResult.value || undefined,
          before: beforeResult.value || undefined,
          tier: tierResult.value || undefined,
          fuzzy: fuzzyResult.present,
        };
        const results = await advancedSearch(brain, keyword, opts);
        console.log(formatAdvancedResults(results, keyword));
      } else {
        const results = await brain.search(keyword, { limit: 10 });
        if (results.length === 0) {
          console.log('No results found.');
        } else {
          console.log(`\n🔑 ${results.length} results for "${keyword}"\n`);
          for (const r of results) {
            console.log(`  📄 ${r.slug} (${r.type}) — score: ${r.score.toFixed(4)}`);
            console.log(`     ${r.chunk_text.slice(0, 120)}...\n`);
          }
        }
      }
      await brain.disconnect();
      break;
    }

    case 'chat': {
      const providerResult = extractFlag(args, '--provider', '');
      args = providerResult.args;
      const modelResult = extractFlag(args, '--model', '');
      args = modelResult.args;

      const question = args.slice(1).join(' ');
      if (!question) { console.error('Usage: deepbrain chat "your question" [--provider deepseek] [--model ...]'); break; }

      const brain = await getBrain(brainName);
      const config = loadConfig(brainName);

      await chatWithBrain(brain, question, {
        provider: providerResult.value || config.llm_provider || config.embedding_provider,
        model: modelResult.value || config.llm_model || undefined,
        apiKey: config.api_key,
      });

      await brain.disconnect();
      break;
    }

    case 'link': {
      const [from, to] = [args[1], args[2]];
      if (!from || !to) { console.error('Usage: deepbrain link <from> <to>'); break; }
      const brain = await getBrain(brainName);
      await brain.link(from, to, args[3] ?? '', args[4] ?? 'related');
      console.log(`🔗 ${from} → ${to}`);
      await brain.disconnect();
      break;
    }

    case 'timeline':
    case 'tl': {
      const slug = args[1];
      const text = args.slice(2).join(' ');
      if (!slug || !text) { console.error('Usage: deepbrain timeline <slug> "event text"'); break; }

      const brain = await getBrain(brainName);
      await brain.addTimeline(slug, {
        date: new Date().toISOString().split('T')[0],
        summary: text,
      });
      console.log(`📅 Timeline added to ${slug}`);
      await brain.disconnect();
      break;
    }

    case 'stats': {
      const brain = await getBrain(brainName);
      const s = await brain.stats();
      console.log(`\n🧠 DeepBrain Stats${brainName !== 'default' ? ` (brain: ${brainName})` : ''}\n`);
      console.log(`   Pages:     ${s.page_count}`);
      console.log(`   Chunks:    ${s.chunk_count} (${s.embedded_count} embedded)`);
      console.log(`   Links:     ${s.link_count}`);
      console.log(`   Tags:      ${s.tag_count}`);
      console.log(`   Timeline:  ${s.timeline_entry_count}`);
      console.log(`   By type:  `, s.pages_by_type);
      await brain.disconnect();
      break;
    }

    case 'list':
    case 'ls': {
      const typeIdx = args.indexOf('--type');
      const type = typeIdx !== -1 ? args[typeIdx + 1] : undefined;

      const brain = await getBrain(brainName);
      const pages = await brain.list({ type, limit: 50 });

      console.log(`\n📋 ${pages.length} pages${type ? ` (type: ${type})` : ''}${brainName !== 'default' ? ` [brain: ${brainName}]` : ''}\n`);
      for (const p of pages) {
        console.log(`  ${p.slug.padEnd(30)} ${p.type.padEnd(12)} ${p.updated_at}`);
      }
      await brain.disconnect();
      break;
    }

    case 'list-brains': {
      const baseDir = getBrainBaseDir();
      console.log('\n🧠 Available brains:\n');

      // Check root default brain
      if (existsSync('deepbrain.json')) {
        const config = JSON.parse(readFileSync('deepbrain.json', 'utf8'));
        console.log(`  * default (provider: ${config.embedding_provider ?? 'unknown'})`);
      }

      // Check multi-brain directory
      if (existsSync(baseDir)) {
        const entries = readdirSync(baseDir);
        for (const entry of entries) {
          const entryPath = join(baseDir, entry);
          if (statSync(entryPath).isDirectory()) {
            const configPath = join(entryPath, 'deepbrain.json');
            if (existsSync(configPath)) {
              const config = JSON.parse(readFileSync(configPath, 'utf8'));
              const marker = entry === 'default' ? ' *' : '  ';
              console.log(`${marker} ${entry} (provider: ${config.embedding_provider ?? 'unknown'})`);
            } else {
              console.log(`    ${entry} (no config)`);
            }
          }
        }
      }

      if (!existsSync('deepbrain.json') && !existsSync(baseDir)) {
        console.log('  No brains found. Run: deepbrain init [provider]');
      }
      console.log('');
      break;
    }

    case 'dream': {
      console.log('\n💤 Running Dream Cycle...\n');
      const brain = await getBrain(brainName);
      const report = await dream(brain);
      console.log(`\n✅ Dream complete`);
      console.log(`   Refreshed: ${report.stale_refreshed}`);
      console.log(`   Orphans: ${report.orphans_found}`);
      console.log(`   Dead links removed: ${report.dead_links_removed}`);
      if (report.errors.length > 0) {
        console.log(`   Errors: ${report.errors.length}`);
        report.errors.forEach(e => console.log(`     ⚠️ ${e}`));
      }
      await brain.disconnect();
      break;
    }

    // ── New v0.9.0 Commands ──────────────────────────────────────

    case 'op': {
      const dsl = args.slice(1).join(' ');
      if (!dsl) { console.error('Usage: deepbrain op "MERGE topic:AI topic:ML"'); break; }
      const brain = await getBrain(brainName);
      const op = parseOp(dsl);
      console.log(`⚙️  Executing: ${op.type}`, op.args);
      const result = await executeOp(brain, op);
      console.log(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
      if (result.affected.length > 0) console.log(`   Affected: ${result.affected.join(', ')}`);
      await brain.disconnect();
      break;
    }

    case 'inject': {
      const message = args.slice(1).join(' ');
      if (!message) { console.error('Usage: deepbrain inject "I\'m preparing for the board meeting"'); break; }
      const brain = await getBrain(brainName);
      const result = await injectMemories(brain, message);
      if (result.memories.length === 0) {
        console.log('No relevant memories found.');
      } else {
        console.log(formatInjection(result));
        console.log(`\n📊 ${result.memories.length} memories, ~${result.totalTokensEstimate} tokens`);
      }
      await brain.disconnect();
      break;
    }

    case 'tiers': {
      const sub = args[1];
      const brain = await getBrain(brainName);
      if (sub === 'stats') {
        const stats = await getTierStats(brain);
        console.log(`\n🏗️  Memory Tiers:`);
        console.log(`   Core:     ${stats.core}`);
        console.log(`   Working:  ${stats.working}`);
        console.log(`   Archival: ${stats.archival}`);
      } else if (sub === 'cycle') {
        const result = await runTierCycle(brain);
        console.log(`🔄 Tier cycle complete: ${result.promoted.length} promoted, ${result.demoted.length} demoted`);
      } else if (sub === 'set' && args[2] && args[3]) {
        await setTier(brain, args[2], args[3] as MemoryTier);
        console.log(`✅ Set "${args[2]}" to tier: ${args[3]}`);
      } else if (sub === 'core') {
        console.log(await getCoreContext(brain) || 'No core memories.');
      } else {
        console.error('Usage: deepbrain tiers [stats|cycle|core|set <slug> <tier>]');
      }
      await brain.disconnect();
      break;
    }

    case 'temporal':
    case 'tl-view': {
      const slug = args[1];
      if (!slug) { console.error('Usage: deepbrain temporal <slug>'); break; }
      const brain = await getBrain(brainName);
      const evolution = await getKnowledgeEvolution(brain, slug);
      if (evolution) {
        console.log(formatTimeline(evolution));
      } else {
        console.log(`Page not found: ${slug}`);
      }
      await brain.disconnect();
      break;
    }

    case 'compress': {
      const slug = args[1];
      const brain = await getBrain(brainName);
      if (slug) {
        const result = await compressPage(brain, slug);
        if (result) {
          console.log(`🗜️  Compressed "${slug}": ${result.originalLength} → ${result.compressedLength} chars (${(result.ratio * 100).toFixed(0)}%)`);
        } else {
          console.log('Nothing to compress (too short, already compressed, or not found).');
        }
      } else {
        const results = await runCompression(brain);
        console.log(`🗜️  Compressed ${results.length} pages`);
        for (const r of results) {
          console.log(`   ${r.slug}: ${r.originalLength} → ${r.compressedLength} (${(r.ratio * 100).toFixed(0)}%)`);
        }
      }
      await brain.disconnect();
      break;
    }

    // ── v1.0.0 Commands ──────────────────────────────────────────

    case 'graph': {
      const sub = args[1];
      const brain = await getBrain(brainName);
      const config = loadConfig(brainName);
      const llmConfig = { provider: config.llm_provider ?? config.embedding_provider, model: config.llm_model, apiKey: config.api_key };

      if (sub === 'query') {
        const entity = args.slice(2).join(' ');
        if (!entity) { console.error('Usage: deepbrain graph query "entity"'); break; }
        const result = await queryGraph(brain, entity, llmConfig);
        if (result) {
          console.log(formatQueryResult(result));
        } else {
          console.log(`Entity not found: ${entity}`);
        }
      } else {
        const graph = await buildKnowledgeGraph(brain, llmConfig);
        console.log(formatGraph(graph));
      }
      await brain.disconnect();
      break;
    }

    case 'digest': {
      const periodResult = extractFlag(args, '--period', 'weekly');
      const period = periodResult.value as 'daily' | 'weekly' | 'monthly';
      const brain = await getBrain(brainName);
      const config = loadConfig(brainName);

      const digest = await generateDigest(brain, {
        period,
        provider: config.llm_provider ?? config.embedding_provider,
        model: config.llm_model,
        apiKey: config.api_key,
      });
      console.log(formatDigest(digest));
      await brain.disconnect();
      break;
    }

    case 'share': {
      const target = args[1];
      const userResult = extractFlag(args, '--with', '');
      const permResult = extractFlag(args.slice(0), '--permission', 'read');

      if (!target || !userResult.value) {
        console.error('Usage: deepbrain share <brain> --with <user> [--permission read|write|admin]');
        break;
      }

      const brainDir = getBrainDir(target);
      const manifest = shareBrain(brainDir, userResult.value, permResult.value as any);
      console.log(formatSharedList(manifest));
      break;
    }

    case 'unshare': {
      const target = args[1];
      const user = args[2];
      if (!target || !user) {
        console.error('Usage: deepbrain unshare <brain> <user>');
        break;
      }
      const brainDir = getBrainDir(target);
      const manifest = unshareBrain(brainDir, user);
      console.log(`✅ Revoked access for ${user}`);
      console.log(formatSharedList(manifest));
      break;
    }

    case 'merge': {
      const brain1Name = args[1];
      const brain2Name = args[2];
      if (!brain1Name || !brain2Name) {
        console.error('Usage: deepbrain merge <source-brain> <target-brain> [--overwrite]');
        break;
      }
      const overwriteResult = hasFlag(args, '--overwrite');
      const dryRunResult = hasFlag(args, '--dry-run');

      const source = await getBrain(brain1Name);
      const target = await getBrain(brain2Name);
      const result = await mergeBrains(source, target, {
        overwrite: overwriteResult.present,
        dryRun: dryRunResult.present,
      });
      console.log(formatMergeResult(result));
      if (dryRunResult.present) console.log('\n   (dry run — no changes made)');
      await source.disconnect();
      await target.disconnect();
      break;
    }

    case 'serve':
    case 'server': {
      const portResult = extractFlag(args, '--port', '3333');
      const hostResult = extractFlag(args, '--host', '127.0.0.1');
      const config = loadConfig(brainName);

      await startServer({
        port: parseInt(portResult.value),
        host: hostResult.value,
        brainConfig: config,
        llmConfig: { provider: config.llm_provider ?? config.embedding_provider, model: config.llm_model, apiKey: config.api_key },
      });
      break;
    }

    case 'plugin': {
      const sub = args[1];
      const pluginsDir = join(getBrainDir(brainName), 'plugins');
      const registry = new PluginRegistry(pluginsDir);

      if (sub === 'list') {
        console.log(formatPluginList(registry.list()));
      } else if (sub === 'add') {
        const name = args[2];
        const typeResult = extractFlag(args, '--type', 'importer');
        if (!name) { console.error('Usage: deepbrain plugin add <name> --type <type>'); break; }
        const template = PluginRegistry.createTemplate(name, typeResult.value as any);
        registry.add(name, template.manifest, template.code);
        console.log(`✅ Plugin "${name}" created at ${pluginsDir}/${name}/`);
        console.log(`   Edit ${pluginsDir}/${name}/${template.manifest.entry} to implement.`);
      } else if (sub === 'remove') {
        const name = args[2];
        if (!name) { console.error('Usage: deepbrain plugin remove <name>'); break; }
        if (registry.remove(name)) {
          console.log(`✅ Plugin "${name}" removed.`);
        } else {
          console.log(`Plugin not found: ${name}`);
        }
      } else {
        console.error('Usage: deepbrain plugin [list|add|remove]');
      }
      break;
    }

    default:
      console.log(`
🧠 DeepBrain — Personal AI Brain

Commands:
  deepbrain init [provider]              Initialize (default: ollama)
  deepbrain put <slug> [file]            Add/update a page (auto-summarizes)
  deepbrain get <slug>                   Read a page
  deepbrain query "text"                 Semantic search (hybrid)
  deepbrain search "keyword"             Keyword search
  deepbrain chat "question"              Chat with your brain (RAG)
  deepbrain link <from> <to>             Create a link between pages
  deepbrain timeline <slug> "text"       Add timeline entry
  deepbrain stats                        Brain statistics
  deepbrain list [--type X]              List pages
  deepbrain list-brains                  List all brains
  deepbrain dream                        Run Dream Cycle (maintenance)
  deepbrain op "MERGE topic:AI topic:ML" Memory operation DSL
  deepbrain inject "preparing for..."    Proactive memory injection
  deepbrain tiers [stats|cycle|core]     Memory tier management
  deepbrain temporal <slug>              Knowledge evolution timeline
  deepbrain compress [slug]              Compress old memories
  deepbrain graph                        Knowledge graph visualization
  deepbrain graph query "AI"             Query entity relationships
  deepbrain digest --period weekly       Smart knowledge digest
  deepbrain share <brain> --with <user>  Share a brain
  deepbrain merge <brain1> <brain2>      Merge two brains
  deepbrain serve [--port 3333]          Start REST API server
  deepbrain plugin list|add|remove       Manage plugins

Flags:
  --brain <name>                         Use a named brain (default: "default")
  --no-summary                           Skip auto-summary on put
  --provider <provider>                  LLM provider for chat
  --model <model>                        LLM model for chat

Providers: ${AVAILABLE_PROVIDERS.join(', ')}
Docs: https://github.com/Magicray1217/deepbrain
      `);
  }
}

main().catch(e => {
  const msg = e.message ?? String(e);

  // Better error messages for common issues
  if (msg.includes('Missing credentials') || msg.includes('API key') || msg.includes('apiKey')) {
    console.error(`\n❌ Missing credentials!\n`);
    console.error(`   Run 'deepbrain init <provider>' first, or set the appropriate API key.\n`);
    console.error(`   Available providers:`);
    for (const p of AVAILABLE_PROVIDERS) {
      const envKey = ENV_KEYS[p];
      console.error(`     ${p.padEnd(12)} ${envKey ? `(env: ${envKey})` : '(no key needed)'}`);
    }
    console.error('');
  } else if (msg.includes('deepbrain.json') || msg.includes('ENOENT')) {
    console.error(`\n❌ Brain not initialized!\n`);
    console.error(`   Run 'deepbrain init <provider>' to create a brain first.\n`);
  } else {
    console.error('Error:', msg);
  }
  process.exit(1);
});
