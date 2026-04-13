import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { importWechat } from '../src/import/wechat.js';

const TMP = join(process.cwd(), 'tmp-test-wechat');

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });

  writeFileSync(join(TMP, '文章一.html'), `<html>
<head>
<meta property="og:title" content="AI 时代的思考" />
<meta name="author" content="技术公众号" />
</head>
<body>
<script>var publish_time = "2026-04-01";</script>
<div id="js_content">
<h2>第一章</h2>
<p>AI 正在改变世界。</p>
<p><strong>关键技术</strong>包括：</p>
<img data-src="https://example.com/img.jpg" />
<section><p>更多内容。#人工智能 #深度学习</p></section>
</div></div>
</body></html>`);

  writeFileSync(join(TMP, '笔记.md'), `# 读书笔记
这是一篇读书笔记。
#阅读 #感想
`);
});

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe('WeChat Importer', () => {
  it('should import HTML and MD files', async () => {
    const pages = await importWechat({ dir: TMP });
    expect(pages.length).toBe(2);
  });

  it('should extract title from og:title', async () => {
    const pages = await importWechat({ dir: TMP });
    const article = pages.find(p => p.source === '文章一.html');
    expect(article?.title).toBe('AI 时代的思考');
  });

  it('should clean WeChat HTML', async () => {
    const pages = await importWechat({ dir: TMP });
    const article = pages.find(p => p.source === '文章一.html');
    expect(article?.body).toContain('AI 正在改变世界');
    expect(article?.body).toContain('**关键技术**');
    expect(article?.body).not.toContain('<script>');
    expect(article?.body).not.toContain('<div');
  });

  it('should extract WeChat data-src images', async () => {
    const pages = await importWechat({ dir: TMP });
    const article = pages.find(p => p.source === '文章一.html');
    expect(article?.body).toContain('https://example.com/img.jpg');
  });

  it('should extract metadata (author, publish_time)', async () => {
    const pages = await importWechat({ dir: TMP });
    const article = pages.find(p => p.source === '文章一.html');
    expect(article?.metadata.source_platform).toBe('wechat');
    expect(article?.metadata.published_at).toBe('2026-04-01');
  });

  it('should extract Chinese tags', async () => {
    const pages = await importWechat({ dir: TMP });
    const article = pages.find(p => p.source === '文章一.html');
    expect(article?.tags).toContain('深度学习');
    expect(article?.tags.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle markdown files', async () => {
    const pages = await importWechat({ dir: TMP });
    const note = pages.find(p => p.source === '笔记.md');
    expect(note?.title).toBe('读书笔记');
    expect(note?.tags).toContain('阅读');
  });
});
