/**
 * DeepBrain - RSS Feed Sync
 *
 * Subscribe to RSS feeds and auto-import new articles.
 *
 * CLI:
 *   deepbrain sync rss --add <feed-url>
 *   deepbrain sync rss --remove <feed-url>
 *   deepbrain sync rss --list
 *   deepbrain sync rss --run
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Brain } from '../core/brain.js';

export interface RssFeed {
  url: string;
  title?: string;
  addedAt: string;
  lastFetched?: string;
  lastItemDate?: string;
}

export interface RssState {
  feeds: RssFeed[];
  seenIds: string[];
}

export interface RssSyncOptions {
  /** Brain data directory */
  dataDir: string;
  /** Slug prefix (default: 'rss/') */
  prefix?: string;
  /** Max items per feed (default: 20) */
  maxItems?: number;
  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface RssSyncResult {
  fetched: number;
  imported: number;
  errors: string[];
}

function getStateFile(dataDir: string): string {
  return join(dataDir, 'rss-state.json');
}

function loadState(dataDir: string): RssState {
  const file = getStateFile(dataDir);
  if (existsSync(file)) {
    return JSON.parse(readFileSync(file, 'utf8'));
  }
  return { feeds: [], seenIds: [] };
}

function saveState(dataDir: string, state: RssState): void {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(getStateFile(dataDir), JSON.stringify(state, null, 2));
}

/**
 * Add an RSS feed subscription.
 */
export function addFeed(dataDir: string, feedUrl: string): RssFeed {
  const state = loadState(dataDir);
  const existing = state.feeds.find(f => f.url === feedUrl);
  if (existing) return existing;

  const feed: RssFeed = { url: feedUrl, addedAt: new Date().toISOString() };
  state.feeds.push(feed);
  saveState(dataDir, state);
  return feed;
}

/**
 * Remove an RSS feed subscription.
 */
export function removeFeed(dataDir: string, feedUrl: string): boolean {
  const state = loadState(dataDir);
  const idx = state.feeds.findIndex(f => f.url === feedUrl);
  if (idx === -1) return false;
  state.feeds.splice(idx, 1);
  saveState(dataDir, state);
  return true;
}

/**
 * List all RSS feed subscriptions.
 */
export function listFeeds(dataDir: string): RssFeed[] {
  return loadState(dataDir).feeds;
}

interface RssItem {
  id: string;
  title: string;
  link: string;
  content: string;
  pubDate?: string;
  author?: string;
}

/**
 * Simple XML RSS/Atom parser (no dependencies).
 */
function parseRssFeed(xml: string): { title: string; items: RssItem[] } {
  const feedTitle = xml.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1] ?? 'Untitled Feed';
  const items: RssItem[] = [];

  // Try RSS 2.0 items
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const m of itemMatches) {
    const block = m[1];
    const title = block.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)?.[1]?.trim() ?? 'Untitled';
    const link = block.match(/<link[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/s)?.[1]?.trim() ?? '';
    const content = block.match(/<(?:content:encoded|description)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:content:encoded|description)>/s)?.[1]?.trim() ?? '';
    const pubDate = block.match(/<pubDate[^>]*>(.*?)<\/pubDate>/)?.[1]?.trim();
    const guid = block.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1]?.trim();
    const author = block.match(/<(?:dc:creator|author)[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/(?:dc:creator|author)>/)?.[1]?.trim();

    items.push({
      id: guid ?? link ?? title,
      title,
      link,
      content: stripHtml(content),
      pubDate,
      author,
    });
  }

  // Try Atom entries if no RSS items found
  if (items.length === 0) {
    const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
    for (const m of entryMatches) {
      const block = m[1];
      const title = block.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)?.[1]?.trim() ?? 'Untitled';
      const link = block.match(/<link[^>]*href="([^"]*)"[^>]*\/?>/)?.[1] ?? '';
      const content = block.match(/<(?:content|summary)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:content|summary)>/s)?.[1]?.trim() ?? '';
      const published = block.match(/<(?:published|updated)[^>]*>(.*?)<\/(?:published|updated)>/)?.[1]?.trim();
      const id = block.match(/<id[^>]*>(.*?)<\/id>/)?.[1]?.trim();

      items.push({
        id: id ?? link ?? title,
        title,
        link,
        content: stripHtml(content),
        pubDate: published,
      });
    }
  }

  return { title: feedTitle, items };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Fetch all subscribed RSS feeds and import new articles.
 */
export async function syncRssFeeds(
  brain: Brain,
  options: RssSyncOptions,
): Promise<RssSyncResult> {
  const { dataDir, prefix = 'rss/', maxItems = 20 } = options;
  const log = options.onProgress ?? (() => {});
  const state = loadState(dataDir);
  const result: RssSyncResult = { fetched: 0, imported: 0, errors: [] };

  if (state.feeds.length === 0) {
    log('No RSS feeds subscribed. Use --add <url> to add one.');
    return result;
  }

  for (const feed of state.feeds) {
    try {
      log(`\n📡 Fetching: ${feed.url}`);
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': 'DeepBrain/1.5.0 RSS Reader' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const xml = await res.text();
      const parsed = parseRssFeed(xml);
      feed.title = parsed.title;
      feed.lastFetched = new Date().toISOString();
      result.fetched++;

      log(`   "${parsed.title}" — ${parsed.items.length} items`);

      let imported = 0;
      for (const item of parsed.items.slice(0, maxItems)) {
        if (state.seenIds.includes(item.id)) continue;

        const slug = `${prefix}${item.title
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 60)}`;

        const content = [
          `# ${item.title}`,
          '',
          item.author ? `**Author:** ${item.author}` : '',
          item.pubDate ? `**Date:** ${item.pubDate}` : '',
          item.link ? `**Source:** ${item.link}` : '',
          '',
          item.content.slice(0, 10000),
        ].filter(Boolean).join('\n');

        await brain.put(slug, {
          type: 'article',
          title: item.title,
          compiled_truth: content,
          frontmatter: {
            source: 'rss',
            feed_url: feed.url,
            feed_title: feed.title,
            link: item.link,
            pub_date: item.pubDate,
            author: item.author,
          },
        });

        state.seenIds.push(item.id);
        imported++;
        result.imported++;
        log(`   ✅ ${item.title}`);
      }

      if (imported === 0) log(`   ⏭️  No new items`);

    } catch (e: any) {
      result.errors.push(`${feed.url}: ${e.message}`);
      log(`   ❌ ${e.message}`);
    }
  }

  // Keep seenIds bounded (last 5000)
  if (state.seenIds.length > 5000) {
    state.seenIds = state.seenIds.slice(-5000);
  }

  saveState(dataDir, state);
  return result;
}
