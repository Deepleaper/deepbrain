#!/usr/bin/env node

/**
 * DeepBrain - CLI
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
 *   deepbrain retag                    Re-tag all pages with LLM
 *   deepbrain web [--port 3000]        Start interactive Web UI
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { Brain } from './core/brain.js';
import type { DeepBrainConfig } from './core/types.js';
import { dream } from './dream/index.js';
import { chatWithBrain, chatWithBrains, interactiveChat } from './commands/chat.js';
import { runDoctor, formatDoctorResult } from './commands/doctor.js';
import { generateFlashcards, getDueCards, reviewCard, getFlashcardStats, sm2, type ReviewGrade } from './flashcards.js';
import { generateDigestEmail, type DigestEmailConfig } from './digest-email.js';
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
import { initI18n, t, getLocale } from './i18n.js';
import { fireWebhook, loadWebhookConfig } from './webhooks.js';
import { retagAll, loadAutoTagConfig } from './auto-tag.js';
import { startWebUI } from './web/index.js';
import { syncNotion } from './sync/notion-sync.js';
import { watchObsidianVault } from './sync/obsidian-watcher.js';
import { findConnections, formatConnections } from './connections.js';
import { backupBrain, restoreBrain } from './backup.js';
import { AgentBrain } from './agent-brain.js';
import { applyTemplate, listTemplates, TEMPLATES } from './templates.js';
import { importGitHubRepo, importGitHubStars } from './import/github.js';
import { importYouTube } from './import/youtube.js';
import { importNotion } from './import/notion.js';
import { importObsidian } from './import/obsidian.js';
import { importYuque } from './import/yuque.js';
import type { ImportedPage } from './import/yuque.js';
import { importFeishu } from './import/feishu.js';
import { importShimo } from './import/shimo.js';
import { importWechat } from './import/wechat.js';
import { importWechatArticle } from './import/wechat-article.js';
import { importEbook } from './import/ebook.js';
import { importEvernote } from './import/evernote.js';
import { importRoam } from './import/roam.js';
import { importLogseq } from './import/logseq.js';
import { importBear } from './import/bear.js';
import { importGoogleKeep } from './import/google-keep.js';
import { importOneNote } from './import/onenote.js';
import { importJoplin } from './import/joplin.js';
import { importReadwise } from './import/readwise.js';
import { importDayOne } from './import/dayone.js';
import { importAppleNotes } from './import/apple-notes.js';
import { importFlomo } from './import/flomo.js';
import { importWolai } from './import/wolai.js';
import { importFlowUs } from './import/flowus.js';
import { importSiyuan } from './import/siyuan.js';
import { addFeed, removeFeed, listFeeds, syncRssFeeds } from './sync/rss.js';
import { serveSharedBrain, exportStaticSite } from './collab.js';

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

// ── Import helper ────────────────────────────────────────────────

async function saveImportedPages(brain: Brain, pages: ImportedPage[]): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;
  for (const page of pages) {
    try {
      await brain.put(page.slug, {
        type: (page.metadata.type as string) ?? 'note',
        title: page.title,
        compiled_truth: page.body,
        frontmatter: page.metadata,
      });
      for (const tag of page.tags) {
        await brain.tag(page.slug, tag);
      }
      imported++;
    } catch {
      skipped++;
    }
  }
  return { imported, skipped };
}

// ── Auto-summary helper ─────────────────────────────────────────

async function generateSummaryAndTags(
  content: string,
  config: Partial<DeepBrainConfig>,
): Promise<{ summary: string; tags: string[] }> {
  const chat = createChat({
    provider: (config.llm_provider ?? config.embedding_provider ?? 'ollama') as any,
    model: config.llm_model,
    apiKey: config.llm_api_key ?? config.api_key,
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

  // Initialize i18n
  const langResult = extractFlag(args, '--lang', '');
  args = langResult.args;
  initI18n(langResult.value as any || undefined);

  // Extract --brain flag (applies to all commands)
  const brainResult = extractFlag(args, '--brain', 'default');
  const brainName = brainResult.value;
  args = brainResult.args;

  const command = args[0];

  switch (command) {
    case 'init': {
      const templateResult = extractFlag(args, '--template', '');
      args = templateResult.args;
      const checkResult = hasFlag(args, '--check');
      args = checkResult.args;
      const llmProviderResult = extractFlag(args, '--llm-provider', '');
      args = llmProviderResult.args;

      // Provider descriptions
      const providerInfo: Record<string, { desc: string; pricing: string }> = {
        ollama: { desc: 'Local models, no API key needed', pricing: 'Free (runs locally)' },
        openai: { desc: 'GPT-4o, text-embedding-3-small', pricing: '~$0.02/1M tokens' },
        gemini: { desc: 'Gemini Pro, embedding-001', pricing: 'Free tier available' },
        deepseek: { desc: 'DeepSeek-V3, fast & affordable', pricing: '~$0.14/1M tokens' },
        dashscope: { desc: 'Qwen (通义千问), great for Chinese', pricing: '¥0.0008/1K tokens' },
        zhipu: { desc: 'GLM-4 (智谱), Chinese-optimized', pricing: '¥0.001/1K tokens' },
        moonshot: { desc: 'Kimi (月之暗面), long context', pricing: '¥0.012/1K tokens' },
      };

      // --check: validate current config
      if (checkResult.present) {
        console.log('\n🔍 Checking DeepBrain configuration...\n');
        const configFile = getConfigFile(brainName);
        if (!existsSync(configFile)) {
          console.error(`❌ No config found at ${configFile}`);
          console.error(`   Run 'deepbrain init [provider]' first.\n`);
          break;
        }
        const existingConfig = loadConfig(brainName);
        console.log(`   Config:   ${configFile} ✅`);
        console.log(`   Provider: ${existingConfig.embedding_provider ?? 'not set'}`);
        console.log(`   API Key:  ${existingConfig.api_key ? '✅ configured' : '⚠️  not set'}`);

        // Test embedding connection
        try {
          const brain = await getBrain(brainName);
          const stats = await brain.stats();
          console.log(`   Database: ✅ connected (${stats.page_count} pages, ${stats.chunk_count} chunks)`);
          await brain.disconnect();
        } catch (e: any) {
          console.error(`   Database: ❌ ${e.message}`);
        }

        // Check env vars
        const detectedEnvKeys: string[] = [];
        for (const [prov, envK] of Object.entries(ENV_KEYS)) {
          if (process.env[envK]) detectedEnvKeys.push(`${prov} (${envK})`);
        }
        if (detectedEnvKeys.length > 0) {
          console.log(`\n   🔑 API keys found in environment:`);
          for (const k of detectedEnvKeys) console.log(`      ${k}`);
        }
        console.log('');
        break;
      }

      // Interactive provider selection if no provider argument given
      let embeddingProvider = args[1] ?? '';
      if (!embeddingProvider) {
        // Auto-detect available API keys from env
        const detectedProviders: string[] = [];
        for (const [prov, envK] of Object.entries(ENV_KEYS)) {
          if (process.env[envK]) detectedProviders.push(prov);
        }

        console.log('\n🧠 Welcome to DeepBrain!\n');
        console.log('   Select an embedding provider:\n');
        for (let i = 0; i < AVAILABLE_PROVIDERS.length; i++) {
          const p = AVAILABLE_PROVIDERS[i];
          const info = providerInfo[p] ?? { desc: 'Custom', pricing: '' };
          const envK = ENV_KEYS[p];
          const detected = envK && process.env[envK] ? ' 🔑' : '';
          console.log(`   ${i + 1}) ${p.padEnd(12)} ${info.desc}${detected}`);
        }

        if (detectedProviders.length > 0) {
          console.log(`\n   🔑 = API key detected in environment`);
        }

        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise<string>(resolve => {
          rl.question(`\n   Choose [1-${AVAILABLE_PROVIDERS.length}] (default: 1 = ollama): `, resolve);
        });
        rl.close();

        const choice = parseInt(answer.trim()) || 1;
        embeddingProvider = AVAILABLE_PROVIDERS[Math.max(0, Math.min(choice - 1, AVAILABLE_PROVIDERS.length - 1))];
      }

      const llmProvider = llmProviderResult.value || undefined;
      const mixedMode = llmProvider && llmProvider !== embeddingProvider;

      const brainDir = getBrainDir(brainName);
      const dataDir = join(brainDir, 'brain');
      const dbDir = join(brainDir, 'data');

      const config: Partial<DeepBrainConfig> = {
        engine: 'pglite',
        database: dbDir,
        embedding_provider: embeddingProvider,
        data_dir: dataDir,
      };

      if (llmProvider) {
        config.llm_provider = llmProvider;
      }

      // Auto-detect API keys from env
      const embeddingEnvKey = ENV_KEYS[embeddingProvider];
      if (embeddingEnvKey && process.env[embeddingEnvKey]) {
        if (mixedMode) {
          config.embedding_api_key = process.env[embeddingEnvKey];
          console.log(`\n🔑 Auto-detected embedding API key from ${embeddingEnvKey}`);
        } else {
          config.api_key = process.env[embeddingEnvKey];
          console.log(`\n🔑 Auto-detected API key from ${embeddingEnvKey}`);
        }
      }

      if (mixedMode && llmProvider) {
        const llmEnvKey = ENV_KEYS[llmProvider];
        if (llmEnvKey && process.env[llmEnvKey]) {
          config.llm_api_key = process.env[llmEnvKey];
          console.log(`🔑 Auto-detected LLM API key from ${llmEnvKey}`);
        }
      }

      try {
        mkdirSync(brainDir, { recursive: true });
        mkdirSync(dataDir, { recursive: true });
        mkdirSync(dbDir, { recursive: true });
      } catch (e: any) {
        console.error(`\n❌ Failed to create directories: ${e.message}`);
        console.error(`   Check permissions for: ${brainDir}`);
        break;
      }

      const configFile = join(brainDir, 'deepbrain.json');
      try {
        writeFileSync(configFile, JSON.stringify(config, null, 2));
      } catch (e: any) {
        console.error(`\n❌ Failed to write config: ${e.message}`);
        break;
      }

      // Also write root config for backward compat if default brain
      if (brainName === 'default') {
        const rootConfig = { ...config, database: './deepbrain-data', data_dir: './brain' };
        writeFileSync('deepbrain.json', JSON.stringify(rootConfig, null, 2));
        mkdirSync('./brain', { recursive: true });
        mkdirSync('./deepbrain-data', { recursive: true });
      }

      const embInfo = providerInfo[embeddingProvider] ?? { desc: 'Custom provider', pricing: 'varies' };
      console.log(`\n🧠 DeepBrain initialized!`);
      console.log(`   Brain:             ${brainName}`);
      if (mixedMode) {
        const llmInfo = providerInfo[llmProvider!] ?? { desc: 'Custom provider', pricing: 'varies' };
        console.log(`   Embedding:         ${embeddingProvider} — ${embInfo.desc}`);
        console.log(`   LLM:               ${llmProvider} — ${llmInfo.desc}`);
      } else {
        console.log(`   Provider:          ${embeddingProvider} — ${embInfo.desc}`);
        console.log(`   Pricing:           ${embInfo.pricing}`);
      }
      console.log(`   Config:            ${configFile}`);
      console.log(`   Data:              ${dbDir}`);

      // Apply template if specified
      if (templateResult.value) {
        try {
          const brain = await getBrain(brainName);
          const result = await applyTemplate(brain, templateResult.value);
          console.log(`\n📋 Template "${templateResult.value}" applied!`);
          console.log(`   Pages: ${result.pages}, Links: ${result.links}, Tags: ${result.tags}`);
          await brain.disconnect();
        } catch (e: any) {
          console.error(`\n⚠️  Template error: ${e.message}`);
          console.log(`   Available templates: ${Object.keys(TEMPLATES).join(', ')}`);
        }
      }

      // Welcome message with quick-start tips
      const embeddingKeyOk = !!(config.embedding_api_key ?? config.api_key) || embeddingProvider === 'ollama';
      const llmKeyOk = !mixedMode || !!(config.llm_api_key ?? config.api_key) || llmProvider === 'ollama';
      console.log(`\n${'─'.repeat(50)}`);
      console.log(`🎉 Welcome to DeepBrain — Your Personal AI Brain!`);
      console.log(`${'─'.repeat(50)}`);
      console.log(`\n📋 Quick Start:`);
      if (mixedMode) {
        const llmEnvKey = ENV_KEYS[llmProvider!] ?? '';
        console.log(`   ${embeddingKeyOk ? '✅' : '⬜'} Embedding API key${!embeddingKeyOk && embeddingEnvKey ? ` (set ${embeddingEnvKey})` : ''}`);
        console.log(`   ${llmKeyOk ? '✅' : '⬜'} LLM API key${!llmKeyOk && llmEnvKey ? ` (set ${llmEnvKey})` : ''}`);
      } else {
        const hasKey = !!(config.api_key) || embeddingProvider === 'ollama';
        console.log(`   ${hasKey ? '✅' : '⬜'} API key configured${!hasKey && embeddingEnvKey ? ` (set ${embeddingEnvKey})` : ''}`);
      }
      console.log(`\n   1. Add your first note:`);
      console.log(`      $ deepbrain put my-note notes.md`);
      console.log(`      $ echo "Hello World" | deepbrain put hello`);
      console.log(`\n   2. Search your brain:`);
      console.log(`      $ deepbrain query "something"`);
      console.log(`\n   3. Chat with your brain:`);
      console.log(`      $ deepbrain chat "what do I know about X?"`);
      console.log(`      $ deepbrain chat -i  # interactive mode`);
      console.log(`\n   4. Import from external sources:`);
      console.log(`      $ deepbrain import github --repo owner/repo`);
      console.log(`      $ deepbrain sync rss --add https://...`);
      console.log(`\n   5. Check health anytime:`);
      console.log(`      $ deepbrain init --check`);
      console.log(`      $ deepbrain doctor`);

      if ((!config.api_key && !config.embedding_api_key) && embeddingProvider !== 'ollama') {
        console.log(`\n💡 Available providers & pricing:`);
        for (const [p, pi] of Object.entries(providerInfo)) {
          const envK = ENV_KEYS[p] ?? '';
          console.log(`   ${p.padEnd(12)} ${pi.desc.padEnd(40)} ${pi.pricing}${envK ? `  (env: ${envK})` : ''}`);
        }
      }
      console.log('');
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
          console.log(`  📄 ${r.slug} (${r.type}) - score: ${r.score.toFixed(4)}`);
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
            console.log(`  📄 ${r.slug} (${r.type}) - score: ${r.score.toFixed(4)}`);
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
      const brainsResult = extractFlag(args, '--brains', '');
      args = brainsResult.args;
      const sessionResult = extractFlag(args, '--session', '');
      args = sessionResult.args;
      const interactiveResult = hasFlag(args, '-i');
      args = interactiveResult.args;

      const question = args.slice(1).join(' ');
      
      const config = loadConfig(brainName);
      const chatOpts = {
        provider: providerResult.value || config.llm_provider || config.embedding_provider,
        model: modelResult.value || config.llm_model || undefined,
        apiKey: config.llm_api_key ?? config.api_key,
      };

      // Interactive mode: no question needed
      if (interactiveResult.present || !question) {
        const brains: Array<{ brain: any; name: string }> = [];
        if (brainsResult.value) {
          const brainNames = brainsResult.value.split(',').map(s => s.trim());
          for (const name of brainNames) brains.push({ brain: await getBrain(name), name });
        } else {
          brains.push({ brain: await getBrain(brainName), name: brainName });
        }
        await interactiveChat(brains, { ...chatOpts, sessionId: sessionResult.value || undefined });
        for (const { brain } of brains) await brain.disconnect();
        break;
      }

      if (brainsResult.value) {
        // Multi-brain chat
        const brainNames = brainsResult.value.split(',').map(s => s.trim());
        const brains: Array<{ brain: any; name: string }> = [];
        for (const name of brainNames) {
          brains.push({ brain: await getBrain(name), name });
        }
        console.log(`🧠 Chatting across ${brains.length} brains: ${brainNames.join(', ')}`);
        await chatWithBrains(brains, question, chatOpts);
        for (const { brain } of brains) await brain.disconnect();
      } else {
        // Single brain chat
        const brain = await getBrain(brainName);
        await chatWithBrain(brain, question, chatOpts);
        await brain.disconnect();
      }
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

    case 'evolve': {
      const brain = await getBrain(brainName);
      const { AgentBrain } = await import('./agent-brain.js');
      const agentBrain = new AgentBrain(brain, 'cli');
      const dryRun = args.includes('--dry-run');
      const strategyIdx = args.indexOf('--strategy');
      const strategy = strategyIdx >= 0 ? (args[strategyIdx + 1] as 'merge' | 'summarize' | 'extract') : 'merge';
      const minIdx = args.indexOf('--min-traces');
      const minTraces = minIdx >= 0 ? parseInt(args[minIdx + 1], 10) : 5;
      const threshIdx = args.indexOf('--threshold');
      const topicThreshold = threshIdx >= 0 ? parseFloat(args[threshIdx + 1]) : 0.2;

      console.log(`\n🧬 Evolving knowledge (strategy=${strategy}, minTraces=${minTraces}, dryRun=${dryRun})...\n`);
      const result = await agentBrain.evolve({ strategy, minTraces, dryRun, topicThreshold });
      console.log(`✅ Evolve complete`);
      console.log(`   Traces processed: ${result.tracesProcessed}`);
      console.log(`   Pages created: ${result.pagesCreated}`);
      console.log(`   Clusters: ${result.clusters.length}`);
      for (const c of result.clusters) {
        console.log(`     📚 ${c.topic}: ${c.traceCount} traces → ${c.outputPage}`);
      }
      if (dryRun) console.log(`   (dry run — no changes written)`);
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
      const llmConfig = { provider: config.llm_provider ?? config.embedding_provider, model: config.llm_model, apiKey: config.llm_api_key ?? config.api_key };

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
        apiKey: config.llm_api_key ?? config.api_key,
      });
      console.log(formatDigest(digest));
      await brain.disconnect();
      break;
    }

    case 'share-with': {
      const target = args[1];
      const userResult = extractFlag(args, '--with', '');
      const permResult = extractFlag(args.slice(0), '--permission', 'read');

      if (!target || !userResult.value) {
        console.error('Usage: deepbrain share-with <brain> --with <user> [--permission read|write|admin]');
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
      if (dryRunResult.present) console.log('\n   (dry run - no changes made)');
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
        llmConfig: { provider: config.llm_provider ?? config.embedding_provider, model: config.llm_model, apiKey: config.llm_api_key ?? config.api_key },
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

    case 'retag': {
      const brain = await getBrain(brainName);
      const config = loadConfig(brainName);
      const tagConfig = loadAutoTagConfig(config as Record<string, unknown>);
      tagConfig.enabled = true; // Force enable for retag command

      console.log(t('retag.start'));
      const results = await retagAll(brain, tagConfig, (slug, tags) => {
        console.log(t('retag.page', { slug, tags: tags.join(', ') }));
      });
      const tagged = results.filter(r => !r.skipped).length;
      console.log(t('retag.done', { count: String(tagged) }));
      await brain.disconnect();
      break;
    }

    case 'watch': {
      const vaultPath = args[1];
      if (!vaultPath) { console.error('Usage: deepbrain watch <vault-path>'); break; }

      const brain = await getBrain(brainName);
      console.log(`👁️  Watching Obsidian vault: ${resolve(vaultPath)}`);
      console.log('   Press Ctrl+C to stop.\n');

      const watcher = watchObsidianVault(brain, resolve(vaultPath), {
        onImport: (file, slug) => console.log(`  ✅ ${file} → ${slug}`),
        onError: (file, error) => console.log(`  ⚠️ ${file}: ${error}`),
      });

      // Keep process alive
      process.on('SIGINT', async () => {
        console.log(`\n\n📊 Imported ${watcher.importCount} files.`);
        watcher.stop();
        await brain.disconnect();
        process.exit(0);
      });

      // Prevent exit
      await new Promise(() => {}); // Wait forever
      break;
    }

    case 'related': {
      const slug = args[1];
      if (!slug) { console.error('Usage: deepbrain related <slug>'); break; }
      const brain = await getBrain(brainName);
      const result = await findConnections(brain, slug);
      if (result) {
        console.log(formatConnections(result));
      } else {
        console.log(`Page not found: ${slug}`);
      }
      await brain.disconnect();
      break;
    }

    case 'flashcards': {
      const sub = args[1];
      const config = loadConfig(brainName);
      const brain = await getBrain(brainName);
      const dataDir = config.data_dir ?? './brain';

      if (sub === 'generate') {
        const slugs = args.slice(2).filter(s => !s.startsWith('--'));
        console.log('\n🎴 Generating flashcards...\n');
        const newCards = await generateFlashcards(brain, dataDir, {
          provider: config.llm_provider || config.embedding_provider,
          model: config.llm_model,
          apiKey: config.llm_api_key ?? config.api_key,
          slugs: slugs.length > 0 ? slugs : undefined,
        });
        console.log(`\n✅ Generated ${newCards.length} new flashcards`);
      } else if (sub === 'review') {
        const due = getDueCards(dataDir);
        if (due.length === 0) {
          console.log('\n🎉 No cards due for review! Come back later.\n');
        } else {
          console.log(`\n🎴 ${due.length} cards due for review\n`);
          // In CLI, just show cards. Interactive review needs readline or web UI.
          for (const card of due.slice(0, 10)) {
            console.log(`  ❓ ${card.question}`);
            console.log(`  💡 ${card.answer}`);
            console.log(`     (slug: ${card.slug}, ease: ${card.easiness.toFixed(2)}, interval: ${card.interval}d)\n`);
          }
          if (due.length > 10) console.log(`  ... and ${due.length - 10} more. Use the Web UI for interactive review.\n`);
        }
      } else if (sub === 'stats') {
        const stats = getFlashcardStats(dataDir);
        console.log(`\n🎴 Flashcard Stats`);
        console.log(`   Total: ${stats.total}`);
        console.log(`   Due today: ${stats.dueToday}`);
        console.log(`   Mastered: ${stats.mastered}`);
        console.log(`   Learning: ${stats.learning}`);
        console.log(`   New: ${stats.newCards}`);
        console.log(`   Avg Easiness: ${stats.avgEasiness.toFixed(2)}\n`);
      } else {
        console.log('Usage: deepbrain flashcards <generate|review|stats> [slugs...]');
      }
      await brain.disconnect();
      break;
    }

    case 'digest-email': {
      const toResult = extractFlag(args, '--to', '');
      args = toResult.args;
      const periodResult = extractFlag(args, '--period', 'daily');
      args = periodResult.args;
      const webhookResult = extractFlag(args, '--webhook', '');
      args = webhookResult.args;

      const config = loadConfig(brainName);
      const brain = await getBrain(brainName);

      const emailConfig: DigestEmailConfig = {
        period: periodResult.value === 'weekly' ? 'weekly' : 'daily',
        to: toResult.value,
        provider: config.llm_provider || config.embedding_provider,
        model: config.llm_model,
        apiKey: config.llm_api_key ?? config.api_key,
        webhookUrl: webhookResult.value || undefined,
        smtp: (config as any).smtp,
      };

      console.log(`\n📧 Generating ${emailConfig.period} digest email...\n`);
      const result = await generateDigestEmail(brain, emailConfig);
      console.log(`   Pages: ${result.pages.length}`);
      console.log(`   Delivered: ${result.delivered} (${result.method})`);
      if (result.pages.length > 0) {
        console.log('   Recent pages:');
        for (const p of result.pages.slice(0, 5)) {
          console.log(`     📄 ${p.title} (${p.updated_at.toISOString().split('T')[0]})`);
        }
      }
      console.log('');
      await brain.disconnect();
      break;
    }

    case 'web': {
      const portResult = extractFlag(args, '--port', '3000');
      const hostResult = extractFlag(args, '--host', '0.0.0.0');
      const config = loadConfig(brainName);
      const webhookConfig = loadWebhookConfig(config as Record<string, unknown>);

      await startWebUI({
        port: parseInt(portResult.value),
        host: hostResult.value,
        brainConfig: config,
        locale: getLocale() as any,
        webhookConfig,
      });
      break;
    }

    // ── v1.4.0 Commands ──────────────────────────────────────────

    case 'backup': {
      const outputResult = extractFlag(args, '--output', '');
      args = outputResult.args;
      const brain = await getBrain(brainName);
      console.log('\n📦 Creating backup...\n');
      const result = await backupBrain(brain, outputResult.value || undefined);
      console.log(`✅ Backup created: ${result.file}`);
      console.log(`   Pages: ${result.manifest.page_count}`);
      console.log(`   Links: ${result.manifest.link_count}`);
      console.log(`   Tags: ${result.manifest.tag_count}`);
      console.log(`   Timeline entries: ${result.manifest.timeline_count}\n`);
      await brain.disconnect();
      break;
    }

    case 'restore': {
      const file = args[1];
      if (!file) { console.error('Usage: deepbrain restore <file.zip>'); break; }
      const brain = await getBrain(brainName);
      console.log(`\n📦 Restoring from ${file}...\n`);
      const result = await restoreBrain(brain, file);
      console.log(`✅ Restore complete`);
      console.log(`   Pages: ${result.pages_restored}`);
      console.log(`   Links: ${result.links_restored}`);
      console.log(`   Tags: ${result.tags_restored}`);
      console.log(`   Timeline: ${result.timeline_restored}`);
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.length}`);
        result.errors.slice(0, 5).forEach(e => console.log(`     ⚠️ ${e}`));
      }
      console.log('');
      await brain.disconnect();
      break;
    }

    case 'templates': {
      console.log('\n📋 Available Brain Templates:\n');
      for (const t of listTemplates()) {
        console.log(`  ${t.name.padEnd(15)} ${t.description}`);
      }
      console.log(`\n  Usage: deepbrain init --template <name> [provider]\n`);
      break;
    }

    case 'mcp': {
      // Start MCP server (delegates to mcp.ts via import)
      console.error('🧠 Starting DeepBrain MCP Server...');
      const { main: mcpMain } = await import('./mcp.js') as any;
      // mcp.ts runs main() at top level, so just importing it starts it
      // But since we're in the CLI, we need to handle it differently
      // The MCP server is meant to be run directly: deepbrain-mcp or node dist/mcp.js
      console.error('ℹ️  MCP server runs via: deepbrain-mcp (or node dist/mcp.js)');
      console.error('   Configure in Claude Desktop / Cursor as:');
      console.error('   { "command": "deepbrain-mcp", "args": [] }');
      break;
    }

    case 'batch-import': {
      const dir = args[1];
      if (!dir) { console.error('Usage: deepbrain batch-import <directory> [--type note]'); break; }
      const typeResult = extractFlag(args, '--type', 'note');

      const brain = await getBrain(brainName);
      const { readdirSync, readFileSync, statSync } = await import('node:fs');
      const { join, basename } = await import('node:path');

      const files = readdirSync(dir).filter(f => f.endsWith('.md') || f.endsWith('.txt'));
      if (files.length === 0) { console.error('No .md or .txt files found'); break; }

      console.log(`\n📥 Batch importing ${files.length} files...\n`);

      const inputs = files.map(f => {
        const content = readFileSync(join(dir, f), 'utf8');
        const slug = basename(f).replace(/\.(md|txt)$/, '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-');
        return { slug, input: { type: typeResult.value, title: basename(f).replace(/\.\w+$/, ''), compiled_truth: content } };
      });

      const pages = await brain.putBatch(inputs);
      console.log(`✅ Imported ${pages.length} pages (batch embedded)\n`);
      await brain.disconnect();
      break;
    }

    // 🆕 v1.5.0 Commands ──────────────────────────────────────

    case 'import': {
      const sub = args[1];

      if (sub === 'github') {
        const repoResult = extractFlag(args, '--repo', '');
        args = repoResult.args;
        const tokenResult = extractFlag(args, '--token', process.env.GITHUB_TOKEN ?? '');
        args = tokenResult.args;

        if (!repoResult.value) { console.error('Usage: deepbrain import github --repo owner/repo [--token TOKEN]'); break; }

        const brain = await getBrain(brainName);
        const result = await importGitHubRepo(brain, {
          repo: repoResult.value,
          token: tokenResult.value || undefined,
          onProgress: console.log,
        });
        console.log(`\n✅ GitHub import: ${result.imported} pages imported, ${result.skipped} skipped`);
        if (result.errors.length > 0) result.errors.forEach(e => console.log(`  ❌ ${e}`));
        await brain.disconnect();

      } else if (sub === 'github-stars') {
        const userResult = extractFlag(args, '--user', '');
        args = userResult.args;
        const limitResult = extractFlag(args, '--limit', '100');
        args = limitResult.args;
        const tokenResult = extractFlag(args, '--token', process.env.GITHUB_TOKEN ?? '');
        args = tokenResult.args;

        if (!userResult.value) { console.error('Usage: deepbrain import github-stars --user <username> [--limit 100] [--token TOKEN]'); break; }

        const brain = await getBrain(brainName);
        const result = await importGitHubStars(brain, {
          user: userResult.value,
          limit: parseInt(limitResult.value),
          token: tokenResult.value || undefined,
          onProgress: console.log,
        });
        console.log(`\n✅ Stars import: ${result.imported} repos imported`);
        if (result.errors.length > 0) result.errors.forEach(e => console.log(`  ❌ ${e}`));
        await brain.disconnect();

      } else if (sub === 'youtube') {
        const url = args[2];
        if (!url) { console.error('Usage: deepbrain import youtube <url>'); break; }

        const config = loadConfig(brainName);
        const brain = await getBrain(brainName);
        const result = await importYouTube(brain, {
          url,
          summarize: true,
          provider: config.llm_provider ?? config.embedding_provider,
          model: config.llm_model,
          apiKey: config.llm_api_key ?? config.api_key,
          onProgress: console.log,
        });
        console.log(`\n✅ YouTube imported: "${result.title}" (${result.transcript_length} chars)`);
        await brain.disconnect();

      } else if (sub === 'notion') {
        const pathArg = args[2];
        if (!pathArg) { console.error('Usage: deepbrain import notion <path> [--prefix notion/]'); break; }
        const prefixResult = extractFlag(args, '--prefix', '');
        args = prefixResult.args;
        const brain = await getBrain(brainName);
        console.log('📥 Importing from Notion...');
        const result = await importNotion(brain, pathArg, {
          prefix: prefixResult.value || undefined,
          onProgress: (i, t, f) => process.stdout.write(`  [${i}/${t}] ${f}\r`),
        });
        console.log(`\n✅ Notion import: ${result.imported} imported, ${result.skipped} skipped`);
        if (result.errors.length > 0) result.errors.forEach(e => console.log(`  ❌ ${e.file}: ${e.error}`));
        await brain.disconnect();

      } else if (sub === 'obsidian') {
        const vaultPath = args[2];
        if (!vaultPath) { console.error('Usage: deepbrain import obsidian <vault-path> [--prefix obsidian/]'); break; }
        const prefixResult = extractFlag(args, '--prefix', '');
        args = prefixResult.args;
        const brain = await getBrain(brainName);
        console.log('📥 Importing Obsidian vault...');
        const result = await importObsidian(brain, vaultPath, {
          prefix: prefixResult.value || undefined,
          onProgress: (i, t, f) => process.stdout.write(`  [${i}/${t}] ${f}\r`),
        });
        console.log(`\n✅ Obsidian import: ${result.imported} imported, ${result.skipped} skipped`);
        if (result.errors.length > 0) result.errors.forEach(e => console.log(`  ❌ ${e.file}: ${e.error}`));
        await brain.disconnect();

      } else if (sub === 'yuque') {
        const dir = args[2];
        if (!dir) { console.error('Usage: deepbrain import yuque <dir>'); break; }
        const brain = await getBrain(brainName);
        console.log('📥 Importing from Yuque (语雀)...');
        const pages = await importYuque({ dir, onProgress: (i, t, f) => process.stdout.write(`  [${i}/${t}] ${f}\r`) });
        const { imported, skipped } = await saveImportedPages(brain, pages);
        console.log(`\n✅ Yuque import: ${imported} imported, ${skipped} skipped`);
        await brain.disconnect();

      } else if (sub === 'feishu') {
        const dir = args[2];
        if (!dir) { console.error('Usage: deepbrain import feishu <dir>'); break; }
        const brain = await getBrain(brainName);
        console.log('📥 Importing from Feishu / Lark (飞书)...');
        const pages = await importFeishu({ dir, onProgress: (i, t, f) => process.stdout.write(`  [${i}/${t}] ${f}\r`) });
        const { imported, skipped } = await saveImportedPages(brain, pages);
        console.log(`\n✅ Feishu import: ${imported} imported, ${skipped} skipped`);
        await brain.disconnect();

      } else if (sub === 'shimo') {
        const dir = args[2];
        if (!dir) { console.error('Usage: deepbrain import shimo <dir>'); break; }
        const brain = await getBrain(brainName);
        console.log('📥 Importing from Shimo (石墨文档)...');
        const pages = await importShimo({ dir, onProgress: (i, t, f) => process.stdout.write(`  [${i}/${t}] ${f}\r`) });
        const { imported, skipped } = await saveImportedPages(brain, pages);
        console.log(`\n✅ Shimo import: ${imported} imported, ${skipped} skipped`);
        await brain.disconnect();

      } else if (sub === 'wechat') {
        const dir = args[2];
        if (!dir) { console.error('Usage: deepbrain import wechat <dir>'); break; }
        const brain = await getBrain(brainName);
        console.log('📥 Importing WeChat articles (微信公众号)...');
        const pages = await importWechat({ dir, onProgress: (i, t, f) => process.stdout.write(`  [${i}/${t}] ${f}\r`) });
        const { imported, skipped } = await saveImportedPages(brain, pages);
        console.log(`\n✅ WeChat import: ${imported} imported, ${skipped} skipped`);
        await brain.disconnect();

      } else if (sub === 'wechat-article') {
        const urls = args.slice(2);
        if (!urls.length) { console.error('Usage: deepbrain import wechat-article <url> [url2 ...]'); break; }
        const brain = await getBrain(brainName);
        console.log('📥 抓取微信公众号文章...');
        const pages = await importWechatArticle({ urls, onProgress: (i, t, u) => process.stdout.write(`  [${i}/${t}] ${u}\r`) });
        const { imported, skipped } = await saveImportedPages(brain, pages);
        console.log(`\n✅ 微信文章抓取完成：${imported} 篇已导入，${skipped} 篇跳过`);
        await brain.disconnect();

      } else if (sub === 'evernote') {
        const dir = args[2];
        if (!dir) { console.error('Usage: deepbrain import evernote <dir>'); break; }
        const brain = await getBrain(brainName);
        console.log('📥 Importing from Evernote (.enex)...');
        const pages = await importEvernote({ dir, onProgress: (i, t, f) => process.stdout.write(`  [${i}/${t}] ${f}\r`) });
        const { imported, skipped } = await saveImportedPages(brain, pages);
        console.log(`\n✅ Evernote import: ${imported} imported, ${skipped} skipped`);
        await brain.disconnect();

      } else if (sub === 'logseq') {
        const dir = args[2];
        if (!dir) { console.error('Usage: deepbrain import logseq <dir>'); break; }
        const brain = await getBrain(brainName);
        console.log('📥 Importing Logseq graph...');
        const pages = await importLogseq({ dir, onProgress: (i, t, f) => process.stdout.write(`  [${i}/${t}] ${f}\r`) });
        const { imported, skipped } = await saveImportedPages(brain, pages);
        console.log(`\n✅ Logseq import: ${imported} imported, ${skipped} skipped`);
        await brain.disconnect();

      } else if (sub === 'bear') {
        const dir = args[2];
        if (!dir) { console.error('Usage: deepbrain import bear <dir>'); break; }
        const brain = await getBrain(brainName);
        console.log('📥 Importing from Bear...');
        const pages = await importBear({ dir, onProgress: (i, t, f) => process.stdout.write(`  [${i}/${t}] ${f}\r`) });
        const { imported, skipped } = await saveImportedPages(brain, pages);
        console.log(`\n✅ Bear import: ${imported} imported, ${skipped} skipped`);
        await brain.disconnect();

      } else if (sub === 'google-keep') {
        const dir = args[2];
        if (!dir) { console.error('Usage: deepbrain import google-keep <dir>'); break; }
        const brain = await getBrain(brainName);
        console.log('📥 Importing from Google Keep...');
        const pages = await importGoogleKeep({ dir, onProgress: (i, t, f) => process.stdout.write(`  [${i}/${t}] ${f}\r`) });
        const { imported, skipped } = await saveImportedPages(brain, pages);
        console.log(`\n✅ Google Keep import: ${imported} imported, ${skipped} skipped`);
        await brain.disconnect();

      } else if (sub === 'onenote') {
        const dir = args[2];
        if (!dir) { console.error('Usage: deepbrain import onenote <dir>'); break; }
        const brain = await getBrain(brainName);
        console.log('📥 Importing from OneNote...');
        const pages = await importOneNote({ dir, onProgress: (i, t, f) => process.stdout.write(`  [${i}/${t}] ${f}\r`) });
        const { imported, skipped } = await saveImportedPages(brain, pages);
        console.log(`\n✅ OneNote import: ${imported} imported, ${skipped} skipped`);
        await brain.disconnect();

      } else if (sub === 'joplin') {
        const dir = args[2];
        if (!dir) { console.error('Usage: deepbrain import joplin <dir>'); break; }
        const brain = await getBrain(brainName);
        console.log('📥 Importing from Joplin...');
        const pages = await importJoplin({ dir, onProgress: (i, t, f) => process.stdout.write(`  [${i}/${t}] ${f}\r`) });
        const { imported, skipped } = await saveImportedPages(brain, pages);
        console.log(`\n✅ Joplin import: ${imported} imported, ${skipped} skipped`);
        await brain.disconnect();

      } else if (sub === 'readwise') {
        const file = args[2];
        if (!file) { console.error('Usage: deepbrain import readwise <file.csv|json>'); break; }
        const brain = await getBrain(brainName);
        console.log('📥 Importing from Readwise...');
        const pages = await importReadwise({ file, onProgress: (i, t, title) => process.stdout.write(`  [${i}/${t}] ${title}\r`) });
        const { imported, skipped } = await saveImportedPages(brain, pages);
        console.log(`\n✅ Readwise import: ${imported} imported, ${skipped} skipped`);
        await brain.disconnect();

      } else if (sub === 'roam') {
        const file = args[2];
        if (!file) { console.error('Usage: deepbrain import roam <file.json>'); break; }
        const brain = await getBrain(brainName);
        console.log('📥 Importing from Roam Research...');
        const pages = await importRoam({ file, onProgress: (i, t, title) => process.stdout.write(`  [${i}/${t}] ${title}\r`) });
        const { imported, skipped } = await saveImportedPages(brain, pages);
        console.log(`\n✅ Roam import: ${imported} imported, ${skipped} skipped`);
        await brain.disconnect();

      } else if (sub === 'dayone') {
        const file = args[2];
        if (!file) { console.error('Usage: deepbrain import dayone <file.json>'); break; }
        const brain = await getBrain(brainName);
        console.log('📥 Importing from Day One...');
        const pages = await importDayOne({ file, onProgress: (i, t, title) => process.stdout.write(`  [${i}/${t}] ${title}\r`) });
        const { imported, skipped } = await saveImportedPages(brain, pages);
        console.log(`\n✅ Day One import: ${imported} imported, ${skipped} skipped`);
        await brain.disconnect();

      } else if (sub === 'flomo') {
        const file = args[2];
        if (!file) { console.error('Usage: deepbrain import flomo <file.html|md>'); break; }
        const brain = await getBrain(brainName);
        console.log('📥 Importing from Flomo...');
        const pages = await importFlomo({ file, onProgress: (i, t, title) => process.stdout.write(`  [${i}/${t}] ${title}\r`) });
        const { imported, skipped } = await saveImportedPages(brain, pages);
        console.log(`\n✅ Flomo import: ${imported} imported, ${skipped} skipped`);
        await brain.disconnect();

      } else if (sub === 'apple-notes') {
        const dir = args[2];
        if (!dir) { console.error('Usage: deepbrain import apple-notes <dir>'); break; }
        const brain = await getBrain(brainName);
        console.log('📥 Importing from Apple Notes...');
        const pages = await importAppleNotes({ dir, onProgress: (i, t, f) => process.stdout.write(`  [${i}/${t}] ${f}\r`) });
        const { imported, skipped } = await saveImportedPages(brain, pages);
        console.log(`\n✅ Apple Notes import: ${imported} imported, ${skipped} skipped`);
        await brain.disconnect();

      } else if (sub === 'wolai') {
        const dir = args[2];
        if (!dir) { console.error('Usage: deepbrain import wolai <dir>'); break; }
        const brain = await getBrain(brainName);
        console.log('📥 Importing from Wolai (我来)...');
        const pages = await importWolai({ dir, onProgress: (i, t, f) => process.stdout.write(`  [${i}/${t}] ${f}\r`) });
        const { imported, skipped } = await saveImportedPages(brain, pages);
        console.log(`\n✅ Wolai import: ${imported} imported, ${skipped} skipped`);
        await brain.disconnect();

      } else if (sub === 'flowus') {
        const dir = args[2];
        if (!dir) { console.error('Usage: deepbrain import flowus <dir>'); break; }
        const brain = await getBrain(brainName);
        console.log('📥 Importing from FlowUs (息流)...');
        const pages = await importFlowUs({ dir, onProgress: (i, t, f) => process.stdout.write(`  [${i}/${t}] ${f}\r`) });
        const { imported, skipped } = await saveImportedPages(brain, pages);
        console.log(`\n✅ FlowUs import: ${imported} imported, ${skipped} skipped`);
        await brain.disconnect();

      } else if (sub === 'siyuan') {
        const dir = args[2];
        if (!dir) { console.error('Usage: deepbrain import siyuan <dir>'); break; }
        const brain = await getBrain(brainName);
        console.log('📥 Importing from SiYuan (思源笔记)...');
        const pages = await importSiyuan({ dir, onProgress: (i, t, f) => process.stdout.write(`  [${i}/${t}] ${f}\r`) });
        const { imported, skipped } = await saveImportedPages(brain, pages);
        console.log(`\n✅ SiYuan import: ${imported} imported, ${skipped} skipped`);
        await brain.disconnect();

      } else if (sub === 'ebook') {
        const files = args.slice(2);
        if (!files.length) { console.error('Usage: deepbrain import ebook <file.epub|pdf> [file2...]'); break; }
        const brain = await getBrain(brainName);
        console.log('📥 Importing ebook(s)...');
        const pages = await importEbook({ files, onProgress: (i, t, f) => process.stdout.write(`  [${i}/${t}] ${f}\r`) });
        const { imported, skipped } = await saveImportedPages(brain, pages);
        console.log(`\n✅ Ebook import: ${imported} imported, ${skipped} skipped`);
        await brain.disconnect();

      } else {
        console.error(`Usage: deepbrain import <platform> [options]

Platforms:
  github       --repo owner/repo [--token TOKEN]    Import GitHub repo docs
  github-stars --user <user> [--limit 100]           Import starred repos
  youtube      <url>                                 Import transcript + summary
  notion       <path> [--prefix notion/]             Import Notion export
  obsidian     <vault-path>                          Import Obsidian vault
  evernote     <dir>                                 Import .enex export
  logseq       <dir>                                 Import Logseq graph
  roam         <file.json>                           Import Roam JSON export
  bear         <dir>                                 Import Bear notes
  joplin       <dir>                                 Import Joplin export
  readwise     <file.csv|json>                       Import Readwise highlights
  dayone       <file.json>                           Import Day One journal
  apple-notes  <dir>                                 Import Apple Notes HTML
  google-keep  <dir>                                 Import Google Keep JSON
  onenote      <dir>                                 Import OneNote HTML
  yuque        <dir>                                 Import 语雀 export
  feishu       <dir>                                 Import 飞书 export
  shimo        <dir>                                 Import 石墨 export
  wechat       <dir>                                 Import WeChat articles (local files)
  wechat-article <url> [url2...]                    Fetch WeChat articles from mp.weixin.qq.com URLs
  flomo        <file.html|md>                        Import Flomo memos
  wolai        <dir>                                 Import 我来 export
  flowus       <dir>                                 Import FlowUs export
  siyuan       <dir>                                 Import 思源笔记 export
  ebook        <file.epub|pdf>...                    Import EPUB/PDF files`);
      }
      break;
    }

    case 'sync': {
      const sub = args[1];
      if (sub === 'notion') {
        const tokenResult = extractFlag(args, '--token', '');
        args = tokenResult.args;
        const dbResult = extractFlag(args, '--database', '');
        args = dbResult.args;
        const prefixResult = extractFlag(args, '--prefix', 'notion/');
        args = prefixResult.args;

        if (!tokenResult.value || !dbResult.value) {
          console.error('Usage: deepbrain sync notion --token <token> --database <id> [--prefix notion/]');
          break;
        }

        const brain = await getBrain(brainName);
        const result = await syncNotion(brain, {
          token: tokenResult.value,
          databaseId: dbResult.value,
          prefix: prefixResult.value,
          onProgress: (msg) => console.log(msg),
        });
        console.log(`\n📋 Synced: ${result.synced}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`);
        if (result.errors.length > 0) {
          result.errors.forEach(e => console.log(`  ⚠️ ${e.pageId}: ${e.error}`));
        }
        await brain.disconnect();

      } else if (sub === 'rss') {
        const addResult = extractFlag(args, '--add', '');
        args = addResult.args;
        const removeResult = extractFlag(args, '--remove', '');
        args = removeResult.args;
        const listFlag = hasFlag(args, '--list');
        args = listFlag.args;
        const runFlag = hasFlag(args, '--run');
        args = runFlag.args;

        const config = loadConfig(brainName);
        const dataDir = config.data_dir ?? './brain';

        if (addResult.value) {
          const feed = addFeed(dataDir, addResult.value);
          console.log(`✅ RSS feed added: ${addResult.value}`);
        } else if (removeResult.value) {
          if (removeFeed(dataDir, removeResult.value)) {
            console.log(`✅ RSS feed removed: ${removeResult.value}`);
          } else {
            console.log(`❌ Feed not found: ${removeResult.value}`);
          }
        } else if (listFlag.present) {
          const feeds = listFeeds(dataDir);
          if (feeds.length === 0) {
            console.log('\n📡 No RSS feeds subscribed.\n   Use: deepbrain sync rss --add <url>\n');
          } else {
            console.log(`\n📡 ${feeds.length} RSS feeds:\n`);
            for (const f of feeds) {
              console.log(`  ${f.title ?? f.url}`);
              console.log(`    URL: ${f.url}`);
              console.log(`    Last fetched: ${f.lastFetched ?? 'never'}\n`);
            }
          }
        } else if (runFlag.present) {
          const brain = await getBrain(brainName);
          console.log('\n📡 Syncing RSS feeds...');
          const result = await syncRssFeeds(brain, {
            dataDir,
            onProgress: console.log,
          });
          console.log(`\n✅ RSS sync: ${result.fetched} feeds fetched, ${result.imported} articles imported`);
          if (result.errors.length > 0) result.errors.forEach(e => console.log(`  ❌ ${e}`));
          await brain.disconnect();
        } else {
          console.error('Usage: deepbrain sync rss --add <url> | --remove <url> | --list | --run');
        }
      } else {
        console.error('Usage: deepbrain sync <notion|rss> [options]');
      }
      break;
    }

    case 'share': {
      // v1.5.0: serve shared brain web UI
      const portResult = extractFlag(args, '--port', '8080');
      args = portResult.args;
      const hostResult = extractFlag(args, '--host', '0.0.0.0');
      args = hostResult.args;
      const titleResult = extractFlag(args, '--title', 'DeepBrain');
      args = titleResult.args;
      const exportResult = extractFlag(args, '--export', '');
      args = exportResult.args;

      const brain = await getBrain(brainName);

      if (exportResult.value) {
        console.log(`\n📦 Exporting static site to ${exportResult.value}...`);
        const result = await exportStaticSite(brain, exportResult.value, titleResult.value);
        console.log(`✅ Exported ${result.pages} pages to ${result.outputDir}\n`);
        await brain.disconnect();
      } else {
        await serveSharedBrain(brain, {
          port: parseInt(portResult.value),
          host: hostResult.value,
          title: titleResult.value,
        });
      }
      break;
    }

    case 'ui': {
      const portResult = extractFlag(args, '--port', '4001');
      args = portResult.args;
      const brain = await getBrain(brainName);
      const { BrainUI } = await import('./ui/server.js');
      const ui = new BrainUI({
        port: parseInt(portResult.value),
        brain,
        staticDir: new URL('./ui', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
      });
      await ui.start();
      console.log('   Press Ctrl+C to stop.\n');
      process.on('SIGINT', async () => {
        await ui.stop();
        await brain.disconnect();
        process.exit(0);
      });
      await new Promise(() => {}); // Wait forever
      break;
    }

    case 'doctor': {
      const configFile = getConfigFile(brainName);
      const config = loadConfig(brainName);
      console.log('🩺 Running health checks...\n');
      const result = await runDoctor(configFile, config);
      console.log(formatDoctorResult(result));
      break;
    }

    case 'playground': {
      const portResult = extractFlag(args, '--port', '3000');
      const hostResult = extractFlag(args, '--host', '0.0.0.0');
      const config = loadConfig(brainName);
      const webhookConfig = loadWebhookConfig(config as Record<string, unknown>);

      await startWebUI({
        port: parseInt(portResult.value),
        host: hostResult.value,
        brainConfig: config,
        locale: getLocale() as any,
        webhookConfig,
      });
      console.log(`\n🧪 Open http://localhost:${portResult.value}/playground for the interactive demo\n`);
      break;
    }

    case 'learn': {
      const text = args.slice(1).join(' ');
      if (!text) { console.error('Usage: deepbrain learn <text>'); break; }
      const brain = await getBrain(brainName);
      const agentBrain = new AgentBrain(brain);
      const { slug } = await agentBrain.learn(text);
      console.log(`✅ Learned → ${slug}`);
      await brain.disconnect();
      break;
    }

    case 'recall': {
      const query = args.slice(1).join(' ');
      if (!query) { console.error('Usage: deepbrain recall <query>'); break; }
      const brain = await getBrain(brainName);
      const agentBrain = new AgentBrain(brain);
      const results = await agentBrain.recall(query);
      if (results.length === 0) {
        console.log('No memories found.');
      } else {
        console.log(`\n🧠 ${results.length} memories for "${query}"\n`);
        for (const r of results) {
          console.log(`  📄 ${r.slug} (${r.type}) - score: ${r.score.toFixed(4)}`);
          console.log(`     ${r.chunk_text.slice(0, 120)}...\n`);
        }
      }
      await brain.disconnect();
      break;
    }

    case 'evolve': {
      const dryRunResult = hasFlag(args, '--dry-run');
      args = dryRunResult.args;
      console.log('\n🧬 Running evolve cycle...\n');
      const brain = await getBrain(brainName);
      const agentBrain = new AgentBrain(brain);
      const report = await agentBrain.evolve({ dryRun: dryRunResult.present });
      console.log(`✅ Evolve complete`);
      console.log(`   Traces processed: ${report.tracesProcessed}`);
      console.log(`   Pages created: ${report.pagesCreated}`);
      console.log(`   Pages updated: ${report.pagesUpdated}`);
      console.log(`   Pages promoted: ${report.pagesPromoted}`);
      if (report.errors.length > 0) {
        console.log(`   Errors: ${report.errors.length}`);
        report.errors.forEach(e => console.log(`     ⚠️ ${e}`));
      }
      if (dryRunResult.present) console.log('\n   (dry run - no changes made)');
      await brain.disconnect();
      break;
    }

    default:
      console.log(`
🧠 DeepBrain - Personal AI Brain

Commands:
  deepbrain init [provider]              Initialize (default: ollama)
  deepbrain init --template research     Initialize with template
  deepbrain doctor                       Health check (config, API, DB)
  deepbrain playground [--port 3000]     Launch interactive playground
  deepbrain put <slug> [file]            Add/update a page (auto-summarizes)
  deepbrain get <slug>                   Read a page
  deepbrain query "text"                 Semantic search (hybrid)
  deepbrain search "keyword"             Keyword search
  deepbrain chat "question"              Chat with your brain (RAG)
  deepbrain chat -i                      Interactive multi-turn chat
  deepbrain chat -i --session <id>       Resume a saved chat session
  deepbrain chat "q" --brains a,b,c      Chat across multiple brains
  deepbrain import github --repo o/r     Import GitHub repo (README, docs, wiki)
  deepbrain import github-stars --user u Import starred repos as knowledge
  deepbrain import youtube <url>         Import YouTube transcript + summary
  deepbrain import notion <path>         Import Notion export (MD/HTML/CSV)
  deepbrain import obsidian <vault>      Import Obsidian vault (wikilinks, tags)
  deepbrain import evernote <dir>        Import Evernote .enex export
  deepbrain import logseq <dir>          Import Logseq graph
  deepbrain import roam <file.json>      Import Roam Research JSON
  deepbrain import bear <dir>            Import Bear notes
  deepbrain import joplin <dir>          Import Joplin export
  deepbrain import readwise <file>       Import Readwise CSV/JSON highlights
  deepbrain import dayone <file.json>    Import Day One journal
  deepbrain import apple-notes <dir>     Import Apple Notes HTML
  deepbrain import google-keep <dir>     Import Google Keep Takeout
  deepbrain import onenote <dir>         Import OneNote HTML export
  deepbrain import yuque <dir>           Import 语雀 export
  deepbrain import feishu <dir>          Import 飞书 export
  deepbrain import shimo <dir>           Import 石墨文档 export
  deepbrain import wechat <dir>          Import 微信公众号 articles
  deepbrain import flomo <file>          Import Flomo memos
  deepbrain import wolai <dir>           Import 我来 export
  deepbrain import flowus <dir>          Import FlowUs export
  deepbrain import siyuan <dir>          Import 思源笔记 export
  deepbrain import ebook <file>          Import EPUB/PDF files
  deepbrain sync rss --add <url>         Subscribe to RSS feed
  deepbrain sync rss --run               Fetch all RSS feeds
  deepbrain sync rss --list              List RSS subscriptions
  deepbrain sync notion --token T --database D   Sync from Notion database
  deepbrain share [--port 8080]          Serve read-only shared brain UI
  deepbrain share --export ./site        Export brain as static HTML site
  deepbrain flashcards generate [slugs]  Generate Q&A flashcards from pages
  deepbrain flashcards review            Review due flashcards (SM-2)
  deepbrain flashcards stats             Flashcard statistics
  deepbrain digest-email --to email      Send learning digest email
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
  deepbrain web [--port 3000]            Start interactive Web UI
  deepbrain sync notion --token T --database D   Sync from Notion database
  deepbrain watch <vault-path>           Watch Obsidian vault for changes
  deepbrain related <slug>               Find related pages (smart connections)
  deepbrain retag                        Re-tag all pages with LLM
  deepbrain backup [--output file.zip]   Export brain to backup
  deepbrain restore <file.zip>           Restore brain from backup
  deepbrain templates                    List available brain templates
  deepbrain batch-import <dir>           Batch import .md files (fast)
  deepbrain mcp                          MCP server info
  deepbrain plugin list|add|remove       Manage plugins

Flags:
  --brain <name>                         Use a named brain (default: "default")
  --no-summary                           Skip auto-summary on put
  --provider <provider>                  LLM provider for chat
  --model <model>                        LLM model for chat
  --lang <en|zh>                         Language (auto-detected)

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
