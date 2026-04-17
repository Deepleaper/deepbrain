# DeepBrain Examples

## Prerequisites

```bash
# Install Ollama (default, no API key needed)
# https://ollama.com
ollama pull nomic-embed-text
```

Or use a cloud provider:
```bash
export OPENAI_API_KEY=sk-xxx
# or: export GEMINI_API_KEY=xxx
# or: export DEEPSEEK_API_KEY=xxx
```

## Run Examples

```bash
# Basic learn & recall
npx tsx examples/basic-learn-recall.ts

# Memory evolution (20 experiences → consolidate → knowledge)
npx tsx examples/evolve-demo.ts
```

## What Each Example Shows

| Example | Concepts |
|---------|----------|
| `basic-learn-recall.ts` | `Brain`, `AgentBrain`, `learn()`, `recall()` |
| `evolve-demo.ts` | `evolve()`, memory consolidation, knowledge promotion |
