# 🧠 DeepBrain — Agent Memory Engine

**让 Agent 越用越聪明的记忆引擎。**

> 不是 RAG，不是 PKM。DeepBrain 是 Agent 的大脑 — 学习、记忆、进化。

## 为什么需要 DeepBrain？

现有 Agent 框架的痛点：**每次对话都从零开始**。Agent 不记得昨天学到的，不记得上周犯的错。

DeepBrain 解决这个问题：
- `brain.learn()` — Agent 自动把经验写入记忆
- `brain.recall()` — 需要时自动检索相关记忆
- `brain.evolve()` — 定期提炼，让知识越来越精而不是越来越多

## Quick Start

```bash
npm install deepbrain
```

```typescript
import { Brain, AgentBrain } from 'deepbrain';

// 初始化
const brain = new Brain({ embedding_provider: 'openai' });
await brain.connect();
const agent = new AgentBrain(brain, 'my-agent');

// 学习
await agent.learn({ action: '客户问了退货政策', result: '7天无理由退货' });

// 回忆
const memories = await agent.recall('退货政策是什么？');

// 进化（定期运行）
const report = await agent.evolve();
console.log(`提炼了 ${report.tracesProcessed} 条经验`);
```

## 核心特性

| 特性 | 说明 |
|------|------|
| 🧠 learn/recall/evolve | 三个 API 搞定 Agent 记忆 |
| 📊 Memory Tiers | Core → Working → Archival 自动升降级 |
| 🔄 Evolve Cycle | 自动提炼，知识越来越精 |
| 🔌 Memory Adapters | 适配 OpenClaw、LangChain 等框架 |
| 🔍 Hybrid Search | 向量语义 + 全文检索 |
| 📥 24+ Importers | Markdown、Notion、Obsidian、Logseq... |
| 🤖 7 AI Providers | OpenAI、Gemini、DeepSeek、通义千问... |
| 🛠️ MCP Server | 标准 MCP 协议接入 |

## 架构

```
Agent Framework (OpenClaw / LangChain / ...)
        ↓ learn() / recall()
┌─────────────────────────┐
│     AgentBrain API      │  ← 你在这里
├─────────────────────────┤
│   Memory Adapters       │  ← 适配不同框架
├─────────────────────────┤
│   Brain Engine          │  ← 向量 + FTS + Graph
├─────────────────────────┤
│   PGLite + Embeddings   │  ← 零依赖本地存储
└─────────────────────────┘
```

## CLI

```bash
# 学习
deepbrain learn "客户偏好：每周一上午开会"

# 检索
deepbrain recall "客户什么时候开会？"

# 知识进化
deepbrain evolve

# 语义搜索
deepbrain query "退货政策"

# 启动 Web UI
deepbrain serve
```

## 与 agentkits 配合

```typescript
import { withBrain } from 'agentkits';

// 每次 LLM 调用自动 recall + learn
const chat = withBrain(llm.chat, { brainUrl: 'http://localhost:3333' });
```

## 与 opc-agent 配合

opc-agent 自动收集 Traces → 喂给 DeepBrain learn() → Agent 越来越聪明。

## License

Apache-2.0

## Links

- [opc-agent](https://github.com/Deepleaper/opc-agent) — Agent OS
- [agentkits](https://github.com/Deepleaper/agentkits) — 带记忆的 OpenRouter
- [agent-workstation](https://github.com/Deepleaper/agent-workstation) — 虚拟工位模板库
