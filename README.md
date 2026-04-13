# 🧠 DeepBrain

> Personal AI brain. Store, search, and grow your knowledge.
>
> 个人 AI 知识大脑。存储、搜索、生长你的知识。

[![npm](https://img.shields.io/npm/v/deepbrain)](https://www.npmjs.com/package/deepbrain)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-43%20passed-brightgreen)](https://github.com/Magicray1217/deepbrain)

[English](#english) | [中文](#中文)

---

<a id="english"></a>

## English

**DeepBrain** is a personal knowledge engine inspired by [GBrain](https://github.com/garrytan/gbrain), rebuilt from scratch with:

- 🔌 **Multi-provider** — 7 embedding providers via [agentkits](https://github.com/Magicray1217/agentkits)
- 🇨🇳 **Chinese-friendly** — DeepSeek, DashScope (Qwen), Zhipu (GLM) built-in
- 🏠 **Local-first** — Ollama + PGLite, zero cloud dependency
- ⚡ **Lightweight** — No bloat, just the essentials
- 🔍 **Hybrid search** — Vector (HNSW) + keyword (tsvector) + RRF fusion
- 📊 **Compiled Truth + Timeline** — Current facts vs. historical events
- 🔗 **Knowledge graph** — Bidirectional links between pages
- 💤 **Dream Cycle** — Automated knowledge maintenance
- 🔌 **MCP Server** — 12 tools for Claude / Cursor / OpenClaw
- 📥 **Import** — Notion & Obsidian vault importer

## Quick Start

```bash
# Install
npm install -g deepbrain

# Initialize with your preferred provider
deepbrain init ollama          # Local, free
deepbrain init deepseek        # Cheap, fast
deepbrain init gemini          # Free tier available

# Add knowledge
deepbrain put meeting-notes notes.md
deepbrain put "john-doe" "John is a senior engineer at Google."

# Search
deepbrain query "who knows about distributed systems?"
deepbrain search "Google engineer"

# Import from Notion / Obsidian
deepbrain import notion ./notion-export/
deepbrain import obsidian ~/my-vault/

# Link & Timeline
deepbrain link john-doe google-company
deepbrain timeline john-doe "Promoted to Staff Engineer"

# Stats & maintenance
deepbrain stats
deepbrain dream
```

## Programmatic API

```ts
import { Brain, importNotion, importObsidian } from 'deepbrain';

const brain = new Brain({
  embedding_provider: 'deepseek',
  api_key: process.env.DEEPSEEK_API_KEY,
});
await brain.connect();

// Store
await brain.put('ray', {
  type: 'person',
  title: 'Ray Wang',
  compiled_truth: 'CEO of Deepleaper. Expert in AI agents.',
});

// Semantic search
const results = await brain.query('who builds AI agents?');

// Import from Notion
const result = await importNotion(brain, './notion-export/');
console.log(`Imported ${result.imported} pages`);

// Import from Obsidian (auto-converts [[wikilinks]] to links)
const obsResult = await importObsidian(brain, '~/my-vault/');
console.log(`Imported ${obsResult.imported} pages`);

await brain.disconnect();
```

## Providers

| Provider | Env Var | Free? | Best For |
|----------|---------|-------|----------|
| 🏠 Ollama | — | ✅ Yes | Local, privacy-first |
| 🔥 DeepSeek | `DEEPSEEK_API_KEY` | Cheap | Best value |
| 💎 Gemini | `GEMINI_API_KEY` | Free tier | Google ecosystem |
| 🟢 OpenAI | `OPENAI_API_KEY` | No | Quality benchmark |
| ☁️ DashScope | `DASHSCOPE_API_KEY` | Free tier | China (Alibaba/Qwen) |
| 🔮 Zhipu | `ZHIPU_API_KEY` | Free tier | China (GLM) |
| ⚙️ Custom | — | — | Any OpenAI-compatible |

## Import

### Notion

Supports: Markdown export, HTML export, CSV database export.

```bash
# Export from Notion: Settings → Export → Markdown & CSV
deepbrain import notion ./notion-export/
```

```ts
import { importNotion } from 'deepbrain';
const result = await importNotion(brain, './notion-export/', {
  prefix: 'notion/',     // namespace slugs
  type: 'note',          // override type
  dryRun: true,          // preview without importing
  onProgress: (i, total, file) => console.log(`${i}/${total}: ${file}`),
});
```

### Obsidian

Supports: Markdown, [[wikilinks]] → links, #tags, YAML frontmatter, nested folders, Chinese tags.

```bash
deepbrain import obsidian ~/my-vault/
```

```ts
import { importObsidian } from 'deepbrain';
const result = await importObsidian(brain, '~/my-vault/', {
  convertLinks: true,     // [[wikilinks]] → brain links (default)
  importTags: true,       // #inline-tags (default)
  ignoreFolders: ['.obsidian', '.trash'],
});
```

## MCP Server (Claude / Cursor / OpenClaw)

DeepBrain ships with a built-in MCP server. Your AI assistant can read/write your brain directly.

```json
{
  "mcpServers": {
    "deepbrain": {
      "command": "deepbrain-mcp",
      "env": { "DEEPBRAIN_CONFIG": "/path/to/deepbrain.json" }
    }
  }
}
```

### 12 MCP Tools

| Tool | Description |
|------|-------------|
| `brain_put` | Store or update knowledge |
| `brain_get` | Read a specific page |
| `brain_query` | Semantic search (hybrid) |
| `brain_search` | Keyword search |
| `brain_link` | Create link between pages |
| `brain_unlink` | Remove link |
| `brain_tag` | Tag a page |
| `brain_timeline` | Add timeline entry |
| `brain_stats` | Brain statistics |
| `brain_list` | List all pages |
| `brain_delete` | Delete a page |
| `brain_dream` | Run Dream Cycle |

## How It Works

```
Knowledge → Pages (Markdown) → Chunks → Embeddings → Vector DB (PGLite)
               ↓                                        ↓
            Links (Graph)                         Hybrid Search
               ↓                                (HNSW + tsvector + RRF)
           Timeline (append-only)                      ↓
               ↓                                   Results
         Dream Cycle (maintenance)
```

### vs. GBrain

| | GBrain | DeepBrain |
|---|--------|-----------|
| Embedding | OpenAI only | 7 providers |
| Page types | 9 hardcoded | User-defined |
| Chinese | ❌ | ✅ Built-in |
| Local-first | ❌ | ✅ Ollama |
| MCP | ❌ | ✅ 12 tools |
| Import | ❌ | ✅ Notion + Obsidian |
| Install | Complex | `npm i -g deepbrain` |
| Tests | — | 43 tests |

## Roadmap

- [x] Core engine (CRUD, search, graph, timeline)
- [x] Hybrid search (vector + keyword + RRF)
- [x] CLI
- [x] Dream Cycle v1
- [x] Multi-provider embedding (via agentkits)
- [x] MCP Server (12 tools)
- [x] Notion importer
- [x] Obsidian importer
- [x] 43 tests (brain, dream, import, types)
- [ ] Web UI (knowledge graph visualization)
- [ ] Import from WeChat / Feishu
- [ ] MRG layer (mission-centric knowledge graph)
- [ ] Smart chunking (semantic + LLM-assisted)
- [ ] Multi-brain sync

---

<a id="中文"></a>

## 中文文档

**DeepBrain** 是一个个人 AI 知识大脑，灵感来自 [GBrain](https://github.com/garrytan/gbrain)，从零重建，特点：

- 🔌 **多模型支持** — 7 个 Embedding 提供商，通过 [agentkits](https://github.com/Magicray1217/agentkits)
- 🇨🇳 **中文友好** — 内置 DeepSeek、通义千问 (DashScope)、智谱 (GLM)
- 🏠 **本地优先** — Ollama + PGLite，零云端依赖
- ⚡ **轻量** — 无臃肿依赖，只保留核心功能
- 🔍 **混合搜索** — 向量 (HNSW) + 关键词 (tsvector) + RRF 融合排序
- 📊 **编译真相 + 时间线** — 当前事实 vs. 历史事件，分开管理
- 🔗 **知识图谱** — 页面间双向链接
- 💤 **梦境循环** — 自动化知识库维护（清理孤页、刷新过期嵌入）
- 🔌 **MCP 服务器** — 12 个工具，让 Claude / Cursor 直接读写你的知识库
- 📥 **导入** — 支持 Notion 和 Obsidian 笔记库

### 快速上手

```bash
# 安装
npm install -g deepbrain

# 初始化（选一个你喜欢的模型）
deepbrain init ollama          # 本地运行，免费
deepbrain init deepseek        # 便宜又快
deepbrain init gemini          # 有免费额度

# 存入知识
deepbrain put 会议纪要 notes.md
deepbrain put "张三" "张三是谷歌的资深工程师，擅长分布式系统。"

# 搜索
deepbrain query "谁懂分布式系统？"
deepbrain search "谷歌工程师"

# 从 Notion / Obsidian 导入
deepbrain import notion ./notion-export/
deepbrain import obsidian ~/my-vault/

# 关联与时间线
deepbrain link 张三 谷歌
deepbrain timeline 张三 "晋升为 Staff Engineer"

# 统计与维护
deepbrain stats
deepbrain dream
```

### 编程接口

```ts
import { Brain, importNotion, importObsidian } from 'deepbrain';

const brain = new Brain({
  embedding_provider: 'deepseek',    // 或 'ollama', 'gemini', 'dashscope', 'zhipu'
  api_key: process.env.DEEPSEEK_API_KEY,
});
await brain.connect();

// 存入
await brain.put('ray', {
  type: 'person',
  title: '王冉',
  compiled_truth: '跃盟科技 CEO，AI 情景智能专家。',
});

// 语义搜索
const results = await brain.query('谁做 AI Agent？');
console.log(results[0].slug); // → 'ray'

// 从 Notion 导入
const result = await importNotion(brain, './notion-export/');
console.log(`导入了 ${result.imported} 页`);

// 从 Obsidian 导入（自动将 [[双链]] 转为知识图谱链接）
const obsResult = await importObsidian(brain, '~/my-vault/');
console.log(`导入了 ${obsResult.imported} 页`);

await brain.disconnect();
```

### 支持的模型

| 提供商 | 环境变量 | 免费？ | 适合场景 |
|--------|----------|--------|----------|
| 🏠 Ollama | — | ✅ 完全免费 | 本地运行、隐私优先 |
| 🔥 DeepSeek | `DEEPSEEK_API_KEY` | 极便宜 | 性价比最高 |
| 💎 Gemini | `GEMINI_API_KEY` | 有免费额度 | Google 生态 |
| 🟢 OpenAI | `OPENAI_API_KEY` | 付费 | 质量标杆 |
| ☁️ 通义千问 | `DASHSCOPE_API_KEY` | 有免费额度 | 国内首选（阿里云） |
| 🔮 智谱 GLM | `ZHIPU_API_KEY` | 有免费额度 | 国内首选（智谱 AI） |
| ⚙️ 自定义 | — | — | 任何 OpenAI 兼容 API |

### 导入功能

**从 Notion 导入：**
1. Notion → 设置 → 导出 → Markdown & CSV 格式
2. `deepbrain import notion ./导出目录/`
3. 支持 Markdown、HTML、CSV 三种格式

**从 Obsidian 导入：**
1. `deepbrain import obsidian ~/我的知识库/`
2. 自动将 `[[双链]]` 转为知识图谱链接
3. 自动提取 `#标签`（支持中文标签如 `#人工智能`）
4. 解析 YAML frontmatter
5. 忽略 `.obsidian` 等系统目录

### MCP 服务器

让 Claude / Cursor / OpenClaw 直接读写你的知识库：

```json
{
  "mcpServers": {
    "deepbrain": {
      "command": "deepbrain-mcp"
    }
  }
}
```

配置好后，你可以直接对 Claude 说：

> **你：** 我关于 Ray 知道什么？
>
> **Claude：** *调用 brain_query("Ray")* → 找到：王冉，跃盟科技 CEO，AI 情景智能专家。
>
> **你：** 记录一下他昨天在 AI 峰会上做了演讲。
>
> **Claude：** *调用 brain_timeline("ray", "AI 峰会演讲")* → ✅ 已添加到时间线。

### 核心概念

| 概念 | 说明 |
|------|------|
| **页面 (Page)** | 一个知识单元（人物、公司、笔记，任何东西） |
| **编译真相 (Compiled Truth)** | 当前事实 — 可覆盖更新 |
| **时间线 (Timeline)** | 历史事件 — 只能追加，不可修改 |
| **分块 (Chunk)** | 页面拆分成可嵌入的小片段 |
| **链接 (Link)** | 页面间双向关系 |
| **标签 (Tag)** | 用于过滤的标签 |
| **梦境循环 (Dream Cycle)** | 自动维护（刷新过期嵌入、清理孤页、修复死链） |

### 与 GBrain 对比

| | GBrain | DeepBrain |
|---|--------|-----------|
| Embedding | 仅 OpenAI | 7 个提供商 |
| 页面类型 | 9 种硬编码 | 用户自定义 |
| 中文支持 | ❌ | ✅ 内置 |
| 本地运行 | ❌（需 API key） | ✅ Ollama |
| MCP | ❌ | ✅ 12 个工具 |
| 导入 | ❌ | ✅ Notion + Obsidian |
| 安装 | 复杂 | `npm i -g deepbrain` |
| 测试 | — | 43 个测试 |

---

## Architecture / 架构

```
deepbrain
├── src/
│   ├── index.ts         # 主入口
│   ├── cli.ts           # CLI 命令行工具
│   ├── mcp.ts           # MCP 服务器 (12 tools)
│   ├── core/
│   │   ├── brain.ts     # 核心引擎 (CRUD + 搜索 + 图谱)
│   │   ├── schema.ts    # PGLite 数据库 schema
│   │   └── types.ts     # TypeScript 类型定义
│   ├── dream/
│   │   └── index.ts     # 梦境循环 (自动维护)
│   └── import/
│       ├── index.ts     # 导入模块入口
│       ├── notion.ts    # Notion 导入器
│       └── obsidian.ts  # Obsidian 导入器
├── tests/               # 43 个测试
├── package.json
└── tsconfig.json
```

## License / 开源协议

MIT © [Magicray1217](https://github.com/Magicray1217)

---

*灵感来自 [GBrain](https://github.com/garrytan/gbrain) by Garry Tan。基于 [AgentKits](https://github.com/Magicray1217/agentkits) 构建。*
