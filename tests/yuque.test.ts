import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { importYuque } from '../src/import/yuque.js';

const TMP = join(process.cwd(), 'tmp-test-yuque');

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
  mkdirSync(join(TMP, 'sub'), { recursive: true });

  writeFileSync(join(TMP, '基础概念.md'), `---
title: 基础概念
tags: [AI, 入门]
---
# 基础概念

:::tips
这是一个提示
:::

AI 是人工智能的缩写。

<a name="section1"></a>

## 详细说明
使用 #机器学习 技术。
`);

  writeFileSync(join(TMP, 'sub', '高级主题.md'), `# 高级主题
深度学习是 AI 的子领域。
`);

  writeFileSync(join(TMP, 'data.lakebook'), JSON.stringify({
    docs: [
      { title: '文档一', slug: 'doc-1', body: '# 文档一\n这是文档内容', tags: ['语雀'] },
      { title: '文档二', slug: 'doc-2', body: '# 文档二\n这是第二篇', tags: [] },
    ],
  }));
});

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe('Yuque Importer', () => {
  it('should import markdown files', async () => {
    const pages = await importYuque({ dir: TMP });
    const mdPages = pages.filter(p => p.source.endsWith('.md'));
    expect(mdPages.length).toBe(2);
  });

  it('should extract title from H1', async () => {
    const pages = await importYuque({ dir: TMP });
    const basic = pages.find(p => p.source === '基础概念.md');
    expect(basic?.title).toBe('基础概念');
  });

  it('should extract tags from frontmatter', async () => {
    const pages = await importYuque({ dir: TMP });
    const basic = pages.find(p => p.source === '基础概念.md');
    expect(basic?.tags).toContain('AI');
    expect(basic?.tags).toContain('入门');
  });

  it('should extract inline Chinese tags', async () => {
    const pages = await importYuque({ dir: TMP });
    const basic = pages.find(p => p.source === '基础概念.md');
    expect(basic?.tags).toContain('机器学习');
  });

  it('should clean Yuque admonitions', async () => {
    const pages = await importYuque({ dir: TMP });
    const basic = pages.find(p => p.source === '基础概念.md');
    expect(basic?.body).not.toContain(':::tips');
    expect(basic?.body).toContain('提示');
  });

  it('should remove Yuque anchor tags', async () => {
    const pages = await importYuque({ dir: TMP });
    const basic = pages.find(p => p.source === '基础概念.md');
    expect(basic?.body).not.toContain('<a name=');
  });

  it('should parse lakebook format', async () => {
    const pages = await importYuque({ dir: TMP });
    const lakebook = pages.filter(p => p.source === 'data.lakebook');
    expect(lakebook.length).toBe(2);
    expect(lakebook[0].title).toBe('文档一');
    expect(lakebook[0].tags).toContain('语雀');
  });

  it('should handle nested directories with prefix', async () => {
    const pages = await importYuque({ dir: TMP });
    const sub = pages.find(p => p.source.includes('sub'));
    expect(sub?.slug).toContain('sub/');
  });

  it('should set source_platform to yuque', async () => {
    const pages = await importYuque({ dir: TMP });
    expect(pages[0].metadata.source_platform).toBe('yuque');
  });

  it('should call onProgress', async () => {
    let called = 0;
    await importYuque({ dir: TMP, onProgress: () => called++ });
    expect(called).toBeGreaterThan(0);
  });
});
