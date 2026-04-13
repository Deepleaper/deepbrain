import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { importFeishu } from '../src/import/feishu.js';

const TMP = join(process.cwd(), 'tmp-test-feishu');

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });

  writeFileSync(join(TMP, '会议纪要.md'), `# 会议纪要

<!-- Feishu export comment -->

@[张三](feishu://user/123) 提到了以下问题：

[x] 完成设计评审
[ ] 提交代码

## 讨论要点
- #技术架构 相关
- 性能优化方案
`);

  writeFileSync(join(TMP, '产品规划.md'), `# 产品规划
Q2 产品 Roadmap。
`);
});

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe('Feishu Importer', () => {
  it('should import markdown files', async () => {
    const pages = await importFeishu({ dir: TMP });
    expect(pages.length).toBe(2);
  });

  it('should extract title', async () => {
    const pages = await importFeishu({ dir: TMP });
    const meeting = pages.find(p => p.source === '会议纪要.md');
    expect(meeting?.title).toBe('会议纪要');
  });

  it('should clean HTML comments', async () => {
    const pages = await importFeishu({ dir: TMP });
    const meeting = pages.find(p => p.source === '会议纪要.md');
    expect(meeting?.body).not.toContain('<!--');
  });

  it('should convert @mentions to plain text', async () => {
    const pages = await importFeishu({ dir: TMP });
    const meeting = pages.find(p => p.source === '会议纪要.md');
    expect(meeting?.body).toContain('@张三');
    expect(meeting?.body).not.toContain('feishu://');
  });

  it('should convert checkboxes', async () => {
    const pages = await importFeishu({ dir: TMP });
    const meeting = pages.find(p => p.source === '会议纪要.md');
    expect(meeting?.body).toContain('☑');
    expect(meeting?.body).toContain('☐');
  });

  it('should extract Chinese tags', async () => {
    const pages = await importFeishu({ dir: TMP });
    const meeting = pages.find(p => p.source === '会议纪要.md');
    expect(meeting?.tags).toContain('技术架构');
  });

  it('should set source_platform to feishu', async () => {
    const pages = await importFeishu({ dir: TMP });
    expect(pages[0].metadata.source_platform).toBe('feishu');
  });
});
