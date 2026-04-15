# 🧠 DeepBrain

> Your personal AI knowledge brain. Import everything, find anything.
>
> 你的个人 AI 知识大脑。导入一切，找到一切。
>
> **[📖 中文文档 / Chinese Documentation](README.zh-CN.md)**

[![npm](https://img.shields.io/npm/v/deepbrain)](https://www.npmjs.com/package/deepbrain)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-73%2F73%20passed-brightgreen)](https://github.com/Magicray1217/deepbrain)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)

[English](#english) | [中文](#中文)

---

<a id="english"></a>

## The Problem

You have knowledge scattered everywhere — Notion, Obsidian, Evernote, Flomo, Feishu, WeChat articles, PDFs, EPUBs. When you need to find something, you have to remember *where* you put it.

**DeepBrain** brings everything into one place, understands it with AI, and lets you search across *all* your knowledge with natural language.

## What Makes It Different

| Feature | DeepBrain | Notion AI | Obsidian + Copilot | IMA |
|---------|-----------|-----------|-------------------|-----|
| Import sources | **21 platforms** | Notion only | Obsidian only | WeChat only |
| Export | **5 formats** | PDF only | N/A | None |
| Self-hosted | **Yes (local-first)** | No | Partial | No |
| Open source | **MIT** | No | Plugin only | No |
| Chinese platforms | **8 (语雀/飞书/石墨/Flomo/...)** | No | No | WeChat only |
| AI provider | **7 providers, your choice** | OpenAI only | OpenAI only | 混元 only |
| Data ownership | **100% yours** | Notion's servers | Local files | Tencent's servers |
| Tag Graph | **Auto-relationship discovery** | Manual | Manual | No |
| MCP integration | **12 tools** | No | Plugin | No |

## Quick Start

### Install

```bash
npm install -g deepbrain
```

### Initialize with your preferred AI provider

```bash
# Google Gemini (recommended — free tier available)
deepbrain init gemini

# Local with Ollama (zero cost, zero cloud)
deepbrain init ollama

# Chinese providers
deepbrain init dashscope    # 阿里通义千问
deepbrain init deepseek     # DeepSeek
deepbrain init zhipu        # 智谱 GLM
```

### Add your first knowledge

```bash
deepbrain put my-first-note "# Hello Brain
I learned that AI agents work best with structured knowledge bases.
Tags: #AI #agents #knowledge"

deepbrain put meeting-notes "# Team Meeting 2026-04-13
- Decided to use TypeScript for the new API
- Deadline: end of month
- Action: Ray to review architecture doc"
```

### Search with natural language

```bash
deepbrain query "what did we decide about the API?"
# → Returns: meeting-notes (score: 0.89)
#   "Decided to use TypeScript for the new API..."

deepbrain query "what do I know about AI?"
# → Returns: my-first-note (score: 0.92)
#   "AI agents work best with structured knowledge bases..."
```

### Open Web UI

```bash
deepbrain serve
# → 🧠 DeepBrain Web UI running at http://localhost:3000
```

---

## 📥 Import from Anywhere (21 Sources)

The most comprehensive importer coverage in the open-source ecosystem.

### One command to import

```bash
# Import your Obsidian vault
deepbrain import obsidian ./my-vault

# Import Notion export
deepbrain import notion ./notion-export

# Import Evernote
deepbrain import evernote ./my-notes.enex
```

### Or use the API

```ts
import { importNotion, importObsidian, importFlomo, importWechat } from 'deepbrain';

// Import with progress tracking
const pages = await importObsidian({
  dir: './my-vault',
  onProgress: (current, total, name) => {
    console.log(`[${current}/${total}] ${name}`);
  },
});
console.log(`Imported ${pages.length} pages`);
```

### Supported platforms

**International** (12): Notion · Obsidian · Evernote · Roam Research · Logseq · Bear · Apple Notes · Google Keep · OneNote · Joplin · Readwise · Day One

**Chinese** (8): 语雀 · 飞书 · 石墨 · 微信公众号 · Flomo · 我来(Wolai) · 息流(FlowUs) · 思源笔记

**Formats** (2): EPUB · PDF

Each importer handles platform-specific quirks:
- Obsidian: `[[wikilinks]]`, `#nested/tags`, YAML frontmatter
- Evernote: ENML→Markdown, checkbox conversion
- Roam: `[[page refs]]`, `((block refs))`, TODO/DONE
- Flomo: `#tag/subtag` hierarchy, memo timestamps
- 微信: `js_content` extraction, `og:title` parsing

---

## 📤 Export (5 Formats)

Your data is yours. Export anytime, anywhere.

```bash
deepbrain export --format markdown --output ./backup
deepbrain export --format obsidian --output ./my-vault     # Open with Obsidian
deepbrain export --format logseq --output ./my-graph       # Open with Logseq
deepbrain export --format json --output ./data.json        # For programmatic use
deepbrain export --format html --output ./site             # Static website
```

---

## 🏷️ Tag Graph — Knowledge Auto-Discovery

This is where DeepBrain goes beyond simple search. Tags aren't just labels — they form a **knowledge graph** that automatically discovers relationships.

### Hierarchical tags

```bash
deepbrain tag my-note "AI/Agent/RAG"
# Automatically creates: AI → AI/Agent → AI/Agent/RAG
```

### Auto-recommendations

```ts
import { Brain, TagGraph } from 'deepbrain';

const brain = new Brain({ embedding_provider: 'gemini', api_key: 'AIza...' });
await brain.connect();
const tg = new TagGraph(brain);

// "What else should I read based on this page?"
const related = await tg.recommend('my-note', 5);
// → [{ slug: 'agent-design', title: 'Agent Design Patterns', score: 0.78, sharedTags: ['AI', 'AI/Agent'] }]

// "What tags should this page have?"
const suggested = await tg.suggestTags('untitled-note');
// → ['TypeScript', 'API', 'architecture']

// "Show me the full tag landscape"
const graph = await tg.getGraph();
// → { nodes: [...], edges: [...], stats: { totalTags: 42, mostConnected: 'AI' } }

// "Group my knowledge into clusters"
const clusters = await tg.cluster();
// → [{ name: 'AI', tags: ['AI', 'LLM', 'Agent'], pages: [...], size: 15 }]
```

### Tag operations

```ts
// Rename across all pages
await tg.renameTag('machine-learning', 'ML');

// Merge duplicates
await tg.mergeTags(['js', 'javascript', 'JS'], 'JavaScript');

// Find lonely tags (only 1 page)
const orphans = await tg.findOrphanTags();
```

---

## 🔍 Hybrid Search

Not just vector similarity. DeepBrain combines three search strategies:

| Strategy | How it works | Best for |
|----------|-------------|----------|
| **Vector search** | Embedding similarity (HNSW) | "things related to X" |
| **Keyword search** | PostgreSQL tsvector | Exact terms, names, codes |
| **RRF fusion** | Reciprocal Rank Fusion | Best of both worlds |

```ts
// Semantic: finds conceptually related content
const results = await brain.query('how to build AI agents');

// Keyword: exact match
const results2 = await brain.search('TypeScript');
```

---

## 📊 Dual-Track Storage

Every piece of knowledge has two components:

| Track | What it stores | Behavior |
|-------|---------------|----------|
| **Compiled Truth** | Current facts | Overwritten on update |
| **Timeline** | Historical events | Append-only, never deleted |

```ts
// Store current facts (overwritable)
await brain.put({
  slug: 'project-alpha',
  type: 'project',
  title: 'Project Alpha',
  compiled_truth: 'Status: In Progress. Team: 5 people. Stack: TypeScript + React.',
});

// Add historical events (append-only)
await brain.addTimeline('project-alpha', {
  date: '2026-04-01',
  content: 'Project kickoff meeting',
});
await brain.addTimeline('project-alpha', {
  date: '2026-04-13',
  content: 'First prototype delivered',
});
```

---

## 🔌 MCP Server — Connect to AI Assistants

Works with Claude Desktop, Cursor, OpenClaw, and any MCP-compatible client:

```bash
deepbrain-mcp
```

**12 tools available:**

| Tool | What it does |
|------|-------------|
| `put` | Add/update knowledge |
| `get` | Read a specific page |
| `query` | Semantic search |
| `search` | Keyword search |
| `link` / `unlink` | Manage knowledge links |
| `get-links` | See related pages |
| `timeline-add` | Record events |
| `get-timeline` | Read history |
| `list` | Browse all pages |
| `stats` | Knowledge base stats |
| `dream` | Run maintenance |

---

## 🌐 Web UI

Built-in browser interface — no separate frontend:

```bash
deepbrain serve --port 3000
```

Pages:
- **📚 /pages** — Browse all knowledge
- **🔍 /search** — Semantic + keyword search
- **🏷️ /tags** — Tag cloud, tree, graph
- **📊 /stats** — Knowledge base statistics

API endpoints:
- `GET /api/pages` — List all pages (JSON)
- `GET /api/search?q=...` — Search (JSON)
- `GET /api/tags` — Full tag graph (JSON)
- `GET /api/tags/tree` — Tag hierarchy (JSON)
- `GET /api/tags/recommend?slug=...` — Related pages (JSON)
- `GET /api/tags/clusters` — Knowledge clusters (JSON)

---

## 💤 Dream Cycle — Self-Maintaining Knowledge

Your brain maintenance runs on autopilot:

```bash
deepbrain dream
```

```
🧠 DeepBrain Health Report
   Pages: 156
   Chunks: 892 (890 embedded)
   Links: 234
   Tags: 67
   Timeline entries: 412
   ⚠️  2 chunks missing embeddings — re-embedding...
   ⚠️  3 orphan chunks found — cleaning up...
   ✅ Health check complete
```

---

## ✂️ Browser Clipper

Save any web page to your brain:

```ts
import { generateBookmarklet } from 'deepbrain';

const code = generateBookmarklet('http://localhost:3000');
// Drag to bookmark bar → click on any page → saved
```

---

## 🏗️ Architecture

```
deepbrain/
├── core/          # 🧠 Brain engine (PGLite + pgvector)
│   ├── brain.ts   #    CRUD, search, links, tags, timeline
│   ├── schema.ts  #    Database schema
│   └── types.ts   #    TypeScript interfaces
├── import/        # 📥 21 importers
├── export/        # 📤 5 export formats
├── tag-graph/     # 🏷️ Tag relationship engine
├── web/           # 🌐 Built-in Web UI + API
├── clipper/       # ✂️ Browser clipper
├── dream/         # 💤 Automated maintenance
├── mcp/           # 🔌 MCP server (12 tools)
└── cli            # 🖥️ Command-line interface
```

**Stack:** TypeScript · PGLite (in-process PostgreSQL) · pgvector · [agentkits](https://github.com/Magicray1217/agentkits) (multi-provider AI)

**Design principles:**
- **Local-first** — Everything runs in-process. No external database, no cloud dependency.
- **Provider-agnostic** — 7 embedding providers. Switch with one config change.
- **Import everything, lock in nothing** — 21 importers in, 5 export formats out.
- **Knowledge grows** — Tag Graph discovers relationships automatically. Dream Cycle maintains health.

---

## CLI Reference

```bash
deepbrain init <provider>              # Initialize brain
deepbrain put <slug> <body>            # Add/update page
deepbrain get <slug>                   # Read page
deepbrain query <text>                 # Semantic search
deepbrain search <keyword>             # Keyword search
deepbrain tag <slug> <tag>             # Add tag
deepbrain link <from> <to>             # Create link
deepbrain timeline <slug> <date> <text> # Add timeline entry
deepbrain list [--type note]           # List pages
deepbrain stats                        # Show statistics
deepbrain dream                        # Run maintenance
deepbrain serve [--port 3000]          # Start Web UI
deepbrain export --format <fmt> --output <dir>  # Export
```

---

## 📄 License

MIT © [Magicray1217](https://github.com/Magicray1217)

---

<a id="中文"></a>

## 中文文档

### 问题

你的知识散落在各处——Notion、Obsidian、Evernote、Flomo、飞书、语雀、微信公众号、PDF……当你需要找某个东西时，你得先想起来**放在哪了**。

**DeepBrain** 把所有知识汇集到一处，用 AI 理解它们，让你用自然语言搜索**全部知识**。

### 为什么选 DeepBrain

| 特性 | DeepBrain | Notion AI | IMA(腾讯) |
|------|-----------|-----------|----------|
| 导入来源 | **21 个平台** | 只有 Notion | 只有微信 |
| 导出 | **5 种格式** | 只有 PDF | 无 |
| 自托管 | **✅ 本地运行** | ❌ | ❌ |
| 开源 | **MIT** | ❌ | ❌ |
| 中文平台 | **8 个** | 0 | 1 |
| AI 提供商 | **7 个，你选** | 只有 OpenAI | 只有混元 |
| 数据归属 | **100% 你的** | Notion 服务器 | 腾讯服务器 |
| 标签图谱 | **自动关系发现** | 手动 | 无 |
| MCP 集成 | **12 个工具** | 无 | 无 |

---

### ⚡ 快速上手

```bash
# 安装
npm install -g deepbrain

# 初始化（选你喜欢的 AI 提供商）
deepbrain init gemini       # Google Gemini（推荐，有免费额度）
deepbrain init ollama       # 本地运行，零费用
deepbrain init dashscope    # 阿里通义千问
deepbrain init deepseek     # DeepSeek

# 写入你的第一条知识
deepbrain put 第一条笔记 "# 你好，大脑！
AI Agent 需要结构化的知识库才能工作得好。
标签: #AI #Agent #知识库"

# 用自然语言搜索
deepbrain query "AI Agent 需要什么？"
# → 返回: 第一条笔记 (score: 0.92)

# 打开 Web 界面
deepbrain serve
# → 🧠 http://localhost:3000
```

---

### 📥 从任何平台导入（21 个数据源）

**开源生态中覆盖最全的知识导入器。**

```bash
# 导入 Obsidian 笔记库
deepbrain import obsidian ./my-vault

# 导入 Notion 导出
deepbrain import notion ./notion-export

# 导入 Evernote
deepbrain import evernote ./my-notes.enex
```

```ts
import { importFlomo, importWechat, importObsidian } from 'deepbrain';

// 导入 Flomo（带进度）
const memos = await importFlomo({
  file: './flomo-export.html',
  onProgress: (current, total, name) => console.log(`[${current}/${total}] ${name}`),
});
console.log(`导入了 ${memos.length} 条 memo`);
```

#### 支持的平台

**国际**: Notion · Obsidian · Evernote · Roam Research · Logseq · Bear · Apple Notes · Google Keep · OneNote · Joplin · Readwise · Day One

**国内**: 语雀 · 飞书 · 石墨 · 微信公众号 · Flomo · 我来(Wolai) · 息流(FlowUs) · 思源笔记

**格式**: EPUB · PDF

每个导入器处理平台特有的格式：
- Obsidian: `[[双向链接]]`、`#嵌套/标签`、YAML frontmatter
- Evernote: ENML→Markdown、checkbox 转换
- Flomo: `#标签/子标签` 层级、memo 时间戳
- 微信公众号: `js_content` 提取、`og:title` 解析
- 语雀: Admonition 清理、lakebook 格式

---

### 📤 导出（5 种格式）

数据是你的，随时带走：

```bash
deepbrain export --format markdown --output ./备份
deepbrain export --format obsidian --output ./我的笔记库     # 直接用 Obsidian 打开
deepbrain export --format logseq --output ./我的图谱         # 直接用 Logseq 打开
deepbrain export --format json --output ./data.json          # 程序处理用
deepbrain export --format html --output ./网站               # 静态网站
```

---

### 🏷️ 标签图谱 — 知识自动关联

标签不只是标记，它们构成了一张**知识关系图**，自动发现知识之间的联系。

```ts
import { Brain, TagGraph } from 'deepbrain';

const brain = new Brain({ embedding_provider: 'gemini', api_key: 'AIza...' });
await brain.connect();
const tg = new TagGraph(brain);

// "基于这篇笔记，我还应该看什么？"
const related = await tg.recommend('我的笔记', 5);
// → [{ slug: 'agent-设计', title: 'Agent 设计模式', score: 0.78, sharedTags: ['AI', 'AI/Agent'] }]

// "这篇笔记应该打什么标签？"
const suggested = await tg.suggestTags('无标题笔记');
// → ['TypeScript', 'API', '架构']

// "我的知识全景是什么样的？"
const graph = await tg.getGraph();
// → { nodes: [...], edges: [...], stats: { totalTags: 42, mostConnected: 'AI' } }

// "把知识自动分组"
const clusters = await tg.cluster();
// → [{ name: 'AI', tags: ['AI', 'LLM', 'Agent'], pages: [...], size: 15 }]

// 重命名标签（所有页面同步更新）
await tg.renameTag('机器学习', 'ML');

// 合并重复标签
await tg.mergeTags(['js', 'javascript', 'JS'], 'JavaScript');
```

层级标签自动展开：

```bash
deepbrain tag 我的笔记 "AI/Agent/RAG"
# 自动创建: AI → AI/Agent → AI/Agent/RAG
```

---

### 🔍 混合搜索

不只是向量相似度，三种搜索策略融合：

| 策略 | 原理 | 适合 |
|------|------|------|
| **向量搜索** | Embedding 相似度（HNSW） | "和 X 相关的东西" |
| **关键词搜索** | PostgreSQL tsvector | 精确词、名字、代码 |
| **RRF 融合** | 倒数排序融合 | 两者的最佳结合 |

```ts
// 语义搜索：找概念相关的内容
const results = await brain.query('如何构建 AI Agent');

// 关键词搜索：精确匹配
const results2 = await brain.search('TypeScript');
```

---

### 📊 双轨存储

| 轨道 | 存什么 | 行为 |
|------|--------|------|
| **Compiled Truth** | 当前事实 | 更新时覆写 |
| **Timeline** | 历史事件 | 只追加，永不删除 |

```ts
// 当前事实（可覆写）
await brain.put({
  slug: '项目-alpha',
  type: 'project',
  title: 'Project Alpha',
  compiled_truth: '状态: 进行中。团队: 5人。技术栈: TypeScript + React。',
});

// 历史事件（只追加）
await brain.addTimeline('项目-alpha', { date: '2026-04-01', content: '项目启动会议' });
await brain.addTimeline('项目-alpha', { date: '2026-04-13', content: '第一个原型交付' });
```

---

### 🔌 MCP Server（12 个工具）

接入 Claude Desktop、Cursor、OpenClaw：

```bash
deepbrain-mcp
```

工具: `put` · `get` · `query` · `search` · `link` · `unlink` · `get-links` · `timeline-add` · `get-timeline` · `list` · `stats` · `dream`

---

### 🌐 Web UI

内置浏览器界面，一行启动：

```bash
deepbrain serve --port 3000
```

- 📚 **页面浏览** — 所有知识一览
- 🔍 **搜索** — 语义 + 关键词
- 🏷️ **标签图谱** — Tag Cloud + 树形结构
- 📊 **统计** — 页面/chunk/链接/标签数量
- 🔌 **JSON API** — `/api/pages`, `/api/search`, `/api/tags`

---

### 💤 梦境循环 — 自动维护

```bash
deepbrain dream
```

自动检测：过期页面、缺失 embedding 的 chunk、孤儿 chunk、死链。自动修复并报告。

---

### 🏗️ 架构

```
deepbrain/
├── core/          # 🧠 Brain 引擎（PGLite + pgvector）
├── import/        # 📥 21 个导入器
├── export/        # 📤 5 种导出格式
├── tag-graph/     # 🏷️ 标签关系引擎
├── web/           # 🌐 内置 Web UI + API
├── clipper/       # ✂️ 网页剪藏
├── dream/         # 💤 自动维护
├── mcp/           # 🔌 MCP Server（12 个工具）
└── cli            # 🖥️ 命令行工具
```

**技术栈**: TypeScript · PGLite（进程内 PostgreSQL）· pgvector · [agentkits](https://github.com/Magicray1217/agentkits)（多提供商 AI）

**设计理念**:
- **本地优先** — 一切在进程内运行，无外部数据库，无云依赖
- **提供商无关** — 7 个 embedding 提供商，一行配置切换
- **导入一切，不锁定任何** — 21 个导入器进，5 种格式出
- **知识会生长** — Tag Graph 自动发现关系，Dream Cycle 自动维护健康

---

### CLI 命令参考

```bash
deepbrain init <provider>              # 初始化
deepbrain put <slug> <body>            # 添加/更新
deepbrain get <slug>                   # 读取
deepbrain query <text>                 # 语义搜索
deepbrain search <keyword>             # 关键词搜索
deepbrain tag <slug> <tag>             # 打标签
deepbrain link <from> <to>             # 创建链接
deepbrain timeline <slug> <date> <text> # 添加时间线
deepbrain list [--type note]           # 列表
deepbrain stats                        # 统计
deepbrain dream                        # 维护
deepbrain serve [--port 3000]          # 启动 Web UI
deepbrain export --format <格式> --output <目录>  # 导出
```

---

### 🆕 v0.9.0 新功能

#### Memory Operation DSL（记忆操作语言）
```bash
deepbrain op "STORE content:\"AI is amazing\" type:note tags:ai,tech"
deepbrain op "MERGE topic:AI topic:ML into:ai-ml"
deepbrain op "PROMOTE slug:important-fact importance:9"
deepbrain op "LOCK slug:critical-data"
deepbrain op "EXPIRE slug:temp-note days:30"
deepbrain op "SPLIT slug:big-topic into:sub1,sub2"
deepbrain op "LINK from:topic-a to:topic-b"
```

支持 8 种操作：STORE / MERGE / PROMOTE / DEMOTE / EXPIRE / LOCK / SPLIT / LINK

#### Proactive Memory Injection（主动记忆注入）
```bash
deepbrain inject "I'm preparing for the board meeting"
```
自动查找相关记忆，无需被问到就主动提供上下文。混合搜索（语义+关键词+时间），可配置相关性阈值。

#### Memory Hierarchy（记忆层级）
```bash
deepbrain tiers stats              # 查看各层统计
deepbrain tiers cycle              # 运行自动升降级
deepbrain tiers core               # 查看核心记忆
deepbrain tiers set <slug> core    # 手动设置层级
```
三级记忆：Core（核心）/ Working（工作）/ Archival（归档），自动根据访问频率升降级。

#### Temporal Tracking（时间追踪）
```bash
deepbrain temporal <slug>          # 查看知识演变时间线
```
追踪事实的学习和变化时间，支持"某日我对 X 了解多少？"查询。

#### Memory Compression（记忆压缩）
```bash
deepbrain compress                 # 压缩所有旧记忆
deepbrain compress <slug>          # 压缩指定记忆
```
提取式摘要压缩旧记忆，减少上下文 token 用量，保留原始版本作为归档。

---

### 📄 开源协议

MIT © [Magicray1217](https://github.com/Magicray1217)
