// 07-export-import.ts — Demonstrate brain backup/restore
import { Brain } from 'deepbrain';

const brain = new Brain({ database: './demo-export.db', embedding_provider: 'ollama' });
await brain.connect();

// Add some pages
await brain.put('meeting-notes', {
  type: 'note',
  title: 'Team Meeting',
  compiled_truth: '# Team Meeting\n\nDiscussed Q2 roadmap...',
});
await brain.put('project-ideas', {
  type: 'note',
  title: 'Ideas',
  compiled_truth: '# Ideas\n\n1. AI dashboard\n2. Auto-reports',
});

// Export
const backup = await brain.export();
console.log(`Exported ${backup.pages.length} pages`);

// Import into new brain
const brain2 = new Brain({ database: './demo-import.db', embedding_provider: 'ollama' });
await brain2.connect();
await brain2.import(backup);
console.log('Import complete!');

const restored = await brain2.get('meeting-notes');
console.log('Restored:', restored?.compiled_truth?.slice(0, 50));

await brain.disconnect();
await brain2.disconnect();
