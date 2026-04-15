# 🧠 DeepBrain

> 你的个人 AI 知识大脑。导入一切，找到一切。

[![npm](https://img.shields.io/npm/v/deepbrain)](https://www.npmjs.com/package/deepbrain)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-73%2F73%20passed-brightgreen)](https://github.com/Magicray1217/deepbrain)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)

[English](README.md) | **中文**

---

## 问题

你的知识散落在各处——Notion、Obsidian、Evernote、Flomo、飞书、语雀、微信公众号、PDF……当你需要找某个东西时，你得先想起来**放在哪了**。

**DeepBrain** 把所有知识汇集到一处，用 AI 理解它们，让你用自然语言搜索**全部知识**。

## 为什么选 DeepBrain

| 特性 | DeepBrain | Notion AI | Obsidian + Copilot | IMA(腾讯) |
|------|-----------|-----------|-------------------|----------|
| 导入来源 | **21 个平台** | 只有 Notion | 只有 Obsidian | 只有微信 |
| 导出 | **5 种格式** | 只有 PDF | 无 | 无 |
| 自托管 | **✅ 本地运行** | ❌ | 部分 | ❌ |
| 开源 | **MIT** | ❌ | 仅插件 | ❌ |
| 中文平台 | **8 个** | 0 | 0 | 1 |
| AI 提供商 | **7 个，你选** | 只有 OpenAI | 只有 OpenAI | 只有混元 |
| 数据归属 | **100% 你的** | Notion 服务器 | 本地文件 | 腾讯服务器 |
| 标签图谱 | **自动关系发现** | 手动 | 手动 | 无 |
| MCP 集成 | **12 个工具** | 无 | 插件 | 无 |

---

## ⚡ 快速上手

### 安装

```bash
npm install -g deepbrain
```

### 初始化（选你喜欢的 AI 提供商）

```bash
# Google Gemini（推荐，有免费额度）
deepbrain init gemini

# 本地运行 Ollama（零费用，零云依赖）
deepbrain init ollama

# 国内提供商
deepbrain init dashscope    # 阿里通义千问
deepbrain init deepseek     # DeepSeek
deepbrain init zhipu        # 智谱 GLM
```

### 写入你的第一条知识

```bash
deepbrain put 第一条笔记 "# 你好，大脑！
AI Agent 需要结构化的知识库才能工作得好。
标签: #AI #Agent #知识库"

deepbrain put 会议记录 "# 团队会议 2026-04-13
- 决定新 API 使用 TypeScript
- 截止日期：月底
- Action: Ray 审核架构文档"
```

### 用自然语言搜索

```bash
deepbrain query "API 用什么技术？"
# → 返回: 会议记录 (score: 0.89)
#   "决定新 API 使用 TypeScript..."

deepbrain query "AI 需要什么？"
# → 返回: 第一条笔记 (score: 0.92)
#   "AI Agent 需要结构化的知识库..."
```

### 与大脑对话（新功能！）

```bash
deepbrain chat "我们 API 的技术选型是什么？"
# → 🤖 根据你的知识库，团队在 2026-04-13 的会议中决定使用 TypeScript...

deepbrain chat "总结一下我知道的关于 AI 的内容" --provider deepseek
```

### 多大脑管理（新功能！）

```bash
# 创建不同的大脑
deepbrain init gemini --brain work
deepbrain init ollama --brain personal

# 使用指定大脑
deepbrain put 笔记 notes.md --brain work
deepbrain query "项目进度" --brain work

# 查看所有大脑
deepbrain list-brains
```

### 打开 Web 界面

```bash
deepbrain serve
# → 🧠 DeepBrain Web UI 运行在 http://localhost:3000
```

---

## 📥 从任何平台导入（21 个数据源）

**开源生态中覆盖最全的知识导入器。**

### 一条命令导入

```bash
# 导入 Obsidian 笔记库
deepbrain import obsidian ./my-vault

# 导入 Notion 导出
deepbrain import notion ./notion-export

# 导入 Evernote
deepbrain import evernote ./my-notes.enex
```

### 或使用 API

```ts
import { importNotion, importObsidian, importFlomo, importWechat } from 'deepbrain';

// 导入 Obsidian（带进度）
const pages = await importObsidian({
  dir: './my-vault',
  onProgress: (current, total, name) => {
    console.log(`[${current}/${total}] ${name}`);
  },
});
console.log(`导入了 ${pages.length} 个页面`);
```

### 支持的平台

**国际** (12): Notion · Obsidian · Evernote · Roam Research · Logseq · Bear · Apple Notes · Google Keep · OneNote · Joplin · Readwise · Day One

**国内** (8): 语雀 · 飞书 · 石墨 · 微信公众号 · Flomo · 我来(Wolai) · 息流(FlowUs) · 思源笔记

**格式** (2): EPUB · PDF

每个导入器处理平台特有的格式：
- Obsidian: `[[双向链接]]`、`#嵌套/标签`、YAML frontmatter
- Evernote: ENML→Markdown、checkbox 转换
- Roam: `[[页面引用]]`、`((块引用))`、TODO/DONE
- Flomo: `#标签/子标签` 层级、memo 时间戳
- 微信公众号: `js_content` 提取、`og:title` 解析

---

## 📤 导出（5 种格式）

数据是你的，随时带走：

```bash
deepbrain export --format markdown --output ./备份
deepbrain export --format obsidian --output ./我的笔记库     # 直接用 Obsidian 打开
deepbrain export --format logseq --output ./我的图谱         # 直接用 Logseq 打开
deepbrain export --format json --output ./data.json          # 程序处理用
deepbrain export --format html --output ./网站               # 静态网站
```

---

## 🏷️ 标签图谱 — 知识自动关联

标签不只是标记，它们构成了一张**知识关系图**，自动发现知识之间的联系。

### 层级标签

```bash
deepbrain tag 我的笔记 "AI/Agent/RAG"
# 自动创建: AI → AI/Agent → AI/Agent/RAG
```

### 自动推荐

```ts
import { Brain, TagGraph } from 'deepbrain';

const brain = new Brain({ embedding_provider: 'gemini', api_key: 'AIza...' });
await brain.connect();
const tg = new TagGraph(brain);

// "基于这篇笔记，我还应该看什么？"
const related = await tg.recommend('我的笔记', 5);

// "这篇笔记应该打什么标签？"
const suggested = await tg.suggestTags('无标题笔记');

// "我的知识全景是什么样的？"
const graph = await tg.getGraph();

// "把知识自动分组"
const clusters = await tg.cluster();
```

### 标签操作

```ts
// 重命名（所有页面同步更新）
await tg.renameTag('机器学习', 'ML');

// 合并重复标签
await tg.mergeTags(['js', 'javascript', 'JS'], 'JavaScript');

// 找孤立标签（只有 1 个页面）
const orphans = await tg.findOrphanTags();
```

---

## 🔍 混合搜索

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

## 📊 双轨存储

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

## 🔌 MCP Server — 接入 AI 助手

配合 Claude Desktop、Cursor、OpenClaw 使用：

```bash
deepbrain-mcp
```

**12 个工具**: `put` · `get` · `query` · `search` · `link` · `unlink` · `get-links` · `timeline-add` · `get-timeline` · `list` · `stats` · `dream`

---

## 🌐 Web UI

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

## 💤 梦境循环 — 自动维护

```bash
deepbrain dream
```

自动检测：过期页面、缺失 embedding 的 chunk、孤儿 chunk、死链。自动修复并报告。

---

## ✂️ 网页剪藏

保存任意网页到你的大脑：

```ts
import { generateBookmarklet } from 'deepbrain';

const code = generateBookmarklet('http://localhost:3000');
// 拖到书签栏 → 在任意网页点击 → 保存
```

---

## 🏗️ 架构

```
deepbrain/
├── core/          # 🧠 Brain 引擎（PGLite + pgvector）
│   ├── brain.ts   #    CRUD、搜索、链接、标签、时间线
│   ├── schema.ts  #    数据库 Schema
│   └── types.ts   #    TypeScript 接口
├── commands/      # 💬 CLI 命令（chat 等）
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

## CLI 命令参考

```bash
deepbrain init [provider]                  # 初始化
deepbrain init [provider] --brain <name>   # 初始化命名大脑
deepbrain put <slug> [file]                # 添加/更新（自动摘要+打标签）
deepbrain put <slug> [file] --no-summary   # 添加/更新（跳过自动摘要）
deepbrain get <slug>                       # 读取
deepbrain query <text>                     # 语义搜索
deepbrain search <keyword>                 # 关键词搜索
deepbrain chat "question"                  # 与大脑对话（RAG）
deepbrain chat "question" --provider X     # 指定 LLM 提供商
deepbrain tag <slug> <tag>                 # 打标签
deepbrain link <from> <to>                 # 创建链接
deepbrain timeline <slug> <date> <text>    # 添加时间线
deepbrain list [--type note]               # 列表
deepbrain list-brains                      # 列出所有大脑
deepbrain stats                            # 统计
deepbrain dream                            # 维护
deepbrain serve [--port 3000]              # 启动 Web UI
deepbrain export --format <格式> --output <目录>  # 导出

# 全局 Flag
--brain <name>                             # 使用指定大脑（默认: "default"）
```

---

## 📄 开源协议

MIT © [Magicray1217](https://github.com/Magicray1217)

---

## v0.9.0 新功能

- **Memory Operation DSL** — 8 种操作：STORE/MERGE/PROMOTE/DEMOTE/EXPIRE/LOCK/SPLIT/LINK
- **Proactive Memory Injection** — 自动查找相关记忆注入上下文
- **Memory Hierarchy** — Core/Working/Archival 三级记忆自动升降级
- **Temporal Tracking** — 知识演变时间线追踪
- **Memory Compression** — 提取式摘要压缩旧记忆
