// 09-multi-brain.ts — Demonstrate multiple brains (L1 concept)
import { Brain } from 'deepbrain';

// Personal brain
const personal = new Brain({ database: './brain-personal.db', embedding_provider: 'ollama' });
await personal.connect();
await personal.put('preferences', {
  type: 'note',
  title: 'My Preferences',
  compiled_truth: '# My Preferences\n\nI prefer concise answers...',
});

// Work brain
const work = new Brain({ database: './brain-work.db', embedding_provider: 'ollama' });
await work.connect();
await work.put('processes', {
  type: 'note',
  title: 'Work Processes',
  compiled_truth: '# Work Processes\n\nCode review required before merge...',
});

console.log('Personal pages:', (await personal.list()).length);
console.log('Work pages:', (await work.list()).length);

await personal.disconnect();
await work.disconnect();
