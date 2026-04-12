# 🧠 DeepBrain

> Personal AI brain. Store, search, and grow your knowledge.

[![npm](https://img.shields.io/npm/v/deepbrain)](https://www.npmjs.com/package/deepbrain)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**DeepBrain** is a personal knowledge engine inspired by [GBrain](https://github.com/garrytan/gbrain), rebuilt from scratch with:

- 🔌 **Multi-provider** — 7 embedding providers via [agentkits](https://github.com/Magicray1217/agentkits)
- 🇨🇳 **Chinese-friendly** — DeepSeek, DashScope (Qwen), Zhipu (GLM) built-in
- 🏠 **Local-first** — Ollama + PGLite, zero cloud dependency
- ⚡ **Lightweight** — No bloat, just the essentials
- 🔍 **Hybrid search** — Vector (HNSW) + keyword (tsvector) + RRF fusion
- 📊 **Compiled Truth + Timeline** — Current facts vs. historical events
- 🔗 **Knowledge graph** — Bidirectional links between pages
- 💤 **Dream Cycle** — Automated knowledge maintenance

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
deepbrain put "john-doe" "John is a senior engineer at Google. Expert in distributed systems."

# Search
deepbrain query "who knows about distributed systems?"
deepbrain search "Google engineer"

# Link knowledge
deepbrain link john-doe google-company

# Timeline
deepbrain timeline john-doe "Promoted to Staff Engineer"

# Stats & maintenance
deepbrain stats
deepbrain dream
```

## Programmatic API

```ts
import { Brain } from 'deepbrain';

const brain = new Brain({
  embedding_provider: 'deepseek',
  api_key: process.env.DEEPSEEK_API_KEY,
});
await brain.connect();

// Store
await brain.put('ray', {
  type: 'person',
  title: 'Ray Wang',
  compiled_truth: 'CEO of Deepleaper. Expert in AI agents and context intelligence.',
});

// Semantic search
const results = await brain.query('who builds AI agents?');
console.log(results[0].slug); // → 'ray'

// Link
await brain.link('ray', 'deepleaper', 'founder of');

// Timeline
await brain.addTimeline('ray', {
  date: '2026-04-13',
  summary: 'Started DeepBrain project',
});

// Stats
const stats = await brain.stats();
console.log(stats);

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

## How It Works

```
Your Knowledge → Pages (Markdown) → Chunks → Embeddings → Vector DB
                    ↓                                        ↓
                 Links (Graph)                         Hybrid Search
                    ↓                                   (HNSW + tsvector + RRF)
                Timeline (append-only)                     ↓
                    ↓                                  Results
              Dream Cycle (auto-maintenance)
```

### Core Concepts

| Concept | Description |
|---------|-------------|
| **Page** | A unit of knowledge (person, company, note, anything) |
| **Compiled Truth** | Current facts — overwritable |
| **Timeline** | Historical events — append-only |
| **Chunk** | A page split into embeddable pieces |
| **Link** | Bidirectional relationship between pages |
| **Tag** | Labels for filtering |
| **Dream Cycle** | Automated maintenance (re-embed stale, clean orphans) |

### vs. GBrain

| | GBrain | DeepBrain |
|---|--------|-----------|
| Embedding | OpenAI only | 7 providers |
| Page types | 9 hardcoded | User-defined |
| Multi-user | ❌ | ✅ |
| Chinese | ❌ | ✅ Built-in |
| Local-first | ❌ (needs API key) | ✅ Ollama |
| Install | Complex | `npm i -g deepbrain` |
| Size | 14K+ files | Minimal |
| Dream Cycle | 20+ tasks | 5 focused tasks |

## Architecture

```
deepbrain
├── src/
│   ├── index.ts         # Main exports
│   ├── cli.ts           # CLI (deepbrain put/get/query/...)
│   ├── core/
│   │   ├── brain.ts     # Brain engine (CRUD + search + graph)
│   │   ├── schema.ts    # PGLite schema (pages, chunks, links, tags, timeline)
│   │   └── types.ts     # TypeScript types
│   └── dream/
│       └── index.ts     # Dream Cycle (auto-maintenance)
├── package.json
└── tsconfig.json
```

**Dependencies:** Only `@electric-sql/pglite` + `agentkits` (which wraps `openai` SDK).

## Roadmap

- [x] Core engine (CRUD, search, graph, timeline)
- [x] Hybrid search (vector + keyword + RRF)
- [x] CLI
- [x] Dream Cycle v1
- [x] Multi-provider embedding (via agentkits)
- [ ] MCP Server (for Claude/Cursor/OpenClaw integration)
- [ ] Web UI (knowledge graph visualization)
- [ ] Import from Notion / Obsidian / WeChat
- [ ] MRG layer (mission-centric knowledge graph)
- [ ] Smart chunking (semantic + LLM-assisted)
- [ ] Multi-brain sync

## License

MIT © [Magicray1217](https://github.com/Magicray1217)

---

*Inspired by [GBrain](https://github.com/garrytan/gbrain) by Garry Tan. Built with [AgentKits](https://github.com/Magicray1217/agentkits).*
