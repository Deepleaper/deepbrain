/**
 * DeepBrain — WeChat Article URL Importer (微信公众号文章在线抓取)
 *
 * Fetch and import articles directly from mp.weixin.qq.com URLs.
 * No local files needed — just pass the article URL(s).
 *
 * Usage:
 *   deepbrain import wechat-article <url> [url2 ...]
 *
 * Note: WeChat restricts scraping when accessed from non-browser environments.
 *       Articles must be publicly accessible (not paywalled / login-required).
 */

import type { ImportedPage } from './yuque.js';

// ── Types ──────────────────────────────────────────────────────────

export interface WechatArticleImportOptions {
  urls: string[];
  onProgress?: (current: number, total: number, url: string) => void;
}

// ── HTML → Markdown ───────────────────────────────────────────────

function cleanWechatHtml(html: string): string {
  let c = html;

  // Drop scripts and styles
  c = c.replace(/<script[\s\S]*?<\/script>/gi, '');
  c = c.replace(/<style[\s\S]*?<\/style>/gi, '');

  // Extract WeChat article body (#js_content)
  const body = c.match(/id="js_content"[^>]*>([\s\S]*?)<\/section>\s*<\/div>/i)
    ?? c.match(/id="js_content"[^>]*>([\s\S]*?)<\/div>/i);
  if (body) c = body[1];

  // Block-level elements → markdown
  c = c.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
  c = c.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
  c = c.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
  c = c.replace(/<section[^>]*>([\s\S]*?)<\/section>/gi, '$1\n');
  c = c.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  c = c.replace(/<br\s*\/?>/gi, '\n');
  c = c.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n');
  c = c.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  c = c.replace(/<\/?[ou]l[^>]*>/gi, '\n');

  // Inline elements → markdown
  c = c.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  c = c.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  c = c.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  c = c.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
  c = c.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // Images — WeChat uses data-src for lazy loading
  c = c.replace(/<img[^>]*data-src="([^"]*)"[^>]*\/?>/gi, '![]($1)');
  c = c.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // Links
  c = c.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Strip remaining tags
  c = c.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  c = c.replace(/&amp;/g, '&');
  c = c.replace(/&lt;/g, '<');
  c = c.replace(/&gt;/g, '>');
  c = c.replace(/&quot;/g, '"');
  c = c.replace(/&#39;/g, "'");
  c = c.replace(/&nbsp;/g, ' ');

  // Normalise whitespace
  c = c.replace(/\r\n/g, '\n');
  c = c.replace(/\n{3,}/g, '\n\n');
  return c.trim();
}

// ── Metadata extraction ───────────────────────────────────────────

function extractTitle(html: string, url: string): string {
  // og:title (most reliable)
  const og = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i)
    ?? html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"[^>]*>/i);
  if (og?.[1]) return og[1].trim();

  // WeChat's rich_media_title h2
  const rmTitle = html.match(/<h2[^>]*id="activity-name"[^>]*>([\s\S]*?)<\/h2>/i)
    ?? html.match(/<h1[^>]*class="[^"]*rich_media_title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
  if (rmTitle?.[1]) return rmTitle[1].replace(/<[^>]+>/g, '').trim();

  // <title> tag (strip WeChat platform suffix)
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (title?.[1]) return title[1].replace(/\s*[-–]\s*微信公众平台.*$/, '').trim();

  return url;
}

function extractMeta(html: string, url: string): Record<string, string> {
  const meta: Record<string, string> = { source_platform: 'wechat-article', source_url: url };

  // Author / account nickname
  const nick = html.match(/var\s+nickname\s*=\s*["']([^"']+)["']/);
  if (nick) meta.author = nick[1];
  const metaAuthor = html.match(/<meta[^>]*name="author"[^>]*content="([^"]*)"[^>]*>/i);
  if (metaAuthor?.[1]) meta.author = metaAuthor[1];

  // Publish time (JS variable or og:updated_time)
  const ct = html.match(/var\s+ct\s*=\s*["']([^"']+)["']/);
  if (ct) meta.published_at = ct[1];
  const ogTime = html.match(/<meta[^>]*property="og:updated_time"[^>]*content="([^"]*)"[^>]*>/i);
  if (ogTime?.[1]) meta.published_at = ogTime[1];

  // Account fakeid
  const fakeid = html.match(/var\s+fakeid\s*=\s*["']([^"']+)["']/);
  if (fakeid) meta.account_id = fakeid[1];

  return meta;
}

function urlToSlug(url: string): string {
  try {
    const u = new URL(url);
    // Use `sn` param (article ID in WeChat URLs)
    const sn = u.searchParams.get('sn');
    if (sn) return `wechat-article-${sn}`;
  } catch {
    // fall through
  }
  return `wechat-article-${Date.now().toString(36)}`;
}

// ── Main ──────────────────────────────────────────────────────────

export async function importWechatArticle(options: WechatArticleImportOptions): Promise<ImportedPage[]> {
  const { urls, onProgress } = options;
  const pages: ImportedPage[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    onProgress?.(i + 1, urls.length, url);

    let html: string;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Referer': 'https://mp.weixin.qq.com/',
        },
      });

      if (!res.ok) {
        console.error(`  ⚠ 抓取失败 (HTTP ${res.status}): ${url}`);
        continue;
      }

      html = await res.text();
    } catch (err) {
      console.error(`  ⚠ 网络错误: ${url}\n    ${(err as Error).message}`);
      continue;
    }

    const title = extractTitle(html, url);
    const body = cleanWechatHtml(html);
    const meta = extractMeta(html, url);

    if (!body) {
      console.error(`  ⚠ 未提取到正文（文章可能需要登录或已被限制访问）: ${url}`);
      continue;
    }

    pages.push({
      slug: urlToSlug(url),
      title,
      body,
      tags: ['微信公众号'],
      metadata: meta,
      source: url,
    });
  }

  return pages;
}
