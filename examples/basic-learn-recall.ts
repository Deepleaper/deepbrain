/**
 * DeepBrain Example: Basic Learn & Recall
 *
 * Learn 5 experiences, then recall with 4 queries.
 * Default: Ollama (no API key needed).
 *
 * Run: npx tsx examples/basic-learn-recall.ts
 * Prereq: ollama pull nomic-embed-text
 */

import { Brain, AgentBrain } from 'deepbrain';

async function checkOllama(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:11434/api/tags');
    return res.ok;
  } catch { return false; }
}

async function main() {
  console.log('🧠 DeepBrain — Basic Learn & Recall\n');

  // Auto-detect provider
  let provider = 'ollama';
  if (process.env.OPENAI_API_KEY) provider = 'openai';
  else if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) provider = 'gemini';
  else if (process.env.DEEPSEEK_API_KEY) provider = 'deepseek';

  if (provider === 'ollama') {
    const ok = await checkOllama();
    if (!ok) {
      console.log('❌ Ollama not running!\n');
      console.log('Setup:');
      console.log('  1. Install: https://ollama.com');
      console.log('  2. Pull model: ollama pull nomic-embed-text');
      console.log('  3. Re-run this example\n');
      console.log('Or use a cloud provider:');
      console.log('  export OPENAI_API_KEY=sk-xxx');
      process.exit(1);
    }
  }

  console.log(`Provider: ${provider}\n`);

  // 1. Create Brain
  let brain: Brain;
  let agent: AgentBrain;
  try {
    brain = new Brain({
      embedding_provider: provider,
      db_path: './example-brain.db',
    });
    await brain.connect();
    agent = new AgentBrain(brain, 'demo-agent');
    console.log('✅ Brain connected\n');
  } catch (e: any) {
    console.error(`❌ Failed to connect: ${e.message}`);
    if (provider === 'ollama') {
      console.log('  Make sure: ollama serve && ollama pull nomic-embed-text');
    }
    process.exit(1);
  }

  // 2. Learn experiences
  console.log('📝 Learning 5 experiences...\n');

  const experiences = [
    { action: 'Handle VIP client presentation', result: 'Client impressed, scheduled follow-up for PPT review', context: { customer: 'Acme', level: 'VIP' } },
    { action: 'Resolve customer complaint', result: '7-day refund processed, offered loyalty discount', context: { type: 'complaint' } },
    { action: 'Analyze Q1 sales report', result: 'Revenue up 23%, costs up 5%, margin improving', context: { quarter: 'Q1' } },
    { action: 'Research product X200', result: 'X200 ships in 48 hours, priced at $299, launching April 15', context: { product: 'X200' } },
    { action: 'Follow up with lead', result: 'Lead interested in X200, scheduling demo next week', context: { customer: 'BigCorp', product: 'X200' } },
  ];

  for (const exp of experiences) {
    try {
      await agent.learn(exp);
      console.log(`  ✅ ${exp.action}`);
    } catch (e: any) {
      console.error(`  ❌ Failed: ${e.message}`);
    }
  }

  console.log(`\n📦 Learned ${experiences.length} experiences\n`);

  // 3. Recall
  console.log('🔍 Recalling...\n');

  const queries = [
    'How to handle VIP clients?',
    'What is the refund policy?',
    'X200 product details',
    'Q1 performance summary',
  ];

  for (const q of queries) {
    console.log(`  Q: "${q}"`);
    try {
      const memories = await agent.recall(q);
      if (memories && memories.length > 0) {
        const text = memories[0].text || JSON.stringify(memories[0]);
        console.log(`  A: ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`);
        if (memories[0].score !== undefined) {
          console.log(`  Score: ${(memories[0].score * 100).toFixed(0)}%`);
        }
      } else {
        console.log('  (no results)');
      }
    } catch (e: any) {
      console.error(`  ❌ ${e.message}`);
    }
    console.log('');
  }

  console.log('✅ Done! Brain capabilities: learn() + recall()');
  console.log('Next: npx tsx examples/evolve-demo.ts\n');

  await brain!.disconnect();
}

main().catch(e => {
  console.error(`\n❌ Error: ${e.message}\n`);
  process.exit(1);
});
