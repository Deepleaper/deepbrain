/**
 * DeepBrain Example: Evolve — Memory Consolidation
 *
 * Learn 20 experiences, then evolve() to consolidate into higher-level knowledge.
 *
 * Run: npx tsx examples/evolve-demo.ts
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
  console.log('🧬 DeepBrain — Evolve Demo\n');
  console.log('  Human memory: remember then forget');
  console.log('  DeepBrain:    remember, consolidate, evolve\n');

  let provider = 'ollama';
  if (process.env.OPENAI_API_KEY) provider = 'openai';
  else if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) provider = 'gemini';
  else if (process.env.DEEPSEEK_API_KEY) provider = 'deepseek';

  if (provider === 'ollama') {
    const ok = await checkOllama();
    if (!ok) {
      console.log('❌ Ollama not running!');
      console.log('Setup: ollama serve && ollama pull nomic-embed-text\n');
      process.exit(1);
    }
  }

  console.log(`Provider: ${provider}\n`);

  let brain: Brain;
  let agent: AgentBrain;
  try {
    brain = new Brain({
      embedding_provider: provider,
      db_path: './example-brain-evolve.db',
    });
    await brain.connect();
    agent = new AgentBrain(brain, 'evolve-demo');
    console.log('✅ Brain connected\n');
  } catch (e: any) {
    console.error(`❌ Failed: ${e.message}\n`);
    process.exit(1);
  }

  // Learn 20 diverse experiences
  console.log('📝 Learning 20 experiences across 4 domains...\n');

  const experiences = [
    // Client handling (5)
    { action: 'Meet new client', result: 'Client needs 2 weeks to review proposal', context: { domain: 'sales' } },
    { action: 'Send proposal', result: 'Included PDF brochure and ROI analysis', context: { domain: 'sales' } },
    { action: 'Client presentation', result: 'Client wants ROI breakdown with competitor comparison', context: { domain: 'sales' } },
    { action: 'Follow up call', result: 'PPT was well received, scheduling contract discussion', context: { domain: 'sales' } },
    { action: 'Close deal', result: 'Annual contract signed with upsell opportunity', context: { domain: 'sales' } },
    // Product knowledge (5)
    { action: 'Study X200 specs', result: 'X200 battery lasts 48 hours', context: { domain: 'product' } },
    { action: 'Check X200 pricing', result: 'X200 priced at $299', context: { domain: 'product' } },
    { action: 'X200 warranty info', result: 'X200 has 2-year warranty, 1-year accidental', context: { domain: 'product' } },
    { action: 'Compare with competitor', result: 'X200 ships 12 hours faster than competitor A', context: { domain: 'product' } },
    { action: 'X200 charging', result: 'X200 charges 0-80% in 30 minutes', context: { domain: 'product' } },
    // Team operations (5)
    { action: 'Morning standup', result: 'Team aligned on sprint goals', context: { domain: 'ops' } },
    { action: 'Review KPIs', result: '5 of 8 KPIs trending green', context: { domain: 'ops' } },
    { action: 'Process improvement', result: 'Moved approvals to OA system, saving 3 days', context: { domain: 'ops' } },
    { action: 'Customer SLA check', result: 'Average response 30 min, VIP 15 min', context: { domain: 'ops' } },
    { action: 'Quarterly planning', result: 'Set 3 stretch goals for Q2', context: { domain: 'ops' } },
    // Misc (5)
    { action: 'Train new hire', result: 'Onboarding takes 9 business days', context: { domain: 'hr' } },
    { action: 'Update documentation', result: 'All SOPs refreshed for Q2', context: { domain: 'hr' } },
    { action: 'Incident response', result: 'Resolved in under 24h, updated runbook', context: { domain: 'ops' } },
    { action: 'Budget review', result: 'Spent $50k of $35k allocated — over budget', context: { domain: 'finance' } },
    { action: 'Vendor evaluation', result: 'Shortlisted 8 vendors, 3 for final review', context: { domain: 'procurement' } },
  ];

  for (const exp of experiences) {
    try {
      await agent.learn(exp);
      process.stdout.write('.');
    } catch {
      process.stdout.write('x');
    }
  }
  console.log(`\n\n✅ Learned ${experiences.length} experiences\n`);

  // Evolve
  console.log('🧬 Running evolve()...\n');
  console.log('  evolve() will:');
  console.log('  • Find patterns across experiences');
  console.log('  • Consolidate into higher-level knowledge');
  console.log('  • Promote frequently-accessed memories');
  console.log('  • Build connections between related memories\n');

  try {
    const report = await agent.evolve();
    console.log('📊 Evolve Report:');
    console.log(`  Traces processed: ${report.tracesProcessed || 0}`);
    console.log(`  Pages created:    ${report.pagesCreated || 0}`);
    console.log(`  Pages updated:    ${report.pagesUpdated || 0}`);
    console.log(`  Pages promoted:   ${report.pagesPromoted || 0}\n`);
  } catch (e: any) {
    console.log(`  ⚠️  evolve() needs LLM support: ${e.message}`);
    console.log('  (embedding-only mode still supports learn/recall)\n');
  }

  // Summary
  console.log('━'.repeat(50));
  console.log('\n📖 Before evolve: 20 raw experience traces');
  console.log('📖 After evolve:  Consolidated knowledge pages\n');
  console.log('  Raw memory → learn() → recall()');
  console.log('  DeepBrain  → learn() → evolve() → recall() with insight\n');

  await brain!.disconnect();
}

main().catch(e => {
  console.error(`\n❌ Error: ${e.message}\n`);
  process.exit(1);
});
