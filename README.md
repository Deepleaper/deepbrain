<div align="center">

# 🧠 DeepBrain

**Your Personal AI Knowledge Brain**

Store, search, connect, and grow your knowledge — powered by embeddings, local-first.

[![npm version](https://img.shields.io/npm/v/deepbrain?color=blue)](https://www.npmjs.com/package/deepbrain)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://typescriptlang.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Quick Start](#-quick-start) · [Features](#-features) · [Import](#-import-everything) · [CLI Reference](#-cli-reference) · [MCP](#-mcp-server) · [Architecture](#-architecture)

</div>

---

## ⚡ Quick Start (30 seconds)

```bash
# Install
npm install -g deepbrain

# Initialize with your preferred AI provider
deepbrain init gemini          # or: openai, deepseek, ollama, dashscope, zhipu, moonshot

# Add your first knowledge
deepbrain put meeting-notes notes.md      # Auto-summarizes & auto-tags!
echo "React 19 uses a compiler" | deepbrain put react-19

# Search semantically
deepbrain query "what did we discuss about the product roadmap?"

# Chat with your brain (RAG)
deepbrain chat "summarize our key decisions this week"
```

That's it. Your brain is running locally with PGLite + pgvector. No external database needed.

---

## 🚀 Features

### Core Brain
| Feature | Description |
|---------|-------------|
| **Hybrid Search** | Semantic (vector) + keyword search with automatic ranking |
| **Auto-Summary** | Every page auto-summarized and auto-tagged by LLM |
| **Dream Cycle** | Background maintenance: refresh stale content, fix broken links |
| **Knowledge Graph** | Auto-extract entities and relationships, query connections |
| **Memory Tiers** | Core → Working → Archival, automatic promotion/demotion |
| **Flashcards** | SM-2 spaced repetition generated from your knowledge |
| **Multi-Brain** | Separate brains for work, personal, research — or merge them |
| **Templates** | Pre-built brain structures: research, CRM, journal, PKM |

### 🆕 v1.5.0 — Import Everything

| Source | Command |
|--------|---------|
| **GitHub Repos** | `deepbrain import github --repo owner/repo` |
| **GitHub Stars** | `deepbrain import github-stars --user username` |
| **YouTube** | `deepbrain import youtube <url>` (transcript + LLM summary) |
| **RSS Feeds** | `deepbrain sync rss --add <url>` then `--run` |
| **Notion** | `deepbrain sync notion --token T --database D` |
| **Obsidian** | `deepbrain watch <vault-path>` (live sync) |
| Evernote | `deepbrain batch-import <export-dir>` |
| Roam, Logseq, Bear | Via import module |
| 语雀, 飞书, 石墨 | 中文平台全支持 |
| Flomo, FlowUs, 思源 | Via import module |
| Apple Notes, Google Keep, OneNote | Via import module |
| EPUB / PDF | `deepbrain import ebook <file>` |
| **20+ platforms total** | See [full list](#-import-sources) |

### 🆕 v1.5.0 — Share & Collaborate

```bash
# Serve your brain as a read-only website
deepbrain share --port 8080

# Export as static HTML site (deploy anywhere)
deepbrain share --export ./public

# Subscribe to RSS feeds for auto-import
deepbrain sync rss --add https://blog.example.com/feed.xml
deepbrain sync rss --run
```

---

## 📥 Import Sources

DeepBrain imports from **20+ platforms** — the most comprehensive knowledge importer available:

<details>
<summary><b>International Platforms</b></summary>

- **Notion** — Live sync via API
- **Obsidian** — Live file watcher
- **Evernote** — ENEX export
- **Roam Research** — JSON export
- **Logseq** — Markdown directory
- **Bear** — SQLite database
- **Apple Notes** — macOS database
- **Google Keep** — Takeout export
- **OneNote** — HTML export
- **Joplin** — Raw data
- **Readwise** — CSV/JSON export
- **Day One** — JSON export
- **GitHub** — Repos, docs, wikis, starred repos
- **YouTube** — Video transcripts with LLM summary
- **RSS** — Any RSS/Atom feed

</details>

<details>
<summary><b>中文平台</b></summary>

- **语雀 (Yuque)** — API 导入
- **飞书 (Feishu)** — 文档导入
- **石墨 (Shimo)** — 导出文件
- **微信 (WeChat)** — 聊天记录
- **Flomo** — 导出数据
- **FlowUs (息流)** — 导出数据
- **思源笔记 (SiYuan)** — 数据目录
- **Wolai (我来)** — 导出数据

</details>

---

## 📖 CLI Reference

### Basic Operations

```bash
deepbrain put <slug> [file]          # Add/update page (auto-summarizes)
deepbrain get <slug>                 # Read a page
deepbrain query "text"               # Semantic search
deepbrain search "keyword"           # Keyword search (supports --tag, --after, --fuzzy)
deepbrain chat "question"            # RAG chat with your brain
deepbrain list [--type X]            # List pages
deepbrain stats                      # Brain statistics
```

### Import & Sync

```bash
deepbrain import github --repo owner/repo    # Import repo README, docs/, wiki
deepbrain import github-stars --user name     # Import starred repos
deepbrain import youtube <url>               # Import video transcript + summary
deepbrain sync rss --add <feed-url>          # Subscribe to RSS
deepbrain sync rss --run                     # Fetch all feeds
deepbrain sync notion --token T --database D # Sync Notion database
deepbrain watch <vault-path>                 # Watch Obsidian vault
deepbrain batch-import <directory>           # Bulk import .md/.txt files
```

### Knowledge Management

```bash
deepbrain dream                      # Run maintenance cycle
deepbrain graph                      # Build knowledge graph
deepbrain graph query "entity"       # Query entity relationships
deepbrain related <slug>             # Find related pages
deepbrain link <from> <to>           # Manual link
deepbrain timeline <slug> "text"     # Add timeline entry
deepbrain tiers stats                # Memory tier breakdown
deepbrain compress [slug]            # Compress old memories
deepbrain retag                      # Re-tag all pages with LLM
```

### Learning & Sharing

```bash
deepbrain flashcards generate        # Generate flashcards from knowledge
deepbrain flashcards review          # SM-2 spaced repetition review
deepbrain digest --period weekly     # Knowledge digest
deepbrain share --port 8080          # Serve read-only web UI
deepbrain share --export ./site      # Export as static site
```

### Multi-Brain

```bash
deepbrain init --brain work openai   # Create named brain
deepbrain --brain work put ...       # Use specific brain
deepbrain chat "q" --brains a,b,c   # Cross-brain chat
deepbrain merge source target        # Merge brains
deepbrain list-brains                # Show all brains
```

### Backup & Restore

```bash
deepbrain backup --output brain.zip  # Full backup
deepbrain restore brain.zip          # Restore from backup
```

---

## 🔌 MCP Server

DeepBrain works as an MCP (Model Context Protocol) tool server for Claude Desktop, Cursor, and other MCP clients:

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

This gives AI assistants direct access to your knowledge brain.

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    DeepBrain CLI / SDK                     │
├──────────┬───────────┬──────────┬─────────┬──────────────┤
│  Import  │  Search   │  Dream   │  Graph  │   Collab     │
│ 20+ src  │ Hybrid    │  Cycle   │  Auto   │  Share/RSS   │
├──────────┴───────────┴──────────┴─────────┴──────────────┤
│                    Core Brain Engine                       │
│          Pages · Chunks · Links · Timeline · Tags          │
├──────────────────────────────────────────────────────────┤
│  PGLite + pgvector (embedded)  │  agentkits (embeddings)  │
│  Zero-config local database    │  7 AI providers supported │
└──────────────────────────────────────────────────────────┘

Supported Providers:
  ollama · openai · gemini · deepseek · dashscope · zhipu · moonshot
```

---

## 🥊 Comparison

| Feature | DeepBrain | Obsidian | Notion | Mem.ai |
|---------|-----------|----------|--------|--------|
| **Local-first** | ✅ PGLite | ✅ Files | ❌ Cloud | ❌ Cloud |
| **Semantic search** | ✅ Hybrid | ❌ Keyword | ❌ Keyword | ✅ |
| **Auto-summary** | ✅ LLM | ❌ | ❌ AI add-on | ✅ |
| **Knowledge graph** | ✅ Auto | 🟡 Manual | ❌ | ❌ |
| **20+ importers** | ✅ | 🟡 Plugins | 🟡 Limited | ❌ |
| **MCP server** | ✅ | ❌ | ❌ | ❌ |
| **Flashcards (SM-2)** | ✅ Built-in | 🟡 Plugin | ❌ | ❌ |
| **RSS sync** | ✅ | 🟡 Plugin | ❌ | ❌ |
| **GitHub import** | ✅ | ❌ | ❌ | ❌ |
| **YouTube import** | ✅ | ❌ | ❌ | ❌ |
| **Multi-brain** | ✅ | 🟡 Vaults | ❌ | ❌ |
| **Share as website** | ✅ | 🟡 Publish | ✅ | ❌ |
| **CLI-first** | ✅ | ❌ | ❌ | ❌ |
| **Free & open** | ✅ Apache-2.0 | 🟡 Freemium | 🟡 Freemium | ❌ Paid |
| **中文支持** | ✅ Native | 🟡 | 🟡 | ❌ |

**DeepBrain is for developers and power users who want full control over their knowledge.**

---

## 🌐 Web UI

```bash
deepbrain web --port 3000
```

Interactive web interface with search, page editing, knowledge graph visualization, and flashcard review.

---

## 📦 SDK

```typescript
import { Brain } from 'deepbrain';

const brain = new Brain({ embedding_provider: 'gemini', api_key: '...' });
await brain.connect();

// Store knowledge
await brain.put('meeting-q1', {
  type: 'note',
  title: 'Q1 Planning Meeting',
  compiled_truth: 'We decided to focus on...',
});

// Semantic search
const results = await brain.query('product roadmap decisions');

// Knowledge graph
import { buildKnowledgeGraph } from 'deepbrain/tag-graph';
```

---

## 🤝 Contributing

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
git clone https://github.com/Magicray1217/deepbrain
cd deepbrain
npm install
npm run build
npm test
```

---

## 📄 License

Apache-2.0 © [Magicray1217](https://github.com/Magicray1217)

---

<div align="center">

**🧠 Your knowledge deserves a brain, not just a folder.**

[Get Started →](https://www.npmjs.com/package/deepbrain)

</div>
