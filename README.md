<div align="center">

# 🧠 DeepBrain

**Agent 的大脑 — 会学习、会进化的知识引擎**

[![npm version](https://img.shields.io/badge/npm-v1.11.0-blue)](https://www.npmjs.com/package/deepbrain)
[![License](https://img.shields.io/badge/License-LGPL_3.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

**不只是存储，是真正会进化的记忆系统。**

[快速开始](#快速开始) · [功能亮点](#功能亮点) · [API 参考](#api-参考) · [CLI 参考](#cli-参考) · [架构](#架构) · [English](#english)

</div>

---

## 💡 一句话介绍

> **不是 RAG，不是知识库。DeepBrain 是 Agent 的大脑 — 会学习、会记忆、会进化。**

现有 Agent 框架的痛点：**每次对话都从零开始**。Agent 不记得昨天学到的，不记得上周犯的错，换个人接手一切归零。

DeepBrain 用三层 API 解决：

```typescript
brain.put()     // 存储知识
brain.query()   // 语义检索
agent.learn()   // 把经验写入记忆
agent.recall()  // 需要时检索相关记忆
agent.evolve()  // 定期提炼，知识越来越精而不是越来越多
```

## 快速开始

```bash
npm install deepbrain
```

```typescript
import { Brain } from 'deepbrain';

const brain = new Brain({
  database: './my-brain.db',
  embedding_provider: 'ollama',
});
await brain.connect();

// 存入知识
await brain.put('meeting-notes', '# Q2 Planning\n- Launch by June...');

// 语义检索
const results = await brain.query('when is the launch?');
console.log(results[0].content);
```

### Agent 记忆用法

```typescript
import { Brain, AgentBrain } from 'deepbrain';

const brain = new Brain({ embedding_provider: 'openai' });
await brain.connect();
const agent = new AgentBrain(brain, 'my-sales-agent');

// 学习 — Agent 每次交互后自动存储
await agent.learn({
  action: '客户问了退货政策',
  result: '7天无理由退货，需保留包装',
  context: { customer: 'VIP', channel: 'wechat' },
});

// 回忆 — 需要时自动检索
const memories = await agent.recall('这个客户之前问过什么？');
// → [{ text: '客户问了退货政策...', score: 0.92 }]

// 进化 — 定期运行，提炼知识
const report = await agent.evolve();
// → 把 50 条零散经验提炼成 3 条知识
```

## 🏗️ 三层知识架构 (3-Tier Knowledge Architecture)

DeepBrain 支持与 [Agent Workstation](https://github.com/Deepleaper/agent-workstation) 配合的三层知识种子体系：

```
🏭 行业知识 (Industry)    → 19 个行业分类，通用行业概念与最佳实践
💼 岗位知识 (Job)         → 100 个岗位角色，岗位专业知识与方法论
🔧 工位知识 (Workstation) → 100 个工位场景，SOP、常见问题、质量标准
```

通过 `BrainSeedLoader` 自动加载三层知识种子：

```typescript
import { Brain, BrainSeedLoader } from 'deepbrain';

const brain = new Brain({ database: './my-brain.db' });
await brain.connect();

// 从 brain-seeds/ 目录自动加载三层种子
const loader = new BrainSeedLoader(brain);
await loader.loadFromDirectory('./brain-seeds/');
// → 加载 industry.md, job.md, workstation.md
```

### 🔄 自下而上知识进化 (Bottom-Up Knowledge Evolution)

知识不是静态的——DeepBrain 的 `KnowledgeEvolver` 实现自下而上的自动知识提炼：

```
工位知识 (Workstation)  →  岗位知识 (Job)  →  行业知识 (Industry)
     具体经验沉淀            方法论提炼           行业最佳实践
```

```typescript
import { KnowledgeEvolver } from 'deepbrain';

const evolver = new KnowledgeEvolver(brain);

// 工位级经验自动提炼为岗位级知识
await evolver.evolveUp('workstation', 'job');

// 岗位级知识自动提炼为行业级最佳实践
await evolver.evolveUp('job', 'industry');
```

**飞轮效应**：越多 Agent 使用 → 工位经验越丰富 → 自动提炼更优的岗位和行业知识 → 新 Agent 起步更高。

---

## 功能亮点

| | 特性 | 说明 |
|---|---|---|
| 🧠 | **Brain（知识管理）** | `put` / `get` / `query` / `search` / `list` — 知识存储与检索 |
| 🤖 | **AgentBrain（Agent 记忆）** | `learn` / `recall` / `evolve` — 让 Agent 越用越聪明 |
| 🌱 | **BrainSeedLoader** | 三层知识种子自动加载，Agent 创建即有行业记忆 |
| 🔄 | **KnowledgeEvolver** | 自下而上知识进化，工位→岗位→行业自动提炼 |
| 📈 | **知识进化** | traces 聚类→合并→去重→沉淀，自动 evolve |
| 🔍 | **RAG Pipeline** | `DocumentParser` + 5 种 Chunker + 4 种 Reranker，一站式文档智能 |
| 🕸️ | **知识图谱** | 页面关联、标签、时间线，结构化知识网络 |
| 💤 | **Dream 模式** | 离线知识整理和巩固，模拟人类睡眠记忆 |
| 🎨 | **Web UI** | `deepbrain ui` 可视化管理 — 知识图谱、搜索、编辑 |
| 🔗 | **7 个 AI Provider** | Ollama / OpenAI / Gemini / DeepSeek / DashScope / Zhipu / Moonshot |
| 💾 | **PGLite 内嵌** | 零配置，无需外部数据库，开箱即用 |
| 📦 | **MCP Server** | 可被 Claude / Cursor 等 AI 工具直接调用 |

### 🎯 和竞品的区别

| | Mem0 | LangChain Memory | Letta | **DeepBrain** |
|---|---|---|---|---|
| 定位 | 记忆存储 | 对话历史 | 有状态 Agent | **Agent 知识引擎** |
| 核心能力 | CRUD | 窗口管理 | 状态机 | **learn / recall / evolve** |
| 知识提炼 | ❌ | ❌ | ❌ | ✅ **自动进化** |
| 记忆分层 | ❌ | ❌ | ✅ 3 层 | ✅ **Core / Working / Archival** |
| 本地运行 | 需要服务 | 内存 | 需要服务 | ✅ **PGLite 零依赖** |
| 框架绑定 | 独立 | LangChain | Letta | **任意框架** |

**一句话：别人管存，DeepBrain 管"炼"。**

## API 参考

### Brain — 知识管理

| 方法 | 说明 |
|------|------|
| `brain.connect()` | 连接数据库 |
| `brain.put(slug, content, meta?)` | 写入/更新页面 |
| `brain.get(slug)` | 读取页面 |
| `brain.query(text, opts?)` | 语义搜索 |
| `brain.search(keyword, opts?)` | 关键词搜索 |
| `brain.list(filters?)` | 列出页面 |
| `brain.link(from, to, type?)` | 创建页面关联 |
| `brain.timeline(slug, date, text)` | 添加时间线条目 |
| `brain.stats()` | 查看统计 |
| `brain.health()` | 健康检查 |
| `brain.close()` | 关闭连接 |

### AgentBrain — Agent 记忆

| 方法 | 说明 |
|------|------|
| `agent.learn(trace)` | 存储经验/知识 |
| `agent.recall(query, opts?)` | 语义检索记忆 |
| `agent.evolve(opts?)` | 提炼 + 升级记忆 |

### RAG Pipeline — 文档智能

| 方法 | 说明 |
|------|------|
| `DocumentParser.parse(file)` | 解析文档（PDF / Markdown / HTML / TXT / DOCX） |
| `Chunker.chunk(doc, strategy?)` | 分块（recursive / sentence / paragraph / semantic / fixed） |
| `pipeline.ingestFile(file)` | 一键导入文件 |
| `pipeline.retrieve(query, opts?)` | 检索并重排序 |
| `Reranker.rerank(results)` | 重排序（cross-encoder / mmr / cohere / bge） |

### 更多模块

| 模块 | 说明 |
|------|------|
| `dream(brain)` | Dream 模式 — 离线知识整理 |
| `TagGraph` | 标签图谱 — 聚类、推荐、树状结构 |
| `backupBrain()` / `restoreBrain()` | 备份与恢复 |
| `shareBrain()` / `mergeBrains()` | 协作与合并 |
| `startWebUI(config)` | 启动 Web UI |
| `startServer(config)` | 启动 REST API |
| `generateFlashcards()` | 闪卡生成（SM-2 算法） |
| `generateDigest()` | 智能摘要 |
| `buildKnowledgeGraph()` | 构建知识图谱 |
| `extractEntities()` | 实体抽取 |
| `advancedSearch()` | 高级搜索（Faceted） |
| `injectMemories()` | 主动记忆注入 |
| `runCompression()` | 知识压缩 |

## CLI 参考

```bash
# 知识管理
deepbrain put <slug> <file>          # 写入页面
deepbrain get <slug>                 # 读取页面
deepbrain query "text"               # 语义搜索
deepbrain search "keyword"           # 关键词搜索
deepbrain list [--type X]            # 列出页面

# Agent 记忆
deepbrain learn "经验内容"            # 学习
deepbrain recall "相关问题"           # 检索
deepbrain evolve [--dry-run]         # 知识进化

# RAG 管道
deepbrain ingest <file>              # 导入文档（自动解析+分块+嵌入）
deepbrain retrieve "query"           # 检索（带重排序）

# 工具
deepbrain ui [--port 3000]           # 启动 Web UI（知识图谱 + 搜索 + 编辑）
deepbrain dream                      # 离线知识整理
deepbrain stats                      # 查看统计
deepbrain chat "question"            # 对话模式
deepbrain init [provider]            # 初始化
deepbrain doctor                     # 健康诊断
deepbrain backup / restore           # 备份恢复
deepbrain retag                      # LLM 重新打标签
```

## 架构

```
┌─────────────┐
│  Agent App  │
├─────────────┤
│ AgentBrain  │  learn() / recall() / evolve()
├─────────────┤
│   Brain     │  put() / get() / query() / search()
├─────────────┤
│ RAG Pipeline│  parse → chunk → embed → store → retrieve → rerank
├─────────────┤
│  PGLite DB  │  pages / chunks / links / tags / timeline
└─────────────┘
```

### 知识进化流程

```
Day 1:   50 条零散的客户对话记录
Day 7:   evolve() → 提炼为 5 条客户偏好知识
Day 30:  evolve() → 进一步精炼为 2 条核心洞察
```

**知识越来越精，而不是越来越多。**

### 记忆分层

```
Core     (≤20 条)  — 始终在上下文中，最重要的知识
Working  (≤50 条)  — 当前活跃，频繁访问的记忆
Archival (无限)    — 长期存储，按需检索
```

访问频率高 → 自动升级。长期不用 → 自动降级。

## 与 OPC Agent 集成

在 `agent.yaml` 中配置 DeepBrain：

```yaml
brain:
  provider: deepbrain
  database: ./brain.db
  embedding_provider: ollama
  embedding_model: nomic-embed-text
  evolve:
    schedule: "0 3 * * *"    # 每天凌晨 3 点自动进化
    strategy: cluster
    min_traces: 10
```

OPC Agent 会自动将 Traces 写入 DeepBrain，定时触发 evolve，实现 Agent 持续学习。

## 🔗 四件套生态

DeepBrain 是跃盟开源四件套之一：

| 项目 | 定位 | 关系 |
|------|------|------|
| **🧠 DeepBrain** | Agent 知识引擎 | ← 你在这里 |
| [🤖 opc-agent](https://github.com/Deepleaper/opc-agent) | Agent OS | Traces → `learn()` |
| [⚡ agentkits](https://github.com/Deepleaper/agentkits) | 带记忆的 OpenRouter | 自动 `recall` + `learn` |
| [🏢 agent-workstation](https://github.com/Deepleaper/agent-workstation) | 虚拟工位模板 | brain-seed.md → 初始知识 |

```
opc-agent 收集 Traces → DeepBrain 学习+进化 → agentkits 调用时自动 recall → Agent 越来越聪明
```

## Contributing

欢迎贡献！请提交 Issue 或 Pull Request。

```bash
git clone https://github.com/Deepleaper/deepbrain.git
cd deepbrain
npm install
npm run build
npm test
```

## License

DeepBrain is dual-licensed:

- **Open Source**: [LGPL-3.0](./LICENSE) — free for open-source and commercial use (modifications must be shared)
- **Commercial**: [Contact us](mailto:licensing@deepleaper.com) for proprietary use without open-source obligations

**Attribution Required**: All deployments must display "Powered by DeepBrain — Deepleaper (跃盟科技)" in a visible location. Attribution removal requires a commercial license.

See [LICENSE-COMMERCIAL](./LICENSE-COMMERCIAL) for details.

---

<a name="english"></a>

<div align="center">

# 🧠 DeepBrain — English

**The Brain for Your AI Agent — It Learns, Remembers, and Evolves**

</div>

## What Is DeepBrain?

> **Not RAG. Not a knowledge base. DeepBrain is the brain for your AI Agent — it learns, remembers, and evolves.**

The pain point with existing Agent frameworks: **every conversation starts from scratch**. The agent doesn't remember what it learned yesterday, forgets last week's mistakes, and when someone else takes over, everything resets to zero.

DeepBrain solves this with a layered API:

```typescript
brain.put()     // Store knowledge
brain.query()   // Semantic search
agent.learn()   // Write experience into memory
agent.recall()  // Retrieve relevant memories when needed
agent.evolve()  // Periodically refine — knowledge gets sharper, not bigger
```

## Quick Start

```bash
npm install deepbrain
```

```typescript
import { Brain } from 'deepbrain';

const brain = new Brain({
  database: './my-brain.db',
  embedding_provider: 'ollama',
});
await brain.connect();

await brain.put('meeting-notes', '# Q2 Planning\n- Launch by June...');

const results = await brain.query('when is the launch?');
console.log(results[0].content);
```

### Agent Memory Usage

```typescript
import { Brain, AgentBrain } from 'deepbrain';

const brain = new Brain({ embedding_provider: 'openai' });
await brain.connect();
const agent = new AgentBrain(brain, 'my-sales-agent');

// Learn — store after each interaction
await agent.learn({
  action: 'Customer asked about return policy',
  result: '7-day no-questions-asked return, original packaging required',
  context: { customer: 'VIP', channel: 'wechat' },
});

// Recall — retrieve when needed
const memories = await agent.recall('What did this customer ask before?');
// → [{ text: 'Customer asked about return policy...', score: 0.92 }]

// Evolve — run periodically to refine knowledge
const report = await agent.evolve();
// → Distills 50 scattered experiences into 3 pieces of knowledge
```

## 3-Tier Knowledge Architecture

DeepBrain supports a 3-tier knowledge seed system with [Agent Workstation](https://github.com/Deepleaper/agent-workstation):

```
🏭 Industry Knowledge   → 19 industry categories, universal concepts & best practices
💼 Job Knowledge         → 100 job roles, professional knowledge & methodologies
🔧 Workstation Knowledge → 100 workstation scenarios, SOPs, FAQs, quality standards
```

Auto-load 3-tier seeds via `BrainSeedLoader`:

```typescript
import { Brain, BrainSeedLoader } from 'deepbrain';

const brain = new Brain({ database: './my-brain.db' });
await brain.connect();

const loader = new BrainSeedLoader(brain);
await loader.loadFromDirectory('./brain-seeds/');
// → Loads industry.md, job.md, workstation.md
```

### Bottom-Up Knowledge Evolution

Knowledge isn't static — `KnowledgeEvolver` enables automatic bottom-up refinement:

```
Workstation → Job → Industry
  concrete       methodology     best practices
```

```typescript
import { KnowledgeEvolver } from 'deepbrain';

const evolver = new KnowledgeEvolver(brain);
await evolver.evolveUp('workstation', 'job');
await evolver.evolveUp('job', 'industry');
```

**Flywheel effect**: More agents → richer workstation experience → auto-refined job/industry knowledge → new agents start smarter.

---

## Feature Highlights

| | Feature | Description |
|---|---|---|
| 🧠 | **Brain (Knowledge Management)** | `put` / `get` / `query` / `search` / `list` |
| 🤖 | **AgentBrain (Agent Memory)** | `learn` / `recall` / `evolve` — agents get smarter over time |
| 🌱 | **BrainSeedLoader** | Auto-load 3-tier knowledge seeds, no cold start |
| 🔄 | **KnowledgeEvolver** | Bottom-up knowledge evolution: workstation → job → industry |
| 📈 | **Knowledge Evolution** | Traces cluster → merge → deduplicate → distill, auto evolve |
| 🔍 | **RAG Pipeline** | `DocumentParser` + 5 chunkers + 4 rerankers |
| 🕸️ | **Knowledge Graph** | Page links, tags, timeline — structured knowledge network |
| 💤 | **Dream Mode** | Offline knowledge consolidation, inspired by human sleep memory |
| 🎨 | **Web UI** | `deepbrain ui` — visual knowledge graph, search, and editing |
| 🔗 | **7 AI Providers** | Ollama / OpenAI / Gemini / DeepSeek / DashScope / Zhipu / Moonshot |
| 💾 | **Embedded PGLite** | Zero config, no external database required |
| 📦 | **MCP Server** | Callable by Claude, Cursor, and other AI tools |

### Competitive Comparison

| | Mem0 | LangChain Memory | Letta | **DeepBrain** |
|---|---|---|---|---|
| Positioning | Memory storage | Conversation history | Stateful Agent | **Agent Knowledge Engine** |
| Core capability | CRUD | Window management | State machine | **learn / recall / evolve** |
| Knowledge refinement | ❌ | ❌ | ❌ | ✅ **Auto-evolve** |
| Memory tiers | ❌ | ❌ | ✅ 3 tiers | ✅ **Core / Working / Archival** |
| Local-first | Requires service | In-memory | Requires service | ✅ **PGLite, zero deps** |
| Framework lock-in | Standalone | LangChain | Letta | **Any framework** |

**In one line: others store memories; DeepBrain *refines* them.**

## API Reference

### Brain — Knowledge Management

| Method | Description |
|--------|-------------|
| `brain.connect()` | Connect to database |
| `brain.put(slug, content, meta?)` | Write/update a page |
| `brain.get(slug)` | Read a page |
| `brain.query(text, opts?)` | Semantic search |
| `brain.search(keyword, opts?)` | Keyword search |
| `brain.list(filters?)` | List pages |
| `brain.link(from, to, type?)` | Create page link |
| `brain.timeline(slug, date, text)` | Add timeline entry |
| `brain.stats()` | View statistics |
| `brain.health()` | Health check |
| `brain.close()` | Close connection |

### AgentBrain — Agent Memory

| Method | Description |
|--------|-------------|
| `agent.learn(trace)` | Store experience/knowledge |
| `agent.recall(query, opts?)` | Semantic memory retrieval |
| `agent.evolve(opts?)` | Refine + upgrade memories |

### RAG Pipeline

| Method | Description |
|--------|-------------|
| `DocumentParser.parse(file)` | Parse documents (PDF / Markdown / HTML / TXT / DOCX) |
| `Chunker.chunk(doc, strategy?)` | Chunk (recursive / sentence / paragraph / semantic / fixed) |
| `pipeline.ingestFile(file)` | One-click file ingestion |
| `pipeline.retrieve(query, opts?)` | Retrieve with reranking |
| `Reranker.rerank(results)` | Rerank (cross-encoder / mmr / cohere / bge) |

### Additional Modules

| Module | Description |
|--------|-------------|
| `dream(brain)` | Dream mode — offline knowledge consolidation |
| `TagGraph` | Tag graph — clustering, recommendations, tree structure |
| `backupBrain()` / `restoreBrain()` | Backup & restore |
| `shareBrain()` / `mergeBrains()` | Collaboration & merge |
| `startWebUI(config)` | Start Web UI |
| `startServer(config)` | Start REST API server |
| `generateFlashcards()` | Flashcard generation (SM-2 algorithm) |
| `generateDigest()` | Smart digest |
| `buildKnowledgeGraph()` | Build knowledge graph |
| `extractEntities()` | Entity extraction |
| `advancedSearch()` | Advanced search (faceted) |
| `injectMemories()` | Proactive memory injection |
| `runCompression()` | Knowledge compression |

## CLI Reference

```bash
# Knowledge Management
deepbrain put <slug> <file>          # Write a page
deepbrain get <slug>                 # Read a page
deepbrain query "text"               # Semantic search
deepbrain search "keyword"           # Keyword search
deepbrain list [--type X]            # List pages

# Agent Memory
deepbrain learn "experience"         # Learn
deepbrain recall "related question"  # Recall
deepbrain evolve [--dry-run]         # Knowledge evolution

# RAG Pipeline
deepbrain ingest <file>              # Ingest document (auto parse+chunk+embed)
deepbrain retrieve "query"           # Retrieve (with reranking)

# Tools
deepbrain ui [--port 3000]           # Start Web UI (knowledge graph + search + edit)
deepbrain dream                      # Offline knowledge consolidation
deepbrain stats                      # View statistics
deepbrain chat "question"            # Chat mode
deepbrain init [provider]            # Initialize
deepbrain doctor                     # Health diagnostics
deepbrain backup / restore           # Backup & restore
deepbrain retag                      # LLM re-tagging
```

## Architecture

```
┌─────────────┐
│  Agent App  │
├─────────────┤
│ AgentBrain  │  learn() / recall() / evolve()
├─────────────┤
│   Brain     │  put() / get() / query() / search()
├─────────────┤
│ RAG Pipeline│  parse → chunk → embed → store → retrieve → rerank
├─────────────┤
│  PGLite DB  │  pages / chunks / links / tags / timeline
└─────────────┘
```

### Knowledge Evolution Flow

```
Day 1:   50 scattered customer conversation records
Day 7:   evolve() → Refined into 5 customer preference insights
Day 30:  evolve() → Further distilled into 2 core insights
```

**Knowledge gets sharper, not bigger.**

### Memory Tiers

```
Core     (≤20 items)  — Always in context, most important knowledge
Working  (≤50 items)  — Currently active, frequently accessed memories
Archival (unlimited)  — Long-term storage, retrieved on demand
```

High access frequency → auto-promoted. Long unused → auto-demoted.

## OPC Agent Integration

Configure DeepBrain in `agent.yaml`:

```yaml
brain:
  provider: deepbrain
  database: ./brain.db
  embedding_provider: ollama
  embedding_model: nomic-embed-text
  evolve:
    schedule: "0 3 * * *"    # Auto-evolve at 3 AM daily
    strategy: cluster
    min_traces: 10
```

OPC Agent automatically writes Traces into DeepBrain and triggers evolve on schedule, enabling continuous agent learning.

## 🔗 Ecosystem

DeepBrain is part of Deepleaper's open-source suite:

| Project | Role | Relationship |
|---------|------|-------------|
| **🧠 DeepBrain** | Agent Knowledge Engine | ← You are here |
| [🤖 opc-agent](https://github.com/Deepleaper/opc-agent) | Agent OS | Traces → `learn()` |
| [⚡ agentkits](https://github.com/Deepleaper/agentkits) | OpenRouter with Memory | Auto `recall` + `learn` |
| [🏢 agent-workstation](https://github.com/Deepleaper/agent-workstation) | Virtual Role Templates | brain-seed.md → Initial knowledge |

```
opc-agent collects Traces → DeepBrain learns + evolves → agentkits auto-recalls → Agents get smarter over time
```

## Contributing

Contributions welcome! Please submit Issues or Pull Requests.

```bash
git clone https://github.com/Deepleaper/deepbrain.git
cd deepbrain
npm install
npm run build
npm test
```

## License

DeepBrain is dual-licensed:

- **Open Source**: [LGPL-3.0](./LICENSE) — free for open-source and commercial use (modifications must be shared)
- **Commercial**: [Contact us](mailto:licensing@deepleaper.com) for proprietary use without open-source obligations

**Attribution Required**: All deployments must display "Powered by DeepBrain — Deepleaper (跃盟科技)" in a visible location. Attribution removal requires a commercial license.

See [LICENSE-COMMERCIAL](./LICENSE-COMMERCIAL) for details.
