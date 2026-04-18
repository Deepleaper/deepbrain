// 08-stats-search.ts — Demonstrate brain stats and keyword search
import { Brain } from 'deepbrain';

const brain = new Brain({ database: './demo-stats.db', embedding_provider: 'ollama' });
await brain.connect();

// Add pages
await brain.put('ai-trends', {
  type: 'note',
  title: 'AI Trends 2026',
  compiled_truth: '# AI Trends 2026\n\nAgent frameworks are exploding...',
});
await brain.put('tech-stack', {
  type: 'note',
  title: 'Our Tech Stack',
  compiled_truth: '# Our Tech Stack\n\nTypeScript, PGLite, Ollama...',
});
await brain.put('roadmap', {
  type: 'note',
  title: 'Roadmap',
  compiled_truth: '# Roadmap\n\nQ2: Launch agent platform...',
});

// Stats
const stats = await brain.stats();
console.log('Brain stats:', stats);

// Keyword search
const results = await brain.search('agent');
console.log(`Found ${results.length} pages matching "agent"`);

await brain.disconnect();
