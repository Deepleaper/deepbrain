# Changelog

## [1.7.0] - 2026-04-17

### Enhanced Init UX
- Interactive provider selection with numbered menu when no provider argument given
- Auto-detect API keys from environment variables with visual indicators
- `deepbrain init --check` to validate current config (test DB connection, check env keys)
- Welcome message with comprehensive quick-start tips after successful init
- Better error messages when directory creation or config write fails

### Smarter Chat Memory
- Conversation memory summary: auto-summarizes every 10 messages and injects as system context
- `/topics` command to extract and show topics discussed in current session
- `/export` command to export chat session as markdown file
- `/related` command to find related pages in the brain beyond current context
- Improved citation format: `[Source: page-title]` inline in answers

### Other
- Added `awesome-list-pr.md` with formatted entries for awesome-selfhosted, awesome-knowledge-management, and awesome-ai-tools
- Hybrid provider support: separate embedding and LLM providers with `--llm-provider`

## [1.6.1] - Previous Release

- Bug fixes and stability improvements

## [1.6.0] - Previous Release

- Interactive multi-turn chat with session persistence
- Session bookmarks and `/save`, `/context`, `/sessions` commands
- Re-ranking for better RAG results
