/**
 * Example 10: Evolve — Algorithmic Knowledge Consolidation
 *
 * Demonstrates how AgentBrain.evolve() consolidates traces into
 * compiled knowledge pages without requiring an LLM.
 */

import { Brain } from '../src/core/brain.js';
import { AgentBrain } from '../src/agent-brain.js';

const brain = new Brain({ database: './evolve-demo.db', embedding_provider: 'ollama' });
await brain.connect();
const agentBrain = new AgentBrain(brain, 'demo-agent');

// Simulate learning over time
await agentBrain.learn('User asked about pricing - wants enterprise plan');
await agentBrain.learn('User mentioned team size is 50 people');
await agentBrain.learn('User interested in annual billing for discount');
await agentBrain.learn('User company is in fintech sector');
await agentBrain.learn('User needs SSO integration');
await agentBrain.learn('User budget is around $10k/month');

// Evolve — consolidate traces into knowledge
const result = await agentBrain.evolve({ strategy: 'merge', minTraces: 3 });
console.log(`Processed ${result.tracesProcessed} traces → ${result.pagesCreated} knowledge pages`);
result.clusters.forEach(c => {
  console.log(`  📚 ${c.topic}: ${c.traceCount} traces → ${c.outputPage}`);
});

// Now recall should return consolidated knowledge
const knowledge = await agentBrain.recall('what do we know about the user?');
console.log('\nConsolidated knowledge:', knowledge);

// Try different strategies
const result2 = await agentBrain.evolve({ strategy: 'extract', dryRun: true });
console.log(`\nDry run (extract): would process ${result2.tracesProcessed} traces`);

await brain.disconnect();
