/**
 * DeepBrain — Notion Importer Tests
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Brain } from '../src/core/brain.js';
import { importNotion } from '../src/import/notion.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const TEST_DB = './test-notion-import-data';
const TEST_DIR = './test-notion-export';

describe('Notion Importer', () => {
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
    try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
  });

  beforeEach(() => {
    try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
    mkdirSync(TEST_DIR, { recursive: true });
  });

  it('should import a single markdown file', async () => {
    const file = join(TEST_DIR, 'test-page.md');
    writeFileSync(file, '# My Test Page\n\nThis is a test page about artificial intelligence and deep learning.\n\nIt has multiple paragraphs of content for testing purposes.');

    const result = await importNotion(brain, file);
    expect(result.imported).toBe(1);
    expect(result.errors).toEqual([]);
    expect(result.pages.length).toBe(1);

    const page = await brain.get(result.pages[0]);
    expect(page).not.toBeNull();
    expect(page!.compiled_truth).toContain('artificial intelligence');
  }, 30000);

  it('should import a directory of markdown files', async () => {
    writeFileSync(join(TEST_DIR, 'page1.md'), '# Page One\n\nContent about machine learning algorithms and neural networks.');
    writeFileSync(join(TEST_DIR, 'page2.md'), '# Page Two\n\nContent about web development and TypeScript programming.');

    const result = await importNotion(brain, TEST_DIR);
    expect(result.imported).toBe(2);
    expect(result.errors).toEqual([]);
  }, 60000);

  it('should parse YAML frontmatter', async () => {
    const file = join(TEST_DIR, 'frontmatter.md');
    writeFileSync(file, '---\ntitle: Custom Title\ntype: person\ntags: [ai, expert]\n---\n\nThis is the body content about an AI expert who works on large language models.');

    const result = await importNotion(brain, file);
    expect(result.imported).toBe(1);

    const page = await brain.get(result.pages[0]);
    expect(page).not.toBeNull();
    expect(page!.title).toBe('Custom Title');
    expect(page!.type).toBe('person');

    const tags = await brain.getTags(result.pages[0]);
    expect(tags).toContain('ai');
    expect(tags).toContain('expert');
  }, 30000);

  it('should import HTML files', async () => {
    const file = join(TEST_DIR, 'page.html');
    writeFileSync(file, '<html><head><title>HTML Page</title></head><body><h1>Test</h1><p>This is HTML content about quantum computing and physics research.</p></body></html>');

    const result = await importNotion(brain, file);
    expect(result.imported).toBe(1);

    const page = await brain.get(result.pages[0]);
    expect(page!.title).toBe('HTML Page');
    expect(page!.compiled_truth).toContain('quantum computing');
  }, 30000);

  it('should import CSV files', async () => {
    const file = join(TEST_DIR, 'database.csv');
    writeFileSync(file, 'Name,Role,Company\nAlice,Engineer,Google\nBob,Designer,Apple');

    const result = await importNotion(brain, file);
    expect(result.imported).toBe(2);
  }, 60000);

  it('should skip empty files', async () => {
    writeFileSync(join(TEST_DIR, 'empty.md'), '');
    writeFileSync(join(TEST_DIR, 'short.md'), 'Hi');

    const result = await importNotion(brain, TEST_DIR);
    expect(result.skipped).toBe(2);
    expect(result.imported).toBe(0);
  });

  it('should skip unsupported file types', async () => {
    writeFileSync(join(TEST_DIR, 'image.png'), 'not-really-png');
    writeFileSync(join(TEST_DIR, 'data.json'), '{}');

    const result = await importNotion(brain, TEST_DIR);
    expect(result.imported).toBe(0);
  });

  it('should support dry run', async () => {
    writeFileSync(join(TEST_DIR, 'dryrun.md'), '# Dry Run\n\nThis page should not be actually imported into the brain.');

    const result = await importNotion(brain, TEST_DIR, { dryRun: true });
    expect(result.imported).toBe(1);
    expect(result.pages.length).toBe(1);

    // Page should NOT exist in brain
    const page = await brain.get(result.pages[0]);
    expect(page).toBeNull();
  });

  it('should support slug prefix', async () => {
    writeFileSync(join(TEST_DIR, 'prefixed.md'), '# Prefixed Page\n\nContent with prefix for namespace isolation and organization.');

    const result = await importNotion(brain, TEST_DIR, { prefix: 'notion/' });
    expect(result.pages[0]).toMatch(/^notion\//);
  }, 30000);

  it('should handle nested directories', async () => {
    const sub = join(TEST_DIR, 'subfolder');
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(sub, 'nested.md'), '# Nested\n\nThis is a nested page inside a subfolder for testing recursive import.');

    const result = await importNotion(brain, TEST_DIR);
    expect(result.imported).toBe(1);
  }, 30000);

  it('should throw for non-existent path', async () => {
    await expect(importNotion(brain, './nonexistent-path-12345')).rejects.toThrow('Path not found');
  });

  it('should call progress callback', async () => {
    writeFileSync(join(TEST_DIR, 'prog.md'), '# Progress\n\nTracking progress of imports through callback functions.');

    const progress: Array<[number, number, string]> = [];
    await importNotion(brain, TEST_DIR, {
      onProgress: (current, total, file) => progress.push([current, total, file]),
    });

    expect(progress.length).toBeGreaterThan(0);
    expect(progress[0][0]).toBe(1); // current
    expect(progress[0][1]).toBeGreaterThanOrEqual(1); // total
  }, 30000);
});
