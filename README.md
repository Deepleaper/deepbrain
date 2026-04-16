<div align="center">

# 🧠 DeepBrain

**你的个人 AI 知识大脑 | Your Personal AI Knowledge Brain**

存储、搜索、关联、生长你的全部知识 —— 本地优先，AI 驱动。

[![npm version](https://img.shields.io/npm/v/deepbrain?color=blue)](https://www.npmjs.com/package/deepbrain)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://typescriptlang.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[快速开始](#-快速开始) · [功能特性](#-功能特性) · [导入数据](#-导入一切) · [CLI 命令](#-cli-命令参考) · [MCP 集成](#-mcp-server) · [竞品对比](#-竞品对比)

</div>

---

## 为什么需要 DeepBrain？

你的知识散落在各处——Notion、Obsidian、Evernote、Flomo、飞书、语雀、微信、PDF……

当你想找某个东西时，你得先想起来**放在哪了**。

**DeepBrain** 把所有知识汇集到一个本地大脑，用 AI 理解语义，让你用自然语言搜索**全部知识**。

- **语义搜索** — 向量 + 关键词混合搜索，不用记关键词（`src/core/brain.ts`）
- **知识图谱** — LLM 自动提取实体和关系（`src/commands/graph.ts`）
- **闪卡复习** — SM-2 间隔重复算法，从知识库自动生成（`src/flashcards/`）
- **24 个导入器** — 8 个中文平台原生支持（`src/import/`，23 个文件 + github-stars 变体）
- **本地优先** — PGLite + pgvector，数据 100% 在本地，无需外部数据库
- **MCP 集成** — 12 个工具接入 Claude Desktop、Cursor 等（`src/mcp.ts`）

---

## ⚡ 快速开始

```bash
# 安装
npm install -g deepbrain

# 初始化（选你喜欢的 AI 提供商）
deepbrain init gemini          # Google Gemini（有免费额度）
deepbrain init deepseek        # DeepSeek-V3
deepbrain init dashscope       # 阿里通义千问
deepbrain init ollama          # 本地 Ollama（零费用）

# 写入知识
deepbrain put 会议记录 notes.md          # 自动摘要 + 自动打标签
echo "React 19 引入了编译器" | deepbrain put react-19

# 语义搜索
deepbrain query "产品路线图讨论了什么？"

# 与大脑对话（RAG）
deepbrain chat "总结一下本周的关键决策"
```

大脑使用 PGLite（嵌入式 PostgreSQL）+ pgvector 在本地运行，无需外部数据库服务。

---

## 🚀 功能特性

### 核心能力

| 功能 | 说明 | 源码位置 |
|------|------|---------|
| **混合搜索** | 向量（pgvector HNSW）+ BM25 关键词，RRF 排序融合 | `src/core/brain.ts` |
| **自动摘要/标签** | 每个页面由 LLM 自动生成摘要和层级标签 | `src/core/brain.ts` |
| **知识图谱** | 自动提取实体和关系，支持路径查询与聚类 | `src/commands/graph.ts` |
| **梦境循环** | 后台维护：刷新过期 embedding、修复断链、孤岛检测 | `src/commands/dream.ts` |
| **记忆分层** | Core（≤20）→ Working（≤50）→ Archival，自动升降级 | `src/commands/tiers.ts` |
| **闪卡复习** | SM-2 间隔重复：easiness 1.3–5.0，从知识库自动生成 | `src/flashcards/` |
| **多大脑** | 按 `--brain <name>` 隔离，支持跨大脑查询与合并 | `src/cli.ts` |
| **模板系统** | 预设结构：research、journal、bookshelf、project、crm | `src/templates.ts` |

### 数据库

DeepBrain 使用 **PGLite**（嵌入式 PostgreSQL）+ **pgvector** 扩展，5 张表：

| 表名 | 内容 |
|------|------|
| `pages` | slug、type、title、compiled_truth、timeline、frontmatter (JSONB) |
| `chunks` | 自动分块内容 + pgvector embedding（HNSW 索引） |
| `links` | 双向关系（from_slug → to_slug） |
| `page_tags` | 层级标签（`#AI/Agent/RAG`） |
| `timeline_entries` | 只追加的历史记录（带日期） |

源码：`src/core/schema.ts`

### AI 提供商（7 个）

| 提供商 | 说明 |
|--------|------|
| `ollama` | 本地运行，零费用，无需 API key |
| `openai` | GPT-4o |
| `gemini` | Google Gemini，有免费额度（推荐） |
| `deepseek` | DeepSeek-V3 |
| `dashscope` | 阿里通义千问 |
| `zhipu` | 智谱 GLM-4 |
| `moonshot` | 月之暗面 Kimi，超长上下文 |

通过 `agentkits` 库统一调用，配置写在 `deepbrain.json`。

---

## 📥 导入一切

24 个导入命令（`src/import/` 下 23 个文件，github-stars 为 github.ts 的变体）：

### 国际平台（13 个）

| 平台 | 命令 |
|------|------|
| Obsidian | `deepbrain import obsidian <vault-path>` |
| Notion | `deepbrain import notion <export-path>` |
| Evernote | `deepbrain import evernote <dir>` |
| Logseq | `deepbrain import logseq <dir>` |
| Roam Research | `deepbrain import roam <file.json>` |
| Bear | `deepbrain import bear <dir>` |
| Joplin | `deepbrain import joplin <dir>` |
| Readwise | `deepbrain import readwise <file.csv\|json>` |
| Day One | `deepbrain import dayone <file.json>` |
| Apple Notes | `deepbrain import apple-notes <dir>` |
| Google Keep | `deepbrain import google-keep <dir>` |
| OneNote | `deepbrain import onenote <dir>` |
| EPUB/PDF | `deepbrain import ebook <file.epub\|pdf>` |

### 中文平台（8 个）

| 平台 | 命令 |
|------|------|
| 语雀 | `deepbrain import yuque <dir>` |
| 飞书 | `deepbrain import feishu <dir>` |
| 石墨文档 | `deepbrain import shimo <dir>` |
| 微信公众号 | `deepbrain import wechat <dir>` |
| Flomo | `deepbrain import flomo <file.html\|md>` |
| 我来 Wolai | `deepbrain import wolai <dir>` |
| FlowUs 息流 | `deepbrain import flowus <dir>` |
| 思源笔记 | `deepbrain import siyuan <dir>` |

### Web 与代码（3 个）

| 数据源 | 命令 |
|--------|------|
| GitHub 仓库 | `deepbrain import github --repo owner/repo` |
| GitHub Stars | `deepbrain import github-stars --user <name>` |
| YouTube 视频 | `deepbrain import youtube <url>` |

### 持续同步

```bash
deepbrain sync rss --add <feed-url>          # 订阅 RSS
deepbrain sync rss --run                     # 抓取所有订阅
deepbrain sync rss --list                    # 查看订阅列表
deepbrain sync notion --token T --database D # 同步 Notion 数据库
deepbrain watch <vault-path>                 # 监听 Obsidian 仓库变更
deepbrain batch-import <dir>                 # 批量导入 .md/.txt 文件
```

---

## 🌐 Web 界面

```bash
deepbrain web --port 3000          # 交互式 Web UI（搜索、编辑、图谱可视化）
deepbrain serve --port 3333        # 启动 REST API Server
deepbrain playground               # 预置示例知识库，无需配置
```

Web UI 源码：`src/web/index.ts`。深色主题，支持中英文自动检测，含知识图谱 SVG 可视化。

---

## 🔌 Chrome 扩展 — 网页剪藏

一键保存网页到大脑，支持划词剪藏。源码：`extension/`，安装说明见 [extension/README.md](extension/README.md)。

---

## 📖 CLI 命令参考

以下命令来自 `deepbrain --help`：

### 基础操作

```bash
deepbrain init [provider]              # 初始化大脑（默认：ollama）
deepbrain init --template research     # 用模板初始化
deepbrain doctor                       # 健康检查（配置、API、数据库）
deepbrain playground [--port 3000]     # 启动演示 Playground
deepbrain put <slug> [file]            # 添加/更新页面（自动摘要）
deepbrain get <slug>                   # 读取页面
deepbrain query "文本"                 # 语义搜索（混合）
deepbrain search "关键词"              # 关键词搜索
deepbrain chat "问题"                  # RAG 对话
deepbrain chat -i                      # 交互式多轮对话
deepbrain chat -i --session <id>       # 恢复已保存的会话
deepbrain chat "q" --brains a,b,c      # 跨多个大脑查询
deepbrain list [--type X]              # 列出页面
deepbrain stats                        # 大脑统计
```

### 知识管理

```bash
deepbrain dream                        # 运行梦境循环（维护）
deepbrain graph                        # 构建知识图谱
deepbrain graph query "实体"           # 查询实体关系
deepbrain related <slug>               # 查找相关页面（智能关联）
deepbrain link <from> <to>             # 手动创建链接
deepbrain timeline <slug> "文本"       # 添加时间线条目
deepbrain temporal <slug>              # 知识演化时间线
deepbrain tiers [stats|cycle|core]     # 记忆分层管理
deepbrain compress [slug]              # 压缩旧记忆
deepbrain retag                        # LLM 重新打标签
deepbrain op "MERGE topic:AI topic:ML" # 记忆操作 DSL
deepbrain inject "preparing for..."    # 主动记忆注入
```

### 学习与分享

```bash
deepbrain flashcards generate [slugs]  # 从页面生成闪卡
deepbrain flashcards review            # SM-2 间隔重复复习
deepbrain flashcards stats             # 闪卡统计
deepbrain digest --period weekly       # 智能知识周报
deepbrain digest-email --to email      # 发送学习摘要邮件
deepbrain share [--port 8080]          # 只读 Web 分享
deepbrain share --export ./site        # 导出静态 HTML 站点
deepbrain share <brain> --with <user>  # 共享大脑
```

### 多大脑管理

```bash
deepbrain init --brain work openai     # 创建命名大脑
deepbrain --brain work put ...         # 使用指定大脑
deepbrain merge <brain1> <brain2>      # 合并两个大脑
deepbrain list-brains                  # 查看所有大脑
```

### 备份与扩展

```bash
deepbrain backup [--output file.zip]   # 完整备份
deepbrain restore <file.zip>           # 从备份恢复
deepbrain templates                    # 查看可用大脑模板
deepbrain mcp                          # MCP Server 信息
deepbrain plugin list|add|remove       # 插件管理
```

### 全局标志

```
--brain <name>      使用命名大脑（默认："default"）
--no-summary        跳过 put 时的自动摘要
--provider <name>   指定 LLM 提供商
--model <name>      指定 LLM 模型
--lang <en|zh>      语言（自动检测）
```

---

## 🔌 MCP Server

DeepBrain 可作为 [Model Context Protocol](https://modelcontextprotocol.io) 工具服务器，接入 Claude Desktop、Cursor 等 AI 助手。

**配置（Claude Desktop `claude_desktop_config.json`）：**

```json
{
  "mcpServers": {
    "deepbrain": {
      "command": "deepbrain-mcp",
      "args": []
    }
  }
}
```

**12 个工具**（源码：`src/mcp.ts`）：

| 工具名 | 功能 |
|--------|------|
| `brain_put` | 存储/更新知识页面 |
| `brain_get` | 读取页面内容 |
| `brain_query` | 语义混合搜索 |
| `brain_search` | 关键词搜索 |
| `brain_link` | 创建双向链接 |
| `brain_unlink` | 删除链接 |
| `brain_tag` | 添加标签 |
| `brain_timeline` | 追加时间线条目 |
| `brain_stats` | 获取大脑统计 |
| `brain_list` | 列出页面（支持过滤） |
| `brain_delete` | 删除页面 |
| `brain_dream` | 运行梦境循环维护 |

---

## 🥊 竞品对比

| 功能 | DeepBrain | Obsidian | Notion | Mem.ai | 腾讯 IMA |
|------|-----------|----------|--------|--------|---------|
| **本地优先** | ✅ PGLite | ✅ 文件 | ❌ 云端 | ❌ 云端 | ❌ 云端 |
| **语义搜索** | ✅ 混合搜索 | ❌ 关键词 | ❌ 关键词 | ✅ | ❌ |
| **自动摘要** | ✅ LLM | ❌ | ❌ AI 插件 | ✅ | ✅ |
| **知识图谱** | ✅ 自动 | 🟡 手动 | ❌ | ❌ | ❌ |
| **导入平台** | ✅ 24 个 | 🟡 插件 | 🟡 有限 | ❌ | 仅微信 |
| **中文平台** | ✅ 8 个 | ❌ | ❌ | ❌ | 1 个 |
| **MCP 集成** | ✅ 12 工具 | ❌ | ❌ | ❌ | ❌ |
| **闪卡（SM-2）** | ✅ 内置 | 🟡 插件 | ❌ | ❌ | ❌ |
| **CLI 优先** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **开源免费** | ✅ Apache-2.0 | 🟡 Freemium | 🟡 Freemium | ❌ 付费 | ❌ |
| **数据所有权** | ✅ 100% 你的 | ✅ | ❌ | ❌ | ❌ |
| **AI 提供商** | ✅ 7 个可选 | 仅 OpenAI | 仅 OpenAI | 仅自有 | 仅混元 |

---

## 🏗 架构

```
┌──────────────────────────────────────────────────────────────┐
│                    DeepBrain CLI / SDK                        │
├──────────┬───────────┬──────────┬──────────┬─────────────────┤
│  导入    │  搜索     │  梦境    │  图谱    │   协作          │
│ 24 平台  │ 混合搜索  │  循环    │  自动    │  分享/RSS/Watch │
├──────────┴───────────┴──────────┴──────────┴─────────────────┤
│                      核心大脑引擎                              │
│        pages · chunks · links · timeline · tags · flashcards  │
├──────────────────────────────────────────────────────────────┤
│  PGLite + pgvector（嵌入式）  │  agentkits（多提供商 AI）    │
│  零配置本地数据库              │  7 个 AI 提供商               │
└──────────────────────────────────────────────────────────────┘
```

**目录结构：**

```
src/
├── core/          # Brain 引擎、schema（5 张表）、类型定义
├── cli.ts         # CLI 入口，所有命令注册
├── mcp.ts         # MCP Server（12 个工具）
├── server.ts      # REST API Server
├── import/        # 24 个导入器（23 个文件）
├── sync/          # RSS、Obsidian watcher、Notion 实时同步
├── web/           # Web UI + Playground
├── commands/      # dream、graph、tiers、chat 等命令
├── flashcards/    # SM-2 闪卡算法
├── tag-graph/     # 层级标签图分析
├── templates.ts   # 5 种大脑模板
├── export/        # 多格式导出（MD、JSON、HTML、Obsidian、Logseq）
└── clipper/       # 浏览器剪藏集成
```

---

## 📦 SDK

```typescript
import { Brain } from 'deepbrain';

const brain = new Brain({ embedding_provider: 'gemini', api_key: '...' });
await brain.connect();

// 存储知识
await brain.put('会议-Q1', {
  type: 'note',
  title: 'Q1 规划会议',
  compiled_truth: '我们决定聚焦于...',
});

// 语义搜索
const results = await brain.query('产品路线图决策');
```

**SDK 子模块导出（`package.json` exports 字段）：**

```typescript
import { buildKnowledgeGraph } from 'deepbrain/tag-graph';
import { generateFlashcards }  from 'deepbrain/flashcards';
import { importObsidian }      from 'deepbrain/import';
import { runDreamCycle }       from 'deepbrain/dream';
import { backupBrain }         from 'deepbrain/backup';
```

---

## 🤝 参与贡献

欢迎 PR！请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)。

```bash
git clone https://github.com/Magicray1217/deepbrain
cd deepbrain
npm install
npm run build
npm test
```

---

## 📄 开源协议

Apache-2.0 © [Magicray1217](https://github.com/Magicray1217)

由 [跃盟科技 Deepleaper](https://www.deepleaper.com) 出品

---

<div align="center">

**🧠 你的知识值得拥有一个大脑，而不只是一个文件夹。**

[立即开始 →](https://www.npmjs.com/package/deepbrain)

</div>

---

<details>
<summary><b>English</b></summary>

## What is DeepBrain?

Your knowledge is scattered — Notion, Obsidian, Evernote, Flomo, Feishu, Yuque, WeChat, PDFs…

**DeepBrain** unifies everything into one local AI brain. Search all your knowledge with natural language.

## Quick Start

```bash
npm install -g deepbrain
deepbrain init gemini
deepbrain put meeting-notes notes.md
deepbrain query "what did we discuss about the product roadmap?"
deepbrain chat "summarize our key decisions this week"
```

Data is stored locally in PGLite (embedded PostgreSQL) + pgvector. No external database needed.

## Features

- **Hybrid Search** — Vector (pgvector HNSW) + BM25 keyword, RRF fusion ranking (`src/core/brain.ts`)
- **Auto Summary & Tags** — LLM-generated summaries and hierarchical tags on every `put`
- **Knowledge Graph** — Auto-extract entities and relationships, path queries, clustering (`src/commands/graph.ts`)
- **Dream Cycle** — Background maintenance: re-embed stale pages, fix dead links, detect orphans (`src/commands/dream.ts`)
- **Memory Tiers** — Core (≤20) → Working (≤50) → Archival, automatic promotion/demotion
- **Flashcards** — SM-2 spaced repetition (easiness 1.3–5.0), auto-generated from your knowledge (`src/flashcards/`)
- **24 Importers** — 8 native Chinese platforms (`src/import/`, 23 files + github-stars variant)
- **Local-first** — PGLite + pgvector, 100% your data, no cloud dependency
- **MCP Server** — 12 tools for Claude Desktop, Cursor, and other AI assistants (`src/mcp.ts`)
- **7 AI Providers** — ollama, openai, gemini, deepseek, dashscope, zhipu, moonshot

## 24 Importers

**International (13):** Obsidian, Notion, Evernote, Logseq, Roam Research, Bear, Joplin, Readwise, Day One, Apple Notes, Google Keep, OneNote, EPUB/PDF

**Chinese (8):** Yuque (语雀), Feishu (飞书), Shimo (石墨), WeChat (微信公众号), Flomo, Wolai (我来), FlowUs (息流), SiYuan (思源笔记)

**Web & Code (3):** GitHub repos, GitHub Stars, YouTube transcripts

## MCP Server — 12 Tools

`brain_put` · `brain_get` · `brain_query` · `brain_search` · `brain_link` · `brain_unlink` · `brain_tag` · `brain_timeline` · `brain_stats` · `brain_list` · `brain_delete` · `brain_dream`

```json
{
  "mcpServers": {
    "deepbrain": { "command": "deepbrain-mcp", "args": [] }
  }
}
```

## Architecture

- **Storage:** PGLite + pgvector — 5 tables: pages, chunks, links, page_tags, timeline_entries
- **Search:** Hybrid vector + BM25 with Reciprocal Rank Fusion
- **AI:** 7 providers unified via `agentkits`
- **CLI:** 50+ commands across init, import, sync, search, chat, graph, flashcards, backup, MCP, plugin

## License

Apache-2.0 © [Magicray1217](https://github.com/Magicray1217)

</details>
