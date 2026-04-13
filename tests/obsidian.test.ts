/**
 * DeepBrain — Obsidian Importer Tests
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Brain } from '../src/core/brain.js';
import { importObsidian } from '../src/import/obsidian.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const TEST_DB = './test-obsidian-import-data';
const TEST_VAULT = './test-obsidian-vault';

describe('Obsidian Importer', () => {
  let brain: Brain;

  beforeAll(async () => {
    brain = new Brain({
      engine: 'pglite',
      database: TEST_DB,
      embedding_provider: 'gemini',
      api_key: process.env.GEMINI_API_KEY,
    });
    await brain.connect();
  }, 30000);

  afterAll(async () => {
    await brain.disconnect();
    try { rmSync(TEST_DB, { recursive: true, force: true }); } catch {}
    try { rmSync(TEST_VAULT, { recursive: true, force: true }); } catch {}
  });

  beforeEach(() => {
    try { rmSync(TEST_VAULT, { recursive: true, force: true }); } catch {}
    mkdirSync(TEST_VAULT, { recursive: true });
  });

  it('should import markdown files from vault', async () => {
    writeFileSync(join(TEST_VAULT, 'Note.md'), '# My Note\n\nThis is a note about machine learning and artificial intelligence research.');

    const result = await importObsidian(brain, TEST_VAULT);
    expect(result.imported).toBe(1);
    expect(result.errors).toEqual([]);
  }, 30000);

  it('should convert [[wikilinks]] to links', async () => {
    writeFileSync(join(TEST_VAULT, 'PersonA.md'), '# Person A\n\nWorks at [[CompanyX]] and knows [[PersonB]] very well from university.');
    writeFileSync(join(TEST_VAULT, 'CompanyX.md'), '# Company X\n\nA tech company focused on artificial intelligence and cloud computing solutions.');
    writeFileSync(join(TEST_VAULT, 'PersonB.md'), '# Person B\n\nA data scientist specializing in natural language processing and machine learning.');

    const result = await importObsidian(brain, TEST_VAULT);
    expect(result.imported).toBe(3);

    // Check links were created
    const links = await brain.getLinks('persona');
    expect(links.some(l => l.to_slug === 'companyx')).toBe(true);
    expect(links.some(l => l.to_slug === 'personb')).toBe(true);
  }, 60000);

  it('should handle [[alias|display]] links', async () => {
    writeFileSync(join(TEST_VAULT, 'Aliased.md'), '# Aliased\n\nReferences [[SomePage|a different name]] in the content with display text alias.');

    const result = await importObsidian(brain, TEST_VAULT);
    expect(result.imported).toBe(1);

    // Body should have the alias text, not the wikilink
    const page = await brain.get('aliased');
    expect(page!.compiled_truth).toContain('a different name');
    expect(page!.compiled_truth).not.toContain('[[');
  }, 30000);

  it('should extract inline #tags', async () => {
    writeFileSync(join(TEST_VAULT, 'Tagged.md'), '# Tagged Note\n\nThis note has #ai and #research tags inline in the content body.');

    const result = await importObsidian(brain, TEST_VAULT);
    expect(result.imported).toBe(1);

    const tags = await brain.getTags('tagged');
    expect(tags).toContain('ai');
    expect(tags).toContain('research');
  }, 30000);

  it('should merge frontmatter tags and inline tags', async () => {
    writeFileSync(join(TEST_VAULT, 'MergedTags.md'), '---\ntags: [project, work]\n---\n\n# Merged Tags\n\nThis has #ai inline too as well as frontmatter tags for comprehensive tagging.');

    const result = await importObsidian(brain, TEST_VAULT);
    const tags = await brain.getTags('mergedtags');
    expect(tags).toContain('project');
    expect(tags).toContain('work');
    expect(tags).toContain('ai');
  }, 30000);

  it('should ignore .obsidian folder', async () => {
    mkdirSync(join(TEST_VAULT, '.obsidian'), { recursive: true });
    writeFileSync(join(TEST_VAULT, '.obsidian', 'config.md'), '# Config\n\nThis should not be imported from the obsidian internal folder.');
    writeFileSync(join(TEST_VAULT, 'Real.md'), '# Real Note\n\nThis should be imported as a real note from the obsidian vault.');

    const result = await importObsidian(brain, TEST_VAULT);
    expect(result.imported).toBe(1);
    expect(result.pages.some(p => p.includes('config'))).toBe(false);
  }, 30000);

  it('should support nested folders', async () => {
    mkdirSync(join(TEST_VAULT, 'Projects', 'AI'), { recursive: true });
    writeFileSync(join(TEST_VAULT, 'Projects', 'AI', 'GPT.md'), '# GPT Research\n\nNotes about GPT architecture and transformer models for language understanding.');

    const result = await importObsidian(brain, TEST_VAULT);
    expect(result.imported).toBe(1);
    expect(result.pages[0]).toContain('projects');
  }, 30000);

  it('should support dry run', async () => {
    writeFileSync(join(TEST_VAULT, 'DryObs.md'), '# Dry Obsidian\n\nThis page should not be imported during a dry run test operation.');

    const result = await importObsidian(brain, TEST_VAULT, { dryRun: true });
    expect(result.imported).toBe(1);

    const page = await brain.get(result.pages[0]);
    expect(page).toBeNull();
  });

  it('should throw for non-existent vault', async () => {
    await expect(importObsidian(brain, './nonexistent-vault-12345')).rejects.toThrow('Vault not found');
  });

  it('should throw for file (not directory)', async () => {
    const file = join(TEST_VAULT, 'single.md');
    writeFileSync(file, '# Test\n\nContent');
    await expect(importObsidian(brain, file)).rejects.toThrow('Not a directory');
  });

  it('should support Chinese content and tags', async () => {
    writeFileSync(join(TEST_VAULT, '笔记.md'), '# 我的笔记\n\n这是关于 #人工智能 和 #机器学习 的笔记内容，包含中文标签和正文。');

    const result = await importObsidian(brain, TEST_VAULT);
    expect(result.imported).toBe(1);

    const tags = await brain.getTags(result.pages[0]);
    expect(tags).toContain('人工智能');
    expect(tags).toContain('机器学习');
  }, 30000);
});
