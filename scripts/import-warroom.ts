/**
 * Import war-room knowledge into DeepBrain
 */
import { Brain } from '../src/core/brain.js';
import { readdir, readFile } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';

const GEMINI_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBoc4y3H2YrWp4xkxHCtsd2lhzHwRIqdUA';

const WAR_ROOM = 'C:/Users/mingjwan/.openclaw/shared/war-room';
const STRATEGY_KB = join(WAR_ROOM, '战略知识库');

// Simple HTML to text
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(name: string): string {
  return name
    .replace(/\.md$|\.html$/i, '')
    .replace(/[^\w\u4e00-\u9fff\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 80);
}

function categorize(filename: string): { type: string; tags: string[] } {
  const lower = filename.toLowerCase();
  if (lower.startsWith('1.')) return { type: 'analysis', tags: ['战略', '战略/环境分析'] };
  if (lower.startsWith('2.1')) return { type: 'analysis', tags: ['战略', '战略/定位'] };
  if (lower.startsWith('2.2')) return { type: 'analysis', tags: ['战略', '战略/商业模式'] };
  if (lower.startsWith('3.')) return { type: 'analysis', tags: ['战略', '战略/竞争策略'] };
  if (lower.includes('mrd')) return { type: 'product', tags: ['产品', '产品/MRD'] };
  if (lower.includes('competitive') || lower.includes('竞品')) return { type: 'analysis', tags: ['竞品分析'] };
  if (lower.includes('weekly')) return { type: 'report', tags: ['周报'] };
  if (lower.includes('persona')) return { type: 'design', tags: ['产品', '产品/用户画像'] };
  if (lower.includes('术语') || lower.includes('index')) return { type: 'reference', tags: ['参考'] };
  if (lower.includes('战略内核')) return { type: 'strategy', tags: ['战略', '战略/内核'] };
  return { type: 'document', tags: ['war-room'] };
}

async function main() {
  const brain = new Brain({
    embedding_provider: 'gemini',
    api_key: GEMINI_KEY,
    database: './deepbrain-data',
  });
  await brain.connect();

  let imported = 0;
  let errors = 0;

  // 1. Import 战略知识库 markdown files
  console.log('\n📚 Importing 战略知识库...');
  const kbFiles = await readdir(STRATEGY_KB);
  for (const file of kbFiles) {
    if (!file.endsWith('.md')) continue;
    try {
      const content = await readFile(join(STRATEGY_KB, file), 'utf-8');
      const slug = 'strategy-' + slugify(file);
      const title = content.match(/^#\s+(.+)$/m)?.[1] || file.replace(/\.md$/, '');
      const { type, tags } = categorize(file);

      await brain.put(slug, { type, title, compiled_truth: content });
      for (const tag of tags) await brain.tag(slug, tag);
      console.log(`  ✅ ${file} → ${slug} [${tags.join(', ')}]`);
      imported++;
    } catch (e: any) {
      console.log(`  ❌ ${file}: ${e.message}`);
      errors++;
    }
  }

  // 2. Import war-room root files (MD + HTML)
  console.log('\n📂 Importing war-room documents...');
  const rootFiles = await readdir(WAR_ROOM);
  for (const file of rootFiles) {
    const ext = extname(file).toLowerCase();
    if (ext !== '.md' && ext !== '.html') continue;
    if (file === 'README.md' || file === 'NOTICE.md') continue;

    try {
      const raw = await readFile(join(WAR_ROOM, file), 'utf-8');
      const content = ext === '.html' ? stripHtml(raw) : raw;
      if (content.length < 50) continue; // skip near-empty

      const slug = 'warroom-' + slugify(file);
      const title = ext === '.md'
        ? (content.match(/^#\s+(.+)$/m)?.[1] || file.replace(/\.(md|html)$/i, ''))
        : file.replace(/\.html$/i, '');
      const { type, tags } = categorize(file);

      await brain.put(slug, { type, title, compiled_truth: content.slice(0, 50000) });
      for (const tag of tags) await brain.tag(slug, tag);
      console.log(`  ✅ ${file} → ${slug} [${tags.join(', ')}]`);
      imported++;
    } catch (e: any) {
      console.log(`  ❌ ${file}: ${e.message}`);
      errors++;
    }
  }

  // Stats
  const stats = await brain.stats();
  console.log(`\n🧠 Import complete!`);
  console.log(`   Imported: ${imported} pages`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total pages: ${stats.page_count}`);
  console.log(`   Total chunks: ${stats.chunk_count}`);
  console.log(`   Total tags: ${stats.tag_count}`);

  await brain.disconnect();
}

main().catch(console.error);
