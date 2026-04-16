<div align="center">

# 🧠 DeepBrain

**你的个人 AI 知识大脑 | Your Personal AI Knowledge Brain**

存储、搜索、关联、生长你的全部知识 —— 本地优先，AI 驱动。

[![npm version](https://img.shields.io/npm/v/deepbrain?color=blue)](https://www.npmjs.com/package/deepbrain)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://typescriptlang.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[中文文档](README.zh-CN.md) | [快速开始](#-快速开始) · [功能特性](#-功能特性) · [导入数据](#-导入一切) · [CLI 命令](#-cli-命令参考) · [MCP 集成](#-mcp-server) · [竞品对比](#-竞品对比)

</div>

---

## 为什么需要 DeepBrain？

你的知识散落在各处——Notion、Obsidian、Evernote、Flomo、飞书、语雀、微信、PDF……

当你想找某个东西时，你得先想起来**放在哪了**。

**DeepBrain** 把所有知识汇集到一个本地大脑，用 AI 理解语义，让你用自然语言搜索**全部知识**。

- 🔍 **语义搜索** — 不用记关键词，用你的话问就行
- 🧩 **知识图谱** — 自动发现知识之间的关联
- 📇 **闪卡复习** — SM-2 间隔重复算法，把知识刻进记忆
- 📥 **导入一切** — 24 个平台一键导入，8 个中文平台原生支持
- 🏠 **本地优先** — 数据 100% 在你手里，无需云服务
- 🤖 **MCP 集成** — 让 Claude、Cursor 等 AI 助手直接读取你的知识

---

## ⚡ 快速开始

```bash
# 安装
npm install -g deepbrain

# 初始化（选你喜欢的 AI 提供商）
deepbrain init gemini          # Google Gemini（推荐，有免费额度）
deepbrain init deepseek        # DeepSeek
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

就这么简单。大脑使用 PGLite + pgvector 在本地运行，无需外部数据库。

---

## 🚀 功能特性

### 核心能力

| 功能 | 说明 |
|------|------|
| **混合搜索** | 语义（向量）+ 关键词搜索，自动排序融合 |
| **自动摘要** | 每个页面由 LLM 自动生成摘要和标签 |
| **知识图谱** | 自动提取实体和关系，查询知识关联 |
| **梦境循环** | 后台自动维护：刷新过期内容、修复断链 |
| **记忆分层** | 核心 → 工作 → 归档，自动升降级 |
| **闪卡复习** | SM-2 间隔重复算法，从知识库自动生成 |
| **多大脑** | 工作、个人、研究分开管理，或合并查询 |
| **模板系统** | 预设大脑结构：研究、CRM、日记、PKM |

### 导入一切

| 数据源 | 命令 |
|--------|------|
| **Obsidian** | `deepbrain import obsidian <vault-path>` |
| **Notion** | `deepbrain import notion <export-path>` |
| **Evernote** | `deepbrain import evernote <dir>` |
| **Logseq** | `deepbrain import logseq <dir>` |
| **Roam Research** | `deepbrain import roam <file.json>` |
| **Bear** | `deepbrain import bear <dir>` |
| **Joplin** | `deepbrain import joplin <dir>` |
| **Readwise** | `deepbrain import readwise <file.csv\|json>` |
| **Day One** | `deepbrain import dayone <file.json>` |
| **Apple Notes** | `deepbrain import apple-notes <dir>` |
| **Google Keep** | `deepbrain import google-keep <dir>` |
| **OneNote** | `deepbrain import onenote <dir>` |
| **语雀** | `deepbrain import yuque <dir>` |
| **飞书** | `deepbrain import feishu <dir>` |
| **微信公众号** | `deepbrain import wechat <dir>` |
| **Flomo** | `deepbrain import flomo <file.html\|md>` |
| **石墨文档** | `deepbrain import shimo <dir>` |
| **思源笔记** | `deepbrain import siyuan <dir>` |
| **我来 Wolai** | `deepbrain import wolai <dir>` |
| **FlowUs 息流** | `deepbrain import flowus <dir>` |
| **GitHub** | `deepbrain import github --repo owner/repo` |
| **GitHub Stars** | `deepbrain import github-stars --user <name>` |
| **YouTube** | `deepbrain import youtube <url>` |
| **EPUB/PDF** | `deepbrain import ebook <file.epub\|pdf>` |
| **RSS** | `deepbrain sync rss --add <url>` |
| **Notion (实时同步)** | `deepbrain sync notion --token T --database D` |

### 分享与协作

```bash
# 作为只读网站分享大脑
deepbrain share --port 8080

# 导出为静态 HTML（部署到任意服务器）
deepbrain share --export ./public

# RSS 自动订阅导入
deepbrain sync rss --add https://blog.example.com/feed.xml
deepbrain sync rss --run
```

---

## 🌐 Web 界面

```bash
deepbrain web --port 3000
```

交互式 Web 界面，支持搜索、页面编辑、知识图谱可视化、闪卡复习。默认中文界面。

### Playground 体验

```bash
deepbrain playground    # 无需配置，预置示例知识库
```

---

## 🔌 Chrome 扩展 — 网页剪藏

一键保存网页到大脑。安装说明见 [extension/README.md](extension/README.md)。

---

## 📖 CLI 命令参考

### 基础操作

```bash
deepbrain put <slug> [file]          # 添加/更新页面（自动摘要）
deepbrain get <slug>                 # 读取页面
deepbrain query "文本"               # 语义搜索
deepbrain search "关键词"            # 关键词搜索（支持 --tag, --after, --fuzzy）
deepbrain chat "问题"                # RAG 对话
deepbrain list [--type X]            # 列出页面
deepbrain stats                      # 大脑统计
```

### 导入与同步

```bash
deepbrain import github --repo owner/repo    # 导入 GitHub 仓库
deepbrain import github-stars --user name     # 导入 GitHub Star
deepbrain import youtube <url>               # 导入视频字幕 + 摘要
deepbrain sync rss --add <feed-url>          # 订阅 RSS
deepbrain sync rss --run                     # 抓取所有订阅
deepbrain sync notion --token T --database D # 同步 Notion
deepbrain watch <vault-path>                 # 监听 Obsidian 仓库
deepbrain batch-import <directory>           # 批量导入 .md/.txt
```

### 知识管理

```bash
deepbrain dream                      # 运行维护循环
deepbrain graph                      # 构建知识图谱
deepbrain graph query "实体"          # 查询实体关系
deepbrain related <slug>             # 查找相关页面
deepbrain link <from> <to>           # 手动链接
deepbrain timeline <slug> "文本"     # 添加时间线
deepbrain tiers stats                # 记忆分层统计
deepbrain compress [slug]            # 压缩旧记忆
deepbrain retag                      # LLM 重新打标签
```

### 学习与分享

```bash
deepbrain flashcards generate        # 从知识生成闪卡
deepbrain flashcards review          # SM-2 间隔重复复习
deepbrain digest --period weekly     # 知识周报
deepbrain share --port 8080          # 只读 Web 分享
deepbrain share --export ./site      # 导出静态站点
```

### 多大脑管理

```bash
deepbrain init --brain work openai   # 创建命名大脑
deepbrain --brain work put ...       # 使用指定大脑
deepbrain chat "q" --brains a,b,c   # 跨大脑查询
deepbrain merge source target        # 合并大脑
deepbrain list-brains                # 查看所有大脑
```

### 备份与恢复

```bash
deepbrain backup --output brain.zip  # 完整备份
deepbrain restore brain.zip          # 从备份恢复
```

---

## 🔌 MCP Server

DeepBrain 可作为 MCP（Model Context Protocol）工具服务器，接入 Claude Desktop、Cursor 等 AI 助手：

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

提供 12 个工具：`put` · `get` · `query` · `search` · `link` · `unlink` · `get-links` · `timeline-add` · `get-timeline` · `list` · `stats` · `dream`

---

## 🥊 竞品对比

| 功能 | DeepBrain | Obsidian | Notion | Mem.ai | 腾讯 IMA |
|------|-----------|----------|--------|--------|---------|
| **本地优先** | ✅ PGLite | ✅ 文件 | ❌ 云端 | ❌ 云端 | ❌ 云端 |
| **语义搜索** | ✅ 混合搜索 | ❌ 关键词 | ❌ 关键词 | ✅ | ❌ |
| **自动摘要** | ✅ LLM | ❌ | ❌ AI 插件 | ✅ | ✅ |
| **知识图谱** | ✅ 自动 | 🟡 手动 | ❌ | ❌ | ❌ |
| **导入平台** | ✅ 21 个 | 🟡 插件 | 🟡 有限 | ❌ | 仅微信 |
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
┌──────────────────────────────────────────────────────────┐
│                    DeepBrain CLI / SDK                     │
├──────────┬───────────┬──────────┬─────────┬──────────────┤
│  导入    │  搜索     │  梦境    │  图谱   │   协作       │
│ 21 平台  │ 混合搜索  │  循环    │  自动   │  分享/RSS    │
├──────────┴───────────┴──────────┴─────────┴──────────────┤
│                    核心大脑引擎                            │
│       页面 · 分块 · 链接 · 时间线 · 标签 · 闪卡           │
├──────────────────────────────────────────────────────────┤
│  PGLite + pgvector（嵌入式）  │  agentkits（多提供商 AI） │
│  零配置本地数据库             │  7 个 AI 提供商            │
└──────────────────────────────────────────────────────────┘

支持的 AI 提供商：
  ollama · openai · gemini · deepseek · dashscope（通义千问）· zhipu（智谱）· moonshot
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

// 知识图谱
import { buildKnowledgeGraph } from 'deepbrain/tag-graph';
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
<summary><b>English Version</b></summary>

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

## Features

- **Hybrid Search** — Semantic + keyword with automatic ranking
- **Knowledge Graph** — Auto-extract entities and relationships
- **Flashcards** — SM-2 spaced repetition from your knowledge
- **24 Importers** — Notion, Obsidian, Evernote, Logseq, Roam, Bear, Joplin, Readwise, Day One, Apple Notes, Google Keep, OneNote, 8 Chinese platforms, GitHub, YouTube, EPUB/PDF…
- **Local-first** — PGLite + pgvector, no external database
- **MCP Server** — Connect Claude Desktop, Cursor, and other AI assistants
- **7 AI Providers** — ollama, openai, gemini, deepseek, dashscope, zhipu, moonshot

See the Chinese sections above for full CLI reference, architecture, and comparison table.

</details>
