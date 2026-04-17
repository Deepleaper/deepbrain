<div align="center">

# 🧠 DeepBrain

**Agent 记忆引擎 — 让 AI 越用越聪明**

[![npm](https://img.shields.io/npm/v/deepbrain)](https://www.npmjs.com/package/deepbrain)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

[快速开始](#快速开始) · [核心概念](#核心概念) · [API 文档](#api-文档) · [English](#english)

</div>

---

## 💡 一句话介绍

> **不是 RAG，不是知识库。DeepBrain 是 Agent 的大脑 — 会学习、会记忆、会进化。**

现有 Agent 框架的痛点：**每次对话都从零开始**。Agent 不记得昨天学到的，不记得上周犯的错，换个人接手一切归零。

DeepBrain 用三个 API 解决：

```
brain.learn()   → 把经验写入记忆
brain.recall()  → 需要时检索相关记忆  
brain.evolve()  → 定期提炼，知识越来越精而不是越来越多
```

## 🎯 和竞品的区别

| | Mem0 | LangChain Memory | Letta | **DeepBrain** |
|---|---|---|---|---|
| 定位 | 记忆存储 | 对话历史 | 有状态 Agent | **Agent 记忆引擎** |
| 核心能力 | CRUD | 窗口管理 | 状态机 | **learn/recall/evolve** |
| 知识提炼 | ❌ | ❌ | ❌ | ✅ **自动进化** |
| 记忆分层 | ❌ | ❌ | ✅ 3层 | ✅ **Core/Working/Archival** |
| 框架绑定 | 独立 | LangChain | Letta | **任意框架** |
| 本地运行 | 需要服务 | 内存 | 需要服务 | ✅ **PGLite 零依赖** |

**一句话：别人管存，DeepBrain 管"炼"。**

## 快速开始

```bash
npm install deepbrain
```

```typescript
import { Brain, AgentBrain } from 'deepbrain';

// 1. 初始化大脑
const brain = new Brain({ embedding_provider: 'openai' });
await brain.connect();
const agent = new AgentBrain(brain, 'my-sales-agent');

// 2. 学习 — Agent 每次交互后自动存储
await agent.learn({
  action: '客户问了退货政策',
  result: '7天无理由退货，需保留包装',
  context: { customer: 'VIP', channel: 'wechat' }
});

// 3. 回忆 — 需要时自动检索
const memories = await agent.recall('这个客户之前问过什么？');
// → [{ text: '客户问了退货政策...', score: 0.92 }]

// 4. 进化 — 定期运行，提炼知识
const report = await agent.evolve();
// → 把 50 条零散经验提炼成 3 条知识
```

## 核心概念

### 三个 API

| API | 做什么 | 什么时候调 |
|-----|-------|----------|
| `learn()` | 存储经验/知识 | 每次 Agent 完成任务后 |
| `recall()` | 语义检索记忆 | 每次 Agent 需要上下文时 |
| `evolve()` | 提炼+升级记忆 | 定时任务（如每天凌晨） |

### 记忆分层

```
Core     (≤20条)   — 始终在上下文中，最重要的知识
Working  (≤50条)   — 当前活跃，频繁访问的记忆
Archival (无限)    — 长期存储，按需检索
```

访问频率高 → 自动升级。长期不用 → 自动降级。

### 知识进化 (evolve)

这是 DeepBrain 最核心的差异化：

```
Day 1: 50条零散的客户对话记录
Day 7: evolve() → 提炼为 5 条客户偏好知识
Day 30: evolve() → 进一步精炼为 2 条核心洞察
```

**知识越来越精，而不是越来越多。**

### Memory Adapters

DeepBrain 不绑定任何框架。通过适配层对接：

```typescript
import { adapters } from 'deepbrain';

// OpenClaw 适配
const openclaw = adapters.openclaw;

// 原生适配（任何框架）
const native = adapters.native;

// 更多适配层开发中：LangChain, CrewAI, AutoGen...
```

## 全部特性

| 类别 | 特性 |
|------|------|
| 🧠 **记忆** | learn/recall/evolve 三件套、Memory Tiers 自动升降级 |
| 🔍 **搜索** | 向量语义搜索 + 全文检索、混合排序 |
| 🔄 **维护** | evolve 知识提炼、dream 自动维护周期 |
| 🔌 **适配** | OpenClaw / Native 适配层、可扩展接口 |
| 📥 **导入** | 24+ importers（Markdown/Notion/Obsidian/Logseq/Readwise...） |
| 🤖 **AI** | 7 providers（OpenAI/Gemini/DeepSeek/通义千问/智谱/Moonshot/Ollama） |
| 🛠️ **集成** | MCP Server、REST API、Web UI |
| 💾 **存储** | PGLite 本地零依赖、向量索引 |

## CLI 命令

```bash
deepbrain learn "客户偏好：周一上午开会"    # 学习
deepbrain recall "客户什么时候开会？"        # 检索
deepbrain evolve                            # 知识进化
deepbrain query "退货政策"                  # 语义搜索
deepbrain serve                             # Web UI + API
deepbrain import notion ./export            # 导入 Notion
deepbrain dream                             # 维护周期
deepbrain stats                             # 查看统计
```

## 架构

```
┌─────────────────────────────────────────┐
│         你的 Agent 框架                   │
│   (OpenClaw / LangChain / 自研 / ...)    │
├─────────────────────────────────────────┤
│         Memory Adapters                  │
│   (openclaw / langchain / native)        │
├─────────────────────────────────────────┤
│         AgentBrain API                   │
│   learn() · recall() · evolve()          │
├─────────────────────────────────────────┤
│         Brain Engine                     │
│   向量搜索 · FTS · 知识图谱 · 分层        │
├─────────────────────────────────────────┤
│         PGLite + Embeddings              │
│   本地存储 · 零依赖 · 零成本              │
└─────────────────────────────────────────┘
```

## 🔗 生态

DeepBrain 是跃盟开源四件套之一：

| 项目 | 定位 | 关系 |
|------|------|------|
| **DeepBrain** | Agent 记忆引擎 | ← 你在这里 |
| [opc-agent](https://github.com/Deepleaper/opc-agent) | Agent OS | Traces → learn() |
| [agentkits](https://github.com/Deepleaper/agentkits) | 带记忆的 OpenRouter | 自动 recall + learn |
| [agent-workstation](https://github.com/Deepleaper/agent-workstation) | 虚拟工位模板 | brain-seed.md → L1 |

```
opc-agent 收集 Traces → DeepBrain 学习 → agentkits 调用时自动 recall → Agent 越来越聪明
```

## License

Apache-2.0 — 免费商用，欢迎贡献。

---

<a name="english"></a>

## English

**DeepBrain** is an Agent Memory Engine that makes AI agents smarter over time.

Three core APIs: `learn()` (store experience), `recall()` (semantic retrieval), `evolve()` (consolidate knowledge).

Key differentiator: **evolve()** — knowledge gets refined, not just accumulated.

Features: Memory tiers (Core/Working/Archival), 24+ importers, 7 AI providers, MCP server, local-first (PGLite).

```bash
npm install deepbrain
```

Part of Deepleaper's open-source suite: [opc-agent](https://github.com/Deepleaper/opc-agent) · [agentkits](https://github.com/Deepleaper/agentkits) · [agent-workstation](https://github.com/Deepleaper/agent-workstation)
