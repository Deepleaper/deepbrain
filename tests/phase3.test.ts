/**
 * Phase 3 Tests — Meta-Evolve + Knowledge Governance
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { rmSync, mkdirSync } from 'fs';

// Mock agentkits before importing Brain
vi.mock('agentkits', () => ({
  createEmbedding: () => ({
    embed: async () => new Float32Array(384).fill(0),
    embedBatch: async (texts: string[]) => texts.map(() => new Float32Array(384).fill(0)),
  }),
}));

import { Brain } from '../src/core/brain.js';
import { MetaEvolver } from '../src/core/meta-evolve.js';
import type { MetaEvolveStrategy, FailedCase } from '../src/core/meta-evolve.js';
import { KnowledgeGovernor, stripPII, anonymize, summarize } from '../src/core/knowledge-governance.js';
import type { GovernancePolicy, PropagationRule } from '../src/core/knowledge-governance.js';
import type { Page } from '../src/core/types.js';

let dbCounter = 0;
function tmpDb() {
  const dir = join(tmpdir(), `deepbrain-test-phase3-${Date.now()}-${dbCounter++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ── Meta-Evolve Tests ────────────────────────────────────────────

describe('MetaEvolver', () => {
  let brain: Brain;
  let evolver: MetaEvolver;

  beforeAll(async () => {
    brain = new Brain({ database: tmpDb() });
    await brain.connect();
    evolver = new MetaEvolver(brain);
  });

  afterAll(async () => {
    await brain.disconnect();
  });

  it('should load default strategies when none exist', async () => {
    const strategies = await evolver.getStrategies();
    expect(strategies.length).toBeGreaterThanOrEqual(5);
    // Should be sorted by effectiveness (desc)
    for (let i = 1; i < strategies.length; i++) {
      expect(strategies[i - 1].effectiveness_score).toBeGreaterThanOrEqual(strategies[i].effectiveness_score);
    }
  });

  it('should select categorical strategy when all pages share same type', async () => {
    const pages = [
      { type: 'note', timeline: '' } as Page,
      { type: 'note', timeline: '' } as Page,
    ];
    const strategy = await evolver.selectStrategy(pages);
    expect(strategy.merge_method).toBe('categorical');
  });

  it('should select temporal strategy when pages have timeline data', async () => {
    const pages = [
      { type: 'note', timeline: '2024-01-01: something' } as Page,
      { type: 'person', timeline: '2024-02-01: other' } as Page,
    ];
    const strategy = await evolver.selectStrategy(pages);
    expect(strategy.merge_method).toBe('temporal');
  });

  it('should record result and update effectiveness via EMA', async () => {
    const strategies = await evolver.getStrategies();
    const target = strategies[0];
    const oldScore = target.effectiveness_score;

    await evolver.recordResult(target.id, 0.3, 0.9);

    const updated = await evolver.getStrategies();
    const updatedTarget = updated.find(s => s.id === target.id)!;
    expect(updatedTarget.effectiveness_score).not.toBe(oldScore);
    expect(updatedTarget.usage_count).toBeGreaterThan(0);
  });

  it('should propose new strategy from failed cases', async () => {
    const strategies = await evolver.getStrategies();
    const failedCases: FailedCase[] = [
      { strategy_id: strategies[0].id, pages: ['a', 'b'], before_score: 0.5, after_score: 0.2 },
      { strategy_id: strategies[0].id, pages: ['c'], before_score: 0.6, after_score: 0.1 },
    ];
    const proposed = await evolver.proposeNewStrategy(failedCases);
    expect(proposed).not.toBeNull();
    expect(proposed!.id).toMatch(/^auto-/);
    expect(proposed!.effectiveness_score).toBe(0.5);
  });

  it('should return null when proposing from empty failed cases', async () => {
    const result = await evolver.proposeNewStrategy([]);
    expect(result).toBeNull();
  });

  it('should prune low-performing strategies', async () => {
    const before = (await evolver.getStrategies()).length;
    // Set a very high threshold to prune most
    const pruned = await evolver.pruneStrategies(0.99);
    const after = (await evolver.getStrategies()).length;
    // Should keep at least one
    expect(after).toBeGreaterThanOrEqual(1);
    expect(pruned).toBeGreaterThanOrEqual(0);
    expect(after).toBeLessThanOrEqual(before);
  });

  it('should persist strategies to brain and reload', async () => {
    // Create a fresh evolver on same brain
    const evolver2 = new MetaEvolver(brain);
    const strategies = await evolver2.getStrategies();
    expect(strategies.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Knowledge Governance Tests ───────────────────────────────────

describe('KnowledgeGovernor', () => {
  const policy: GovernancePolicy = {
    pii_filter: true,
    attribution: true,
    audit_log: true,
    propagation_rules: [
      { from_level: 'L1', to_level: 'L2', filter: 'none' },
      { from_level: 'L2', to_level: 'L3', filter: 'pii_strip' },
      { from_level: 'L3', to_level: 'L4', filter: 'summarize' },
      { from_level: 'L1', to_level: 'L4', filter: 'anonymize' },
    ],
  };

  let brain: Brain;
  let governor: KnowledgeGovernor;

  beforeAll(async () => {
    brain = new Brain({ database: tmpDb() });
    await brain.connect();
    governor = new KnowledgeGovernor(policy, brain);
  });

  afterAll(async () => {
    await brain.disconnect();
  });

  const makePage = (truth: string, timeline = ''): Page => ({
    id: 1,
    slug: 'test',
    type: 'note',
    title: 'Test',
    compiled_truth: truth,
    timeline,
    frontmatter: {},
    created_at: new Date(),
    updated_at: new Date(),
  });

  it('should allow propagation when rule exists', () => {
    const page = makePage('hello');
    expect(governor.canPropagate(page, 'L1', 'L2')).toBe(true);
    expect(governor.canPropagate(page, 'L2', 'L3')).toBe(true);
  });

  it('should deny propagation when no rule exists', () => {
    const page = makePage('hello');
    expect(governor.canPropagate(page, 'L4', 'L1')).toBe(false);
    expect(governor.canPropagate(page, 'L3', 'L1')).toBe(false);
  });

  it('should strip PII from Chinese phone numbers and emails', () => {
    const text = '联系张总经理 13912345678 或 test@example.com';
    const result = stripPII(text);
    expect(result).not.toContain('13912345678');
    expect(result).not.toContain('test@example.com');
    expect(result).toContain('[PHONE]');
    expect(result).toContain('[EMAIL]');
  });

  it('should strip Chinese ID numbers', () => {
    const text = '身份证号 110101199001011234';
    const result = stripPII(text);
    expect(result).toContain('[ID_NUMBER]');
    expect(result).not.toContain('110101199001011234');
  });

  it('should strip Chinese names with titles', () => {
    const text = '通知王明远经理参会';
    const result = stripPII(text);
    expect(result).toContain('[NAME]经理');
    expect(result).not.toContain('王明远');
  });

  it('should filter page for propagation with pii_strip', () => {
    const page = makePage('联系人: test@email.com 电话 13800138000');
    const rule: PropagationRule = { from_level: 'L2', to_level: 'L3', filter: 'pii_strip' };
    const filtered = governor.filterForPropagation(page, rule);
    expect(filtered.compiled_truth).toContain('[EMAIL]');
    expect(filtered.compiled_truth).toContain('[PHONE]');
    // Original unchanged
    expect(page.compiled_truth).toContain('test@email.com');
  });

  it('should add attribution to page frontmatter', () => {
    const page = makePage('content');
    const attributed = governor.addAttribution(page, 'ray-cto', 'L2');
    expect(attributed.frontmatter._attribution).toBeDefined();
    const attr = attributed.frontmatter._attribution as any;
    expect(attr.source_agent).toBe('ray-cto');
    expect(attr.source_level).toBe('L2');
  });

  it('should write audit log to brain', async () => {
    await governor.auditLog('propagate', 'test-page', 'L1', 'L2');
    const logPage = await brain.get('_audit_log');
    expect(logPage).not.toBeNull();
    const entries = JSON.parse(logPage!.compiled_truth);
    expect(entries.length).toBe(1);
    expect(entries[0].action).toBe('propagate');
    expect(entries[0].page_slug).toBe('test-page');
  });

  it('should summarize text correctly', () => {
    const text = '第一句话。第二句话。第三句话。第四句话。第五句话。';
    const result = summarize(text);
    expect(result).toContain('第一句话');
    expect(result).toContain('第三句话');
    // Should not have all 5
    expect(result).not.toContain('第四句话');
  });

  it('should anonymize text', () => {
    const text = '联系张明先生 13912345678 邮件 a@b.com "李四"';
    const result = anonymize(text);
    expect(result).not.toContain('13912345678');
    expect(result).not.toContain('a@b.com');
    expect(result).toContain('[ANON]');
  });
});
