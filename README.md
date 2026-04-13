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

灵感来自 [GBrain](https://github.com/garrytan/gbrain)，从零重写，专为中国开发者优化。

---

### ⚡ 快速上手

```bash
npm install -g deepbrain
deepbrain init gemini         # 或: deepbrain init ollama（本地免费）
deepbrain put 笔记 "# 我的第一条笔记\n你好，大脑！"
deepbrain query "我写了什么？"
deepbrain serve               # 打开 http://localhost:3000
```

---

### 核心特性

| 特性 | 说明 |
|------|------|
| 📥 **21 个导入器** | 覆盖所有主流笔记/知识库平台 |
| 📤 **5 种导出格式** | Markdown、JSON、HTML、Obsidian、Logseq |
| 🌐 **Web UI** | 内置浏览器界面，一行代码启动 |
| ✂️ **网页剪藏** | 一键保存任意网页到知识库 |
| 🔍 **混合搜索** | 向量（HNSW）+ 关键词（tsvector）+ RRF 融合 |
| 📊 **双轨存储** | Compiled Truth（可覆写）+ Timeline（只追加） |
| 🔗 **知识图谱** | 页面间双向链接 |
| 💤 **梦境循环** | 自动维护（过期检测、孤儿清理、死链修复） |
| 🔌 **MCP Server** | 12 个工具，接入 Claude Desktop / Cursor / OpenClaw |
| 🏠 **本地优先** | Ollama + PGLite，零云依赖 |
| 🇨🇳 **中文友好** | DeepSeek、DashScope（通义千问）、Zhipu（智谱）内置 |

---

### 📥 从任何平台导入（21 个数据源）

**市面上覆盖最全的开源知识导入器。**

#### 国际平台

| 平台 | 导入格式 | 特色 |
|------|----------|------|
| **Notion** | Markdown/HTML/CSV | Frontmatter、嵌套目录 |
| **Obsidian** | Markdown vault | `[[双链]]`、`#标签`、YAML |
| **Evernote** | ENEX (XML) | ENML→Markdown、标签、待办 |
| **Roam Research** | JSON 导出 | `[[引用]]`、`((块引用))`、TODO |
| **Logseq** | Markdown 页面 | 属性、页面引用、日志 |
| **Bear** | Markdown | `#嵌套/标签`、`::高亮::` |
| **Apple Notes** | HTML 导出 | 清单、表格、文件夹 |
| **Google Keep** | JSON Takeout | 标签、列表、注解 |
| **OneNote** | HTML 导出 | 分区、表格 |
| **Joplin** | JEX / Markdown | 元数据块 |
| **Readwise** | CSV/JSON | 按书分组的高亮 |
| **Day One** | JSON 导出 | 位置、天气、星标 |

#### 国内平台

| 平台 | 导入格式 | 特色 |
|------|----------|------|
| **语雀** | Markdown / `.lakebook` | Admonition 清理 |
| **飞书** | Markdown / DOCX | @mention、checkbox 转换 |
| **石墨文档** | HTML / Markdown | 轻量 HTML→MD |
| **微信公众号** | HTML | `js_content`、`og:title`、发布时间 |
| **Flomo** | HTML | `#标签/子标签` |
| **我来 (Wolai)** | Markdown | Toggle、Callout |
| **息流 (FlowUs)** | HTML / Markdown | Notion 风格 |
| **思源笔记** | `.sy` JSON / Markdown | Block 结构 |

#### 文档格式

| 格式 | 支持 |
|------|------|
| **EPUB** | ZIP 章节提取 |
| **PDF** | 文本提取 + 智能分块 |

```ts
import { importNotion, importFlomo, importWechat, importObsidian } from 'deepbrain';

// 导入 Notion
const pages = await importNotion({ dir: './notion-export' });

// 导入 Flomo
const memos = await importFlomo({ file: './flomo.html' });

// 导入微信公众号文章
const articles = await importWechat({ dir: './wechat-articles' });

// 导入 Obsidian vault
const vault = await importObsidian({ dir: './my-vault' });

// 所有导入器都支持进度回调
const notes = await importEvernote({
  file: './my-notes.enex',
  onProgress: (current, total, name) => console.log(`${current}/${total}: ${name}`),
});
```

---

### 📤 导出（5 种格式）

把知识导出到任何你想要的格式：

```ts
import { exportMarkdown, exportJSON, exportObsidian, exportLogseq, exportHTML } from 'deepbrain';

// 导出为 Markdown 文件
await exportMarkdown(brain, { output: './export' });

// 导出为 JSON（方便程序处理）
await exportJSON(brain, { output: './export/brain.json' });

// 导出为 Obsidian vault（直接用 Obsidian 打开）
await exportObsidian(brain, { output: './obsidian-vault' });

// 导出为 Logseq graph
await exportLogseq(brain, { output: './logseq-graph' });

// 导出为 HTML 网站（含索引页）
await exportHTML(brain, { output: './html-site' });
```

支持按标签过滤、包含/排除时间线、进度回调。

---

### 🌐 Web UI

内置浏览器界面，无需安装额外前端：

```ts
import { startWebUI } from 'deepbrain';

await startWebUI({ port: 3000 });
// 打开 http://localhost:3000
```

或用 CLI：

```bash
deepbrain serve --port 3000
```

功能：
- 📚 浏览所有页面（带标签和类型）
- 🔍 全文搜索 + 语义搜索
- 📊 知识库统计（页面数、chunk 数、链接数、标签数）
- 🔌 JSON API（`/api/pages`、`/api/search`）

---

### ✂️ 网页剪藏

一键保存网页到 DeepBrain：

```ts
import { generateBookmarklet } from 'deepbrain';

// 生成书签栏代码
const bookmarklet = generateBookmarklet('http://localhost:3000');
// 拖到浏览器书签栏 → 在任意网页点击 → 自动保存到知识库
```

也可以在代码中使用：

```ts
import { clipPage, clipSelection } from 'deepbrain';

// 剪藏整个页面
const page = clipPage(document);

// 只剪藏选中的文字
const selection = clipSelection(document);
```

---

### 🔌 MCP Server（12 个工具）

接入 Claude Desktop、Cursor、OpenClaw：

```bash
deepbrain-mcp
```

工具列表：`put`、`get`、`query`、`search`、`link`、`unlink`、`get-links`、`timeline-add`、`get-timeline`、`list`、`stats`、`dream`

---

### 🔍 混合搜索

向量相似度 + 关键词匹配，RRF 融合排序：

```ts
import { Brain } from 'deepbrain';

const brain = new Brain({ embedding_provider: 'gemini', api_key: 'AIza...' });
await brain.connect();

// 写入知识
await brain.put({ slug: 'ai-agents', type: 'note', title: 'AI Agents', compiled_truth: '...' });

// 语义搜索
const results = await brain.query('如何构建 AI Agent');

// 关键词搜索
const results2 = await brain.search('TypeScript');
```

---

### 💤 梦境循环

自动维护知识库健康：

```ts
import { dream } from 'deepbrain';

const report = await dream(brain);
// 检测：过期页面、孤儿 chunk、死链
// 自动清理并报告
```

---

### 🖥️ CLI 命令

```bash
deepbrain init <provider>     # 初始化（gemini/ollama/openai/dashscope/...）
deepbrain put <slug> <body>   # 添加/更新页面
deepbrain get <slug>          # 读取页面
deepbrain query <text>        # 语义搜索
deepbrain search <keyword>    # 关键词搜索
deepbrain link <from> <to>    # 创建链接
deepbrain timeline <slug> <date> <text>  # 添加时间线条目
deepbrain list                # 列出所有页面
deepbrain stats               # 知识库统计
deepbrain dream               # 运行维护
deepbrain serve [--port N]    # 启动 Web UI
```

---

### 🏗️ 架构

```
deepbrain/
├── core/        # 🧠 Brain 引擎（PGLite + pgvector）
├── import/      # 📥 21 个导入器
├── export/      # 📤 5 种导出格式
├── web/         # 🌐 内置 Web UI
├── clipper/     # ✂️ 网页剪藏
├── dream/       # 💤 梦境循环（自动维护）
├── mcp/         # 🔌 MCP Server（12 个工具）
└── cli          # 🖥️ 命令行工具
```

底层使用 [agentkits](https://github.com/Magicray1217/agentkits) 提供多提供商 embedding 支持。

---

### 📄 开源协议

MIT © [Magicray1217](https://github.com/Magicray1217)
