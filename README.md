# 🧠 DeepBrain

> Personal AI brain. Store, search, and grow your knowledge.
>
> 个人 AI 知识大脑。存储、搜索、生长你的知识。

[![npm](https://img.shields.io/npm/v/deepbrain)](https://www.npmjs.com/package/deepbrain)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-87%20passed-brightgreen)](https://github.com/Magicray1217/deepbrain)

[English](#english) | [中文](#中文)

---

<a id="english"></a>

## English

**DeepBrain** is a personal knowledge engine inspired by [GBrain](https://github.com/garrytan/gbrain), rebuilt from scratch with:

- 🔌 **Multi-provider** — 7 embedding providers via [agentkits](https://github.com/Magicray1217/agentkits)
- 🇨🇳 **Chinese-friendly** — DeepSeek, DashScope (Qwen), Zhipu (GLM) built-in
- 🏠 **Local-first** — Ollama + PGLite, zero cloud dependency
- 🔍 **Hybrid search** — Vector (HNSW) + keyword (tsvector) + RRF fusion
- 📊 **Compiled Truth + Timeline** — Current facts vs. historical events
- 🔗 **Knowledge graph** — Bidirectional links between pages
- 💤 **Dream Cycle** — Automated knowledge maintenance
- 🔌 **MCP Server** — 12 tools for Claude / Cursor / OpenClaw
- 📥 **21 Importers** — Import from any knowledge platform
- 📤 **5 Export formats** — Markdown, JSON, HTML, Obsidian, Logseq
- 🌐 **Web UI** — Built-in browser interface
- ✂️ **Browser Clipper** — Save web pages with one click

---

### ⚡ Quick Start

```bash
npm install -g deepbrain
deepbrain init gemini         # or: deepbrain init ollama
deepbrain put my-note "# My first note\nHello, brain!"
deepbrain query "what did I write?"
deepbrain serve               # Open http://localhost:3000
```

---

### 📥 Import from Anywhere (21 Sources)

DeepBrain imports from **every major knowledge platform** — the most comprehensive importer coverage in the open-source ecosystem.

#### International

| Platform | Format | Key Features |
|----------|--------|-------------|
| **Notion** | Markdown/HTML/CSV | Frontmatter, nested dirs |
| **Obsidian** | Markdown vault | `[[wikilinks]]`, `#tags`, YAML |
| **Evernote** | ENEX (XML) | ENML→Markdown, tags, checkboxes |
| **Roam Research** | JSON export | `[[refs]]`, `((blocks))`, TODO/DONE |
| **Logseq** | Markdown pages | Properties, page refs, journals |
| **Bear** | Markdown | `#nested/tags`, `::highlights::` |
| **Apple Notes** | HTML export | Checklists, tables, folders |
| **Google Keep** | JSON Takeout | Labels, lists, annotations |
| **OneNote** | HTML export | Sections, tables |
| **Joplin** | JEX / Markdown | Metadata blocks |
| **Readwise** | CSV/JSON | Highlights grouped by book |
| **Day One** | JSON export | Location, weather, starred |

#### 中文平台

| 平台 | 格式 | 特色 |
|------|------|------|
| **语雀 Yuque** | Markdown / `.lakebook` | Admonition 清理 |
| **飞书 Feishu** | Markdown / DOCX | @mention、checkbox |
| **石墨 Shimo** | HTML / Markdown | 轻量 HTML→MD |
| **微信公众号** | HTML | `js_content`、`og:title` |
| **Flomo** | HTML | `#tag/subtag` |
| **我来 Wolai** | Markdown | Toggles, callouts |
| **息流 FlowUs** | HTML / Markdown | Notion-style |
| **思源笔记 SiYuan** | `.sy` JSON / Markdown | Block 结构 |

#### Formats

| Format | Support |
|--------|---------|
| **EPUB** | ZIP chapter extraction |
| **PDF** | Text extraction + smart chunking |

```ts
import { importNotion, importObsidian, importEvernote } from 'deepbrain';

const pages = await importNotion({ dir: './notion-export' });
const vault = await importObsidian({ dir: './my-vault' });
const notes = await importEvernote({ file: './my-notes.enex' });
```

---

### 📤 Export (5 Formats)

Export your knowledge to any format:

```ts
import { exportMarkdown, exportJSON, exportObsidian, exportLogseq, exportHTML } from 'deepbrain';

await exportMarkdown(brain, { output: './export' });
await exportJSON(brain, { output: './export/brain.json' });
await exportObsidian(brain, { output: './obsidian-vault' });
await exportLogseq(brain, { output: './logseq-graph' });
await exportHTML(brain, { output: './html-site' });
```

---

### 🌐 Web UI

Built-in web interface — no separate frontend to install:

```ts
import { startWebUI } from 'deepbrain';

await startWebUI({ port: 3000 });
// Open http://localhost:3000
```

Features:
- 📚 Browse all pages with tags
- 🔍 Full-text + semantic search
- 📊 Knowledge base stats
- 🔌 JSON API (`/api/pages`, `/api/search`)

---

### ✂️ Browser Clipper

Save web pages to DeepBrain from any browser:

```ts
import { generateBookmarklet } from 'deepbrain';

const bookmarklet = generateBookmarklet('http://localhost:3000');
// Drag to bookmarks bar → click on any page → saved!
```

---

### 🔌 MCP Server (12 Tools)

Works with Claude Desktop, Cursor, OpenClaw:

```bash
deepbrain-mcp
```

Tools: `put`, `get`, `query`, `search`, `link`, `unlink`, `get-links`, `timeline-add`, `get-timeline`, `list`, `stats`, `dream`

---

### 💤 Dream Cycle

Automated knowledge maintenance:

```ts
import { dream } from 'deepbrain';

const report = await dream(brain);
// Finds: stale pages, orphan chunks, dead links
```

---

### 🔍 Hybrid Search

Combines vector similarity + keyword matching:

```ts
const brain = new Brain({ embedding_provider: 'gemini' });
await brain.connect();

// Semantic search
const results = await brain.query('how to build AI agents');

// Keyword search
const results2 = await brain.search('TypeScript');
```

---

### CLI

```bash
deepbrain init <provider>     # Initialize (gemini/ollama/openai/dashscope/...)
deepbrain put <slug> <body>   # Add/update a page
deepbrain get <slug>          # Read a page
deepbrain query <text>        # Semantic search
deepbrain search <keyword>    # Keyword search
deepbrain link <from> <to>    # Create link
deepbrain timeline <slug> <date> <text>  # Add timeline entry
deepbrain list                # List all pages
deepbrain stats               # Knowledge base stats
deepbrain dream               # Run maintenance
deepbrain serve [--port N]    # Start Web UI
```

---

### Architecture

```
deepbrain/
├── core/        # Brain engine (PGLite + pgvector)
├── import/      # 21 importers
├── export/      # 5 export formats
├── web/         # Built-in Web UI
├── clipper/     # Browser clipper
├── dream/       # Automated maintenance
├── mcp/         # MCP server (12 tools)
└── cli          # Command-line interface
```

**Powered by** [agentkits](https://github.com/Magicray1217/agentkits) for multi-provider embedding.

---

## 📄 License

MIT © [Magicray1217](https://github.com/Magicray1217)

---

<a id="中文"></a>

## 中文文档

### DeepBrain 是什么？

**DeepBrain** 是一个开源的个人 AI 知识大脑。把你所有的笔记、文档、知识导入进来，用 AI 帮你搜索、整理、生长。

### 核心特性

| 特性 | 说明 |
|------|------|
| 📥 21 个导入器 | 覆盖所有主流笔记/知识库平台 |
| 📤 5 种导出格式 | Markdown、JSON、HTML、Obsidian、Logseq |
| 🌐 Web UI | 内置浏览器界面，一行代码启动 |
| ✂️ 网页剪藏 | 一键保存任意网页 |
| 🔍 混合搜索 | 向量 + 关键词 + RRF 融合 |
| 📊 双轨存储 | Compiled Truth（可覆写）+ Timeline（只追加） |
| 🔗 知识图谱 | 双向链接 |
| 💤 梦境循环 | 自动维护（过期检测、孤儿清理、死链修复） |
| 🔌 MCP Server | 12 个工具，接入 Claude / Cursor / OpenClaw |
| 🏠 本地优先 | Ollama + PGLite，零云依赖 |
| 🇨🇳 中文友好 | DeepSeek、DashScope、Zhipu 内置 |

### 快速上手

```bash
npm install -g deepbrain
deepbrain init gemini
deepbrain put 笔记 "# 我的第一条笔记\n你好，大脑！"
deepbrain query "我写了什么？"
deepbrain serve   # 打开 http://localhost:3000
```

### 导入你的知识

支持 **21 个数据源**，市面上所有主流笔记/知识库产品：

**国际平台**: Notion, Obsidian, Evernote, Roam Research, Logseq, Bear, Apple Notes, Google Keep, OneNote, Joplin, Readwise, Day One

**国内平台**: 语雀, 飞书, 石墨, 微信公众号, Flomo, 我来(Wolai), 息流(FlowUs), 思源笔记

**格式**: EPUB, PDF

```ts
import { importNotion, importFlomo, importWechat } from 'deepbrain';

const pages = await importNotion({ dir: './notion-export' });
const memos = await importFlomo({ file: './flomo.html' });
const articles = await importWechat({ dir: './wechat-articles' });
```

### 导出

```bash
# 导出为 Markdown
deepbrain export --format markdown --output ./export

# 导出为 Obsidian vault
deepbrain export --format obsidian --output ./my-vault
```

### CLI 命令

```bash
deepbrain init <provider>     # 初始化
deepbrain put <slug> <body>   # 添加/更新页面
deepbrain get <slug>          # 读取页面
deepbrain query <text>        # 语义搜索
deepbrain search <keyword>    # 关键词搜索
deepbrain link <from> <to>    # 创建链接
deepbrain list                # 列出所有页面
deepbrain stats               # 知识库统计
deepbrain dream               # 运行维护
deepbrain serve               # 启动 Web UI
```

### 开源协议

MIT © [Magicray1217](https://github.com/Magicray1217)
