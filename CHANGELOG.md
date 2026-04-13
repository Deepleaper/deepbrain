# Changelog

All notable changes to this project will be documented in this file.

## [0.6.0] - 2026-04-13

### Added
- 🌐 **Web UI** — built-in HTTP server with pages/search/stats + JSON API
- 📤 **Export** — 5 formats: Markdown, JSON, HTML, Obsidian vault, Logseq graph
- ✂️ **Browser Clipper** — clip web pages, bookmarklet generator, selection clip
- Full Chinese docs with code examples for all modules

## [0.5.0] - 2026-04-13

### Added
- 14 new importers: Evernote, Roam Research, Logseq, Bear, Apple Notes, Google Keep, OneNote, Joplin, Readwise, Day One, Flomo, Wolai, FlowUs, SiYuan
- Unified import barrel export (`import { importNotion, importFlomo, ... } from 'deepbrain'`)
- Total: **21 importers** covering all major knowledge platforms

## [0.4.0] - 2026-04-13

### Added
- 📥 Yuque (语雀), Feishu (飞书), Shimo (石墨) importers
- EPUB & PDF importers
- Total: 7 importers

## [0.3.0] - 2026-04-12

### Added
- 🔌 **MCP Server** — 12 tools for Claude Desktop / Cursor / OpenClaw
- WeChat (微信公众号) importer

## [0.2.0] - 2026-04-12

### Added
- 📥 Notion importer (Markdown/HTML/CSV)
- 📥 Obsidian vault importer (`[[wikilinks]]`, `#tags`, YAML)

## [0.1.0] - 2026-04-12

### Added
- 🧠 **Brain engine** — PGLite + pgvector, zero external database
- 🔍 **Hybrid search** — vector (HNSW) + keyword (tsvector) + RRF fusion
- 📊 **Compiled Truth + Timeline** — dual-track knowledge storage
- 🔗 **Knowledge graph** — bidirectional page links
- 💤 **Dream Cycle** — automated maintenance
- 🖥️ **CLI** — `deepbrain init/put/get/query/search/link/list/stats/dream`
- Multi-provider embedding via [agentkits](https://github.com/Magicray1217/agentkits)
