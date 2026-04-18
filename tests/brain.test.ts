/**
 * DeepBrain — Core Tests
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Brain } from '../src/core/brain.js';

// Use a temp directory for test database
const TEST_DB = './test-deepbrain-data';

const HAS_API_KEY = !!(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);

describe.skipIf(!HAS_API_KEY)('Brain', () => {
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
    // Clean up test data
    const { rmSync } = await import('node:fs');
    try { rmSync(TEST_DB, { recursive: true, force: true }); } catch {}
  });

  describe('Pages CRUD', () => {
    it('should put and get a page', async () => {
      const page = await brain.put('test-page', {
        type: 'note',
        title: 'Test Page',
        compiled_truth: 'This is a test page about artificial intelligence and machine learning.',
      });

      expect(page).toBeDefined();
      expect(page.slug).toBe('test-page');
      expect(page.title).toBe('Test Page');
      expect(page.type).toBe('note');

      const retrieved = await brain.get('test-page');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.title).toBe('Test Page');
      expect(retrieved!.compiled_truth).toContain('artificial intelligence');
    }, 30000);

    it('should return null for non-existent page', async () => {
      const page = await brain.get('non-existent');
      expect(page).toBeNull();
    });

    it('should upsert on duplicate slug', async () => {
      await brain.put('upsert-test', {
        type: 'note',
        title: 'Version 1',
        compiled_truth: 'First version',
      });

      await brain.put('upsert-test', {
        type: 'note',
        title: 'Version 2',
        compiled_truth: 'Second version',
      });

      const page = await brain.get('upsert-test');
      expect(page!.title).toBe('Version 2');
      expect(page!.compiled_truth).toBe('Second version');
    }, 30000);

    it('should list pages', async () => {
      const pages = await brain.list();
      expect(pages.length).toBeGreaterThanOrEqual(2);
    });

    it('should list pages filtered by type', async () => {
      await brain.put('person-test', {
        type: 'person',
        title: 'John Doe',
        compiled_truth: 'A test person.',
      });

      const notes = await brain.list({ type: 'note' });
      const persons = await brain.list({ type: 'person' });

      expect(notes.every(p => p.type === 'note')).toBe(true);
      expect(persons.every(p => p.type === 'person')).toBe(true);
      expect(persons.length).toBeGreaterThanOrEqual(1);
    }, 30000);

    it('should delete a page', async () => {
      await brain.put('to-delete', {
        type: 'note',
        title: 'Delete Me',
        compiled_truth: 'Will be deleted.',
      });

      await brain.delete('to-delete');
      const page = await brain.get('to-delete');
      expect(page).toBeNull();
    }, 30000);
  });

  describe('Search', () => {
    it('should find pages via semantic query', async () => {
      // Ensure we have data
      await brain.put('ai-expert', {
        type: 'person',
        title: 'AI Expert',
        compiled_truth: 'An expert in deep learning, neural networks, and transformer architectures.',
      });

      const results = await brain.query('who knows about machine learning?');
      expect(results.length).toBeGreaterThan(0);
    }, 30000);

    it('should find pages via keyword search', async () => {
      const results = await brain.search('artificial intelligence');
      expect(results.length).toBeGreaterThan(0);
    }, 10000);

    it('should return empty array for no matches', async () => {
      const results = await brain.search('xyznonexistentkeyword12345');
      expect(results).toEqual([]);
    }, 10000);
  });

  describe('Links', () => {
    it('should create and retrieve links', async () => {
      await brain.put('company-a', {
        type: 'company',
        title: 'Company A',
        compiled_truth: 'A tech company.',
      });

      await brain.link('person-test', 'company-a', 'works at', 'employment');

      const links = await brain.getLinks('person-test');
      expect(links.length).toBeGreaterThanOrEqual(1);
      expect(links.some(l => l.to_slug === 'company-a')).toBe(true);

      const backlinks = await brain.getBacklinks('company-a');
      expect(backlinks.some(l => l.from_slug === 'person-test')).toBe(true);
    }, 30000);

    it('should unlink pages', async () => {
      await brain.unlink('person-test', 'company-a');
      const links = await brain.getLinks('person-test');
      expect(links.some(l => l.to_slug === 'company-a')).toBe(false);
    });
  });

  describe('Tags', () => {
    it('should tag and retrieve tags', async () => {
      await brain.tag('test-page', 'important');
      await brain.tag('test-page', 'ai');

      const tags = await brain.getTags('test-page');
      expect(tags).toContain('important');
      expect(tags).toContain('ai');
    });

    it('should untag', async () => {
      await brain.untag('test-page', 'important');
      const tags = await brain.getTags('test-page');
      expect(tags).not.toContain('important');
      expect(tags).toContain('ai');
    });
  });

  describe('Timeline', () => {
    it('should add and retrieve timeline entries', async () => {
      await brain.addTimeline('test-page', {
        date: '2026-04-13',
        summary: 'Created for testing',
        detail: 'This is a test timeline entry.',
      });

      const entries = await brain.getTimeline('test-page');
      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries[0].summary).toBe('Created for testing');
    });

    it('should return empty for non-existent page timeline', async () => {
      const entries = await brain.getTimeline('non-existent');
      expect(entries).toEqual([]);
    });
  });

  describe('Stats', () => {
    it('should return brain statistics', async () => {
      const stats = await brain.stats();
      expect(stats.page_count).toBeGreaterThan(0);
      expect(stats.chunk_count).toBeGreaterThan(0);
      expect(stats.embedded_count).toBeGreaterThan(0);
      expect(stats.pages_by_type).toBeDefined();
      expect(typeof stats.link_count).toBe('number');
      expect(typeof stats.tag_count).toBe('number');
      expect(typeof stats.timeline_entry_count).toBe('number');
    });
  });
});
