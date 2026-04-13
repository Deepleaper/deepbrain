import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { importShimo } from '../src/import/shimo.js';

const TMP = join(process.cwd(), 'tmp-test-shimo');

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });

  writeFileSync(join(TMP, '项目计划.html'), `<html>
<head><title>项目计划书</title></head>
<body>
<h1>项目计划</h1>
<p>这是一份<strong>重要的</strong>项目计划。</p>
<ul><li>第一步</li><li>第二步</li></ul>
<blockquote>注意事项</blockquote>
<p>使用 #敏捷开发 方法。</p>
</body></html>`);

  writeFileSync(join(TMP, '笔记.md'), `# 学习笔记
## 今日要点
- 学习了 TypeScript
- #学习 #编程
`);
});

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe('Shimo Importer', () => {
  it('should import HTML and MD files', async () => {
    const pages = await importShimo({ dir: TMP });
    expect(pages.length).toBe(2);
  });

  it('should convert HTML to markdown', async () => {
    const pages = await importShimo({ dir: TMP });
    const plan = pages.find(p => p.source === '项目计划.html');
    expect(plan?.body).toContain('# 项目计划');
    expect(plan?.body).toContain('**重要的**');
    expect(plan?.body).toContain('- 第一步');
    expect(plan?.body).toContain('> 注意事项');
  });

  it('should extract title from HTML', async () => {
    const pages = await importShimo({ dir: TMP });
    const plan = pages.find(p => p.source === '项目计划.html');
    expect(plan?.title).toBe('项目计划书');
  });

  it('should extract Chinese tags from HTML content', async () => {
    const pages = await importShimo({ dir: TMP });
    const plan = pages.find(p => p.source === '项目计划.html');
    expect(plan?.tags).toContain('敏捷开发');
  });

  it('should handle markdown passthrough', async () => {
    const pages = await importShimo({ dir: TMP });
    const note = pages.find(p => p.source === '笔记.md');
    expect(note?.title).toBe('学习笔记');
    expect(note?.tags).toContain('学习');
    expect(note?.tags).toContain('编程');
  });

  it('should set source_platform to shimo', async () => {
    const pages = await importShimo({ dir: TMP });
    expect(pages[0].metadata.source_platform).toBe('shimo');
  });
});
