#!/usr/bin/env node

/**
 * DeepBrain — CLI
 *
 * Commands:
 *   deepbrain init                     Initialize a new brain
 *   deepbrain put <slug> <file>        Add/update a page
 *   deepbrain get <slug>               Read a page
 *   deepbrain query "text"             Semantic search
 *   deepbrain search "keyword"         Keyword search
 *   deepbrain link <from> <to>         Create a link
 *   deepbrain timeline <slug> "text"   Add timeline entry
 *   deepbrain stats                    Brain statistics
 *   deepbrain dream                    Run Dream Cycle
 *   deepbrain list [--type X]          List pages
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { Brain } from './core/brain.js';
import type { DeepBrainConfig } from './core/types.js';
import { dream } from './dream/index.js';

const CONFIG_FILE = 'deepbrain.json';

function loadConfig(): Partial<DeepBrainConfig> {
  if (existsSync(CONFIG_FILE)) {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  }
  return {};
}

async function getBrain(): Promise<Brain> {
  const config = loadConfig();
  const brain = new Brain(config);
  await brain.connect();
  return brain;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'init': {
      const provider = args[1] ?? 'ollama';
      const config: Partial<DeepBrainConfig> = {
        engine: 'pglite',
        database: './deepbrain-data',
        embedding_provider: provider,
        data_dir: './brain',
      };

      // Auto-detect API key from env
      const envKeys: Record<string, string> = {
        openai: 'OPENAI_API_KEY',
        gemini: 'GEMINI_API_KEY',
        deepseek: 'DEEPSEEK_API_KEY',
        dashscope: 'DASHSCOPE_API_KEY',
        zhipu: 'ZHIPU_API_KEY',
      };
      const envKey = envKeys[provider];
      if (envKey && process.env[envKey]) {
        config.api_key = process.env[envKey];
      }

      writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
      mkdirSync('./brain', { recursive: true });
      mkdirSync('./deepbrain-data', { recursive: true });

      console.log(`\n🧠 DeepBrain initialized!`);
      console.log(`   Provider: ${provider}`);
      console.log(`   Config: ${CONFIG_FILE}`);
      console.log(`   Data: ./deepbrain-data`);
      console.log(`\n   Try: deepbrain put my-first-note notes.md`);
      break;
    }

    case 'put': {
      const slug = args[1];
      const file = args[2];
      if (!slug) { console.error('Usage: deepbrain put <slug> [file]'); break; }

      const brain = await getBrain();
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
      });

      console.log(`✅ ${slug} saved (${body.length} chars, type: ${type})`);
      await brain.disconnect();
      break;
    }

    case 'get': {
      const slug = args[1];
      if (!slug) { console.error('Usage: deepbrain get <slug>'); break; }

      const brain = await getBrain();
      const page = await brain.get(slug);

      if (page) {
        console.log(`# ${page.title}\n`);
        console.log(`Type: ${page.type} | Updated: ${page.updated_at}\n`);
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

      const brain = await getBrain();
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
      const keyword = args.slice(1).join(' ');
      if (!keyword) { console.error('Usage: deepbrain search "keyword"'); break; }

      const brain = await getBrain();
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
      await brain.disconnect();
      break;
    }

    case 'link': {
      const [from, to] = [args[1], args[2]];
      if (!from || !to) { console.error('Usage: deepbrain link <from> <to>'); break; }
      const brain = await getBrain();
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

      const brain = await getBrain();
      await brain.addTimeline(slug, {
        date: new Date().toISOString().split('T')[0],
        summary: text,
      });
      console.log(`📅 Timeline added to ${slug}`);
      await brain.disconnect();
      break;
    }

    case 'stats': {
      const brain = await getBrain();
      const s = await brain.stats();
      console.log('\n🧠 DeepBrain Stats\n');
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

      const brain = await getBrain();
      const pages = await brain.list({ type, limit: 50 });

      console.log(`\n📋 ${pages.length} pages${type ? ` (type: ${type})` : ''}\n`);
      for (const p of pages) {
        console.log(`  ${p.slug.padEnd(30)} ${p.type.padEnd(12)} ${p.updated_at}`);
      }
      await brain.disconnect();
      break;
    }

    case 'dream': {
      console.log('\n💤 Running Dream Cycle...\n');
      const brain = await getBrain();
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

    default:
      console.log(`
🧠 DeepBrain — Personal AI Brain

Commands:
  deepbrain init [provider]         Initialize (default: ollama)
  deepbrain put <slug> [file]       Add/update a page
  deepbrain get <slug>              Read a page
  deepbrain query "text"            Semantic search (hybrid)
  deepbrain search "keyword"        Keyword search
  deepbrain link <from> <to>        Create a link between pages
  deepbrain timeline <slug> "text"  Add timeline entry
  deepbrain stats                   Brain statistics
  deepbrain list [--type X]         List pages
  deepbrain dream                   Run Dream Cycle (maintenance)

Providers: ollama, deepseek, gemini, openai, dashscope, zhipu
Docs: https://github.com/Magicray1217/deepbrain
      `);
  }
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
