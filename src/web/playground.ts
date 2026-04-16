/**
 * DeepBrain — Interactive Playground (v1.6.0)
 * 
 * Self-contained demo that works WITHOUT any API keys.
 * Pre-loaded sample knowledge base with mock semantic search and chat.
 */

// ── Sample Knowledge Base ────────────────────────────────────────

export interface SamplePage {
  slug: string;
  title: string;
  type: string;
  tags: string[];
  content: string;
  chunks: string[];
}

export const SAMPLE_PAGES: SamplePage[] = [
  {
    slug: 'transformer-architecture',
    title: 'Transformer Architecture: Attention Is All You Need',
    type: 'note',
    tags: ['AI', 'deep-learning', 'NLP', 'architecture'],
    content: `The Transformer architecture, introduced in the 2017 paper "Attention Is All You Need" by Vaswani et al., revolutionized natural language processing by replacing recurrent layers with self-attention mechanisms.\n\nKey innovations:\n- Multi-head self-attention allows the model to attend to different positions simultaneously\n- Positional encoding injects sequence order information without recurrence\n- Layer normalization and residual connections enable training very deep networks\n- The encoder-decoder structure enables sequence-to-sequence tasks\n\nTransformers became the foundation for GPT, BERT, T5, and virtually all modern LLMs. The architecture scales remarkably well with data and compute, following scaling laws discovered by Kaplan et al.`,
    chunks: [
      'The Transformer architecture, introduced in the 2017 paper "Attention Is All You Need" by Vaswani et al., revolutionized natural language processing by replacing recurrent layers with self-attention mechanisms.',
      'Multi-head self-attention allows the model to attend to different positions simultaneously. Positional encoding injects sequence order information without recurrence.',
      'Transformers became the foundation for GPT, BERT, T5, and virtually all modern LLMs. The architecture scales remarkably well with data and compute.',
    ],
  },
  {
    slug: 'rag-retrieval-augmented-generation',
    title: 'RAG: Retrieval-Augmented Generation',
    type: 'note',
    tags: ['AI', 'RAG', 'LLM', 'search'],
    content: `Retrieval-Augmented Generation (RAG) combines the power of large language models with external knowledge retrieval. Instead of relying solely on parametric knowledge baked into model weights, RAG retrieves relevant documents at inference time.\n\nThe RAG pipeline:\n1. User asks a question\n2. The question is embedded into a vector\n3. Similar documents are retrieved from a vector database\n4. Retrieved context is prepended to the LLM prompt\n5. The LLM generates an answer grounded in the retrieved context\n\nAdvantages over fine-tuning:\n- No retraining needed when knowledge updates\n- Transparent sources (citations)\n- Reduced hallucination\n- Works with any LLM provider\n\nDeepBrain uses hybrid search (vector + keyword via RRF fusion) for its RAG pipeline.`,
    chunks: [
      'Retrieval-Augmented Generation (RAG) combines the power of large language models with external knowledge retrieval. Instead of relying solely on parametric knowledge, RAG retrieves relevant documents at inference time.',
      'The RAG pipeline: User asks a question, the question is embedded into a vector, similar documents are retrieved from a vector database, retrieved context is prepended to the LLM prompt, the LLM generates an answer grounded in the retrieved context.',
      'Advantages of RAG over fine-tuning: No retraining needed when knowledge updates, transparent sources with citations, reduced hallucination, works with any LLM provider.',
      'DeepBrain uses hybrid search (vector + keyword via RRF fusion) for its RAG pipeline.',
    ],
  },
  {
    slug: 'second-brain-methodology',
    title: 'Building a Second Brain (BASB)',
    type: 'note',
    tags: ['productivity', 'PKM', 'note-taking', 'methodology'],
    content: `"Building a Second Brain" (BASB) by Tiago Forte is a methodology for personal knowledge management. The core idea: offload your memory to a trusted external system so your biological brain can focus on creative thinking.\n\nThe PARA framework organizes information into:\n- Projects: short-term efforts with deadlines\n- Areas: long-term responsibilities\n- Resources: topics of interest\n- Archives: inactive items\n\nThe CODE workflow:\n- Capture: save interesting ideas\n- Organize: sort into PARA categories\n- Distill: highlight key insights (progressive summarization)\n- Express: turn knowledge into output\n\nKey principle: "Intermediate Packets" — break work into reusable building blocks that compound over time.`,
    chunks: [
      '"Building a Second Brain" by Tiago Forte is a methodology for personal knowledge management. Offload your memory to a trusted external system so your biological brain can focus on creative thinking.',
      'The PARA framework organizes information into: Projects (short-term with deadlines), Areas (long-term responsibilities), Resources (topics of interest), Archives (inactive items).',
      'The CODE workflow: Capture interesting ideas, Organize into PARA categories, Distill key insights via progressive summarization, Express by turning knowledge into output.',
      'Key principle: "Intermediate Packets" — break work into reusable building blocks that compound over time.',
    ],
  },
  {
    slug: 'vector-databases-explained',
    title: 'Vector Databases: How Semantic Search Works',
    type: 'note',
    tags: ['AI', 'database', 'embeddings', 'search'],
    content: `Vector databases store data as high-dimensional vectors (embeddings) and enable similarity search using distance metrics like cosine similarity or L2 distance.\n\nHow embeddings work:\n- Text is passed through an embedding model (e.g., OpenAI text-embedding-3-small, Gemini embedding)\n- The model outputs a dense vector (e.g., 768 or 1536 dimensions)\n- Semantically similar texts produce vectors that are close in the embedding space\n\nPopular vector databases:\n- pgvector: PostgreSQL extension (what DeepBrain uses via PGlite)\n- Pinecone: managed cloud vector DB\n- Weaviate: open-source, GraphQL API\n- Qdrant: Rust-based, high performance\n- ChromaDB: Python-native, simple API\n\nHybrid search combines vector similarity with traditional keyword search (BM25/TF-IDF) for best results. DeepBrain uses Reciprocal Rank Fusion (RRF) to merge both ranking lists.`,
    chunks: [
      'Vector databases store data as high-dimensional vectors (embeddings) and enable similarity search using distance metrics like cosine similarity or L2 distance.',
      'Text is passed through an embedding model which outputs a dense vector. Semantically similar texts produce vectors that are close in the embedding space.',
      'Popular vector databases: pgvector (PostgreSQL extension, used by DeepBrain via PGlite), Pinecone, Weaviate, Qdrant, ChromaDB.',
      'Hybrid search combines vector similarity with traditional keyword search for best results. DeepBrain uses Reciprocal Rank Fusion (RRF) to merge both ranking lists.',
    ],
  },
  {
    slug: 'prompt-engineering-guide',
    title: 'Prompt Engineering: Best Practices',
    type: 'note',
    tags: ['AI', 'LLM', 'prompt-engineering', 'productivity'],
    content: `Prompt engineering is the art of crafting inputs to get the best outputs from LLMs. Key techniques:\n\n1. System prompts: Set the role, tone, and constraints\n2. Few-shot examples: Show the model what you want\n3. Chain-of-thought (CoT): Ask the model to "think step by step"\n4. Structured output: Request JSON, YAML, or specific formats\n5. Temperature control: Lower for factual, higher for creative\n\nAdvanced techniques:\n- ReAct: Reasoning + Acting in interleaved steps\n- Tree of Thoughts: Explore multiple reasoning paths\n- Self-consistency: Generate multiple answers, take the majority\n- RAG prompting: Include retrieved context with source attribution\n\nCommon pitfalls:\n- Overly long prompts that dilute the signal\n- Ambiguous instructions\n- Not specifying output format\n- Ignoring the model's context window limits`,
    chunks: [
      'Prompt engineering is the art of crafting inputs to get the best outputs from LLMs. Key techniques include system prompts, few-shot examples, chain-of-thought, structured output, and temperature control.',
      'Advanced techniques: ReAct (Reasoning + Acting), Tree of Thoughts (explore multiple paths), Self-consistency (majority voting), RAG prompting (context with source attribution).',
      'Common pitfalls: Overly long prompts that dilute signal, ambiguous instructions, not specifying output format, ignoring context window limits.',
    ],
  },
  {
    slug: 'local-first-software',
    title: 'Local-First Software: Ownership and Privacy',
    type: 'note',
    tags: ['architecture', 'privacy', 'local-first', 'CRDTs'],
    content: `Local-first software keeps data on the user's device as the primary copy. Cloud sync is optional, not required. This approach prioritizes:\n\n- Data ownership: Your data lives on your device\n- Privacy: No cloud service can access your data\n- Offline capability: Works without internet\n- Speed: No network latency for reads/writes\n- Longevity: Data survives service shutdowns\n\nKey technologies:\n- CRDTs (Conflict-free Replicated Data Types) for conflict resolution\n- SQLite / PGlite for embedded databases\n- WebRTC for peer-to-peer sync\n- Automerge, Yjs for collaborative editing\n\nDeepBrain follows the local-first philosophy by using PGlite (embedded PostgreSQL) — your entire knowledge base runs locally with zero cloud dependency.`,
    chunks: [
      'Local-first software keeps data on the user\'s device as the primary copy. Cloud sync is optional. Priorities: data ownership, privacy, offline capability, speed, longevity.',
      'Key technologies for local-first: CRDTs for conflict resolution, SQLite/PGlite for embedded databases, WebRTC for peer-to-peer sync, Automerge/Yjs for collaborative editing.',
      'DeepBrain follows the local-first philosophy by using PGlite (embedded PostgreSQL) — your entire knowledge base runs locally with zero cloud dependency.',
    ],
  },
  {
    slug: 'zettelkasten-method',
    title: 'Zettelkasten: The Slip-Box Method',
    type: 'note',
    tags: ['productivity', 'PKM', 'note-taking', 'methodology'],
    content: `The Zettelkasten (German for "slip box") method was popularized by sociologist Niklas Luhmann, who used it to write 70+ books and 400+ papers.\n\nCore principles:\n- Atomic notes: Each note captures one idea\n- Unique identifiers: Every note has a permanent address\n- Links between notes: Ideas connect to form a knowledge network\n- Write in your own words: Forces understanding\n- Bottom-up organization: Structure emerges from connections, not folders\n\nDigital Zettelkasten tools:\n- Obsidian: Local markdown + graph view\n- Logseq: Outliner + bidirectional links\n- Roam Research: Block-level references\n- DeepBrain: AI-powered with semantic search and auto-linking\n\nThe key insight: Knowledge compounds when ideas are connected. A Zettelkasten becomes more valuable as it grows because new notes create new connections with existing ones.`,
    chunks: [
      'The Zettelkasten method was popularized by sociologist Niklas Luhmann, who used it to write 70+ books and 400+ papers.',
      'Core principles: Atomic notes (one idea each), unique identifiers, links between notes, write in your own words, bottom-up organization where structure emerges from connections.',
      'Digital Zettelkasten tools: Obsidian, Logseq, Roam Research, DeepBrain (AI-powered with semantic search and auto-linking).',
      'Knowledge compounds when ideas are connected. A Zettelkasten becomes more valuable as it grows because new notes create new connections.',
    ],
  },
  {
    slug: 'ai-agents-2025',
    title: 'AI Agents: The Next Frontier (2025)',
    type: 'note',
    tags: ['AI', 'agents', 'automation', 'trends'],
    content: `AI agents represent the evolution from chatbots to autonomous systems that can plan, reason, and take actions. In 2025, we're seeing rapid progress:\n\nAgent architectures:\n- ReAct: Interleave reasoning and action\n- Plan-and-Execute: Create a plan, then execute steps\n- Reflection: Self-critique and improve\n- Multi-agent: Specialized agents collaborate\n\nKey capabilities:\n- Tool use: Browse web, execute code, call APIs\n- Memory: Short-term (context window) and long-term (vector DB)\n- Planning: Break complex tasks into subtasks\n- Self-correction: Detect and fix errors\n\nChallenges:\n- Reliability: Agents sometimes go off-track\n- Safety: Autonomous actions need guardrails\n- Cost: Long agent runs consume many tokens\n- Evaluation: Hard to benchmark open-ended tasks\n\nNotable frameworks: LangChain, CrewAI, AutoGen, OpenClaw.`,
    chunks: [
      'AI agents represent the evolution from chatbots to autonomous systems that can plan, reason, and take actions. In 2025, rapid progress in agent architectures.',
      'Agent architectures: ReAct, Plan-and-Execute, Reflection, Multi-agent collaboration. Key capabilities: tool use, memory, planning, self-correction.',
      'Challenges: Reliability (agents go off-track), safety (need guardrails), cost (many tokens), evaluation (hard to benchmark). Notable frameworks: LangChain, CrewAI, AutoGen, OpenClaw.',
    ],
  },
];

// ── Mock Search Engine ───────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);
}

function cosineSim(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  if (setA.size === 0 || setB.size === 0) return 0;
  return intersection / Math.sqrt(setA.size * setB.size);
}

export interface PlaygroundSearchResult {
  slug: string;
  title: string;
  type: string;
  chunk: string;
  score: number;
  tags: string[];
}

export function playgroundSearch(query: string, limit = 5): PlaygroundSearchResult[] {
  const queryTokens = tokenize(query);
  const results: PlaygroundSearchResult[] = [];

  for (const page of SAMPLE_PAGES) {
    for (const chunk of page.chunks) {
      const chunkTokens = tokenize(chunk);
      const score = cosineSim(queryTokens, chunkTokens);
      if (score > 0.05) {
        results.push({
          slug: page.slug,
          title: page.title,
          type: page.type,
          chunk,
          score,
          tags: page.tags,
        });
      }
    }
  }

  // Deduplicate by slug (keep highest score)
  const bySlug = new Map<string, PlaygroundSearchResult>();
  for (const r of results.sort((a, b) => b.score - a.score)) {
    if (!bySlug.has(r.slug)) bySlug.set(r.slug, r);
  }

  return Array.from(bySlug.values()).slice(0, limit);
}

// ── Mock Chat ────────────────────────────────────────────────────

export function playgroundChat(question: string): { answer: string; sources: PlaygroundSearchResult[] } {
  const sources = playgroundSearch(question, 3);

  if (sources.length === 0) {
    return {
      answer: "I couldn't find relevant information in the sample knowledge base. In a real DeepBrain setup, I'd search your personal knowledge base using hybrid semantic + keyword search.\n\nTry asking about: Transformers, RAG, vector databases, prompt engineering, Zettelkasten, AI agents, local-first software, or Building a Second Brain.",
      sources: [],
    };
  }

  // Build a context-aware response from the top sources
  const contextParts = sources.map((s, i) => `[${i + 1}] ${s.chunk}`);
  const sourceList = sources.map((s, i) => `[${i + 1}] ${s.title}`).join('\n');

  const answer = `Based on your knowledge base:\n\n${contextParts.join('\n\n')}\n\n---\n📚 Sources:\n${sourceList}`;

  return { answer, sources };
}

// ── Playground HTML Page ─────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function getPlaygroundHTML(): string {
  const sampleDataJSON = JSON.stringify(SAMPLE_PAGES);

  return `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DeepBrain 知识大脑 · 互动体验</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0f0f23;--bg2:rgba(20,20,40,0.85);--bg3:rgba(30,30,50,0.6);
  --border:rgba(124,58,237,0.2);--border2:rgba(124,58,237,0.4);
  --text:#e6edf3;--text2:#8b949e;--accent:#7c3aed;--accent2:#a78bfa;--accent3:#c4b5fd;
  --success:#3fb950;--glass:rgba(124,58,237,0.08);
}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden}
body::before{content:'';position:fixed;top:0;left:0;right:0;bottom:0;background:radial-gradient(ellipse at 20% 50%,rgba(124,58,237,0.08) 0%,transparent 50%),radial-gradient(ellipse at 80% 20%,rgba(59,130,246,0.06) 0%,transparent 50%);pointer-events:none;z-index:0}

/* Header */
.pg-header{position:relative;z-index:1;text-align:center;padding:48px 20px 32px}
.pg-header h1{font-size:2.5em;font-weight:700;background:linear-gradient(135deg,var(--accent2),var(--accent3),#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px}
.pg-header p{color:var(--text2);font-size:1.1em;max-width:600px;margin:0 auto}
.pg-back{position:absolute;top:20px;left:20px;color:var(--text2);text-decoration:none;font-size:.9em;padding:8px 16px;border:1px solid var(--border);border-radius:8px;backdrop-filter:blur(10px);background:var(--glass)}
.pg-back:hover{border-color:var(--accent);color:var(--text)}
.pg-badge{display:inline-block;background:linear-gradient(135deg,var(--accent),#3b82f6);color:#fff;padding:4px 12px;border-radius:20px;font-size:.75em;font-weight:600;margin-bottom:16px;letter-spacing:.05em}

/* Tabs */
.pg-tabs{position:relative;z-index:1;display:flex;justify-content:center;gap:8px;margin:0 20px 32px;flex-wrap:wrap}
.pg-tab{padding:10px 24px;border:1px solid var(--border);border-radius:12px;background:var(--glass);backdrop-filter:blur(10px);color:var(--text2);cursor:pointer;font-size:.9em;transition:all .2s}
.pg-tab:hover{border-color:var(--accent);color:var(--text)}
.pg-tab.active{background:linear-gradient(135deg,rgba(124,58,237,0.2),rgba(59,130,246,0.15));border-color:var(--accent);color:var(--accent2);font-weight:600}

/* Panels */
.pg-panel{display:none;position:relative;z-index:1;max-width:900px;margin:0 auto;padding:0 20px 60px}
.pg-panel.active{display:block}

/* Glass card */
.glass{background:var(--bg2);backdrop-filter:blur(20px);border:1px solid var(--border);border-radius:16px;padding:24px;margin-bottom:16px;transition:border-color .2s}
.glass:hover{border-color:var(--border2)}

/* Search */
.search-input{width:100%;padding:16px 20px;background:var(--bg3);backdrop-filter:blur(10px);border:1px solid var(--border);border-radius:14px;color:var(--text);font-size:1.05em;outline:none;transition:all .2s}
.search-input:focus{border-color:var(--accent);box-shadow:0 0 0 4px rgba(124,58,237,0.15)}
.search-input::placeholder{color:var(--text2)}

/* Results */
.result-card{cursor:pointer}
.result-card h3{font-size:1em;margin-bottom:4px;color:var(--accent2)}
.result-card .score{float:right;background:rgba(124,58,237,0.2);color:var(--accent3);padding:2px 8px;border-radius:8px;font-size:.75em;font-weight:600}
.result-card .chunk{color:var(--text2);font-size:.88em;margin-top:8px;line-height:1.6}
.result-card .tags{margin-top:8px}
.tag{display:inline-block;background:rgba(124,58,237,0.12);color:var(--accent2);padding:2px 10px;border-radius:10px;font-size:.75em;margin:2px}

/* Chat */
.chat-container{display:flex;flex-direction:column;height:500px}
.chat-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px}
.chat-msg{max-width:85%;padding:12px 16px;border-radius:14px;font-size:.92em;line-height:1.6}
.chat-msg.user{align-self:flex-end;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border-bottom-right-radius:4px}
.chat-msg.assistant{align-self:flex-start;background:rgba(50,50,62,0.92);border:1px solid rgba(100,100,115,0.35);border-bottom-left-radius:4px}
.chat-msg.assistant pre{background:rgba(0,0,0,0.3);padding:8px;border-radius:6px;margin:8px 0;overflow-x:auto;font-size:.85em}
.chat-input-row{display:flex;gap:8px;padding:16px;border-top:1px solid var(--border)}
.chat-input{flex:1;padding:12px 16px;background:var(--bg3);border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:.92em;outline:none;resize:none}
.chat-input:focus{border-color:var(--accent)}
.chat-send{padding:12px 24px;background:linear-gradient(135deg,var(--accent),#4f46e5);color:#fff;border:none;border-radius:12px;cursor:pointer;font-weight:600;font-size:.9em;transition:opacity .2s}
.chat-send:hover{opacity:.9}

/* Browse */
.page-card h3{font-size:1.05em;color:var(--accent2);margin-bottom:8px}
.page-card .content{color:var(--text2);font-size:.88em;line-height:1.7;white-space:pre-wrap}

/* Suggest chips */
.suggest-chips{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
.chip{padding:8px 16px;border:1px solid var(--border);border-radius:20px;background:var(--glass);color:var(--text2);cursor:pointer;font-size:.82em;transition:all .2s}
.chip:hover{border-color:var(--accent);color:var(--accent2);background:rgba(124,58,237,0.12)}

/* Typing animation */
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
.typing{display:inline-block}.typing::after{content:'▋';animation:blink 1s infinite;color:var(--accent2)}

/* Stats bar */
.stats-bar{display:flex;gap:24px;justify-content:center;margin:16px 0;flex-wrap:wrap}
.stats-bar .stat{text-align:center}
.stats-bar .stat .num{font-size:1.8em;font-weight:700;background:linear-gradient(135deg,var(--accent2),#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.stats-bar .stat .label{color:var(--text2);font-size:.78em;margin-top:2px}

/* Footer */
.pg-footer{text-align:center;padding:32px 20px;color:var(--text2);font-size:.82em;position:relative;z-index:1}
.pg-footer a{color:var(--accent2)}

@media(max-width:640px){
  .pg-header h1{font-size:1.8em}
  .pg-panel{padding:0 12px 40px}
  .chat-container{height:400px}
}
</style>
</head>
<body>
<div class="pg-header">
  <a class="pg-back" href="/">← 返回大脑</a>
  <div class="pg-badge">🧪 互动演示</div>
  <h1>🧠 DeepBrain 知识大脑</h1>
  <p>AI 驱动的个人知识管理 · 无需配置，即刻体验</p>
  <div class="stats-bar">
    <div class="stat"><div class="num">8</div><div class="label">示例笔记</div></div>
    <div class="stat"><div class="num">26</div><div class="label">知识片段</div></div>
    <div class="stat"><div class="num">∞</div><div class="label">关联</div></div>
  </div>
</div>

<div class="pg-tabs">
  <div class="pg-tab active" data-tab="search">🔍 语义搜索</div>
  <div class="pg-tab" data-tab="chat">💬 与大脑对话</div>
  <div class="pg-tab" data-tab="browse">📚 浏览知识库</div>
</div>

<!-- Search Panel -->
<div class="pg-panel active" id="panel-search">
  <div class="glass">
    <input class="search-input" id="search-input" placeholder="搜索知识... 试试「RAG 如何工作？」或「笔记管理方法」" autofocus>
    <div class="suggest-chips">
      <div class="chip" data-q="how does RAG work">RAG 如何工作？</div>
      <div class="chip" data-q="vector database similarity search">向量语义搜索</div>
      <div class="chip" data-q="productivity note taking system">笔记管理系统</div>
      <div class="chip" data-q="AI agents autonomous">AI 智能体</div>
      <div class="chip" data-q="local first data privacy">本地优先与隐私</div>
    </div>
  </div>
  <div id="search-results"></div>
</div>

<!-- Chat Panel -->
<div class="pg-panel" id="panel-chat">
  <div class="glass chat-container">
    <div class="chat-messages" id="chat-messages">
      <div class="chat-msg assistant">👋 你好！我是你的 DeepBrain AI 助手。可以问我任何关于示例知识库的问题 —— 我会搜索相关内容并作答。<br><br>试试：「什么是 Zettelkasten 方法？」或「RAG 与微调有何区别？」</div>
    </div>
    <div class="chat-input-row">
      <textarea class="chat-input" id="chat-input" rows="1" placeholder="向大脑提问..."></textarea>
      <button class="chat-send" id="chat-send">发送 →</button>
    </div>
  </div>
  <div class="suggest-chips" style="margin-top:12px">
    <div class="chip chat-chip" data-q="What is the Zettelkasten method and how does it help?">卡片盒笔记法是什么？</div>
    <div class="chip chat-chip" data-q="How does DeepBrain search work? What makes it different?">DeepBrain 搜索原理</div>
    <div class="chip chat-chip" data-q="What are the key prompt engineering techniques?">提示词工程技巧</div>
    <div class="chip chat-chip" data-q="Compare Building a Second Brain with Zettelkasten">第二大脑 vs 卡片盒</div>
  </div>
</div>

<!-- Browse Panel -->
<div class="pg-panel" id="panel-browse">
  <div id="browse-list"></div>
</div>

<div class="pg-footer">
  <p>🧠 DeepBrain — AI 个人知识大脑 · <a href="https://github.com/Deepleaper/deepbrain">GitHub</a> · <a href="https://www.npmjs.com/package/deepbrain">npm</a></p>
  <p style="margin-top:8px">演示完全在浏览器本地运行，不向任何服务器发送数据。</p>
</div>

<script>
const PAGES = ${sampleDataJSON};

// Tokenizer
function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\\s]/g, ' ').split(/\\s+/).filter(t => t.length > 2);
}

function cosineSim(a, b) {
  const setA = new Set(a), setB = new Set(b);
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  if (!setA.size || !setB.size) return 0;
  return inter / Math.sqrt(setA.size * setB.size);
}

function search(query, limit=5) {
  const qt = tokenize(query);
  const results = [];
  for (const page of PAGES) {
    for (const chunk of page.chunks) {
      const score = cosineSim(qt, tokenize(chunk));
      if (score > 0.05) results.push({ slug: page.slug, title: page.title, type: page.type, chunk, score, tags: page.tags });
    }
  }
  const bySlug = new Map();
  for (const r of results.sort((a,b) => b.score - a.score)) {
    if (!bySlug.has(r.slug)) bySlug.set(r.slug, r);
  }
  return Array.from(bySlug.values()).slice(0, limit);
}

function escH(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Search
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
let searchTimeout;

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const q = searchInput.value.trim();
    if (!q) { searchResults.innerHTML = ''; return; }
    const hits = search(q);
    if (hits.length === 0) {
      searchResults.innerHTML = '<div class="glass" style="text-align:center;color:var(--text2)">未找到相关结果，请换个关键词试试。</div>';
      return;
    }
    searchResults.innerHTML = hits.map(h =>
      '<div class="glass result-card">' +
      '<span class="score">' + (h.score * 100).toFixed(0) + '% match</span>' +
      '<h3>' + escH(h.title) + '</h3>' +
      '<div class="chunk">' + escH(h.chunk) + '</div>' +
      '<div class="tags">' + h.tags.map(t => '<span class="tag">' + escH(t) + '</span>').join('') + '</div>' +
      '</div>'
    ).join('');
  }, 200);
});

document.querySelectorAll('#panel-search .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    searchInput.value = chip.dataset.q;
    searchInput.dispatchEvent(new Event('input'));
  });
});

// Chat
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');

function addMessage(role, text) {
  const div = document.createElement('div');
  div.className = 'chat-msg ' + role;
  div.innerHTML = text.replace(/\\n/g, '<br>');
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

async function sendChat() {
  const q = chatInput.value.trim();
  if (!q) return;
  chatInput.value = '';
  addMessage('user', escH(q));

  const sources = search(q, 3);
  
  // Simulate typing delay
  const typing = addMessage('assistant', '<span class="typing">正在搜索知识库</span>');
  await new Promise(r => setTimeout(r, 600));

  let answer = '';
  if (sources.length === 0) {
    answer = "在示例知识库中未找到相关内容。\\n\\n可以试着问：Transformer 架构、RAG 检索增强、向量数据库、提示词工程、卡片盒笔记法、AI 智能体、本地优先软件，或「第二大脑」方法论。";
  } else {
    const ctx = sources.map((s,i) => '<b>[' + (i+1) + ']</b> ' + escH(s.chunk)).join('<br><br>');
    const srcList = sources.map((s,i) => '📄 <b>[' + (i+1) + ']</b> ' + escH(s.title) + ' <span class="tag">' + (s.score*100).toFixed(0) + '%</span>').join('<br>');
    answer = '🔍 找到 ' + sources.length + ' 条相关内容：\\n\\n' + ctx + '\\n\\n---\\n📚 <b>来源：</b>\\n' + srcList;
  }

  typing.innerHTML = answer.replace(/\\\\n/g, '<br>').replace(/\\n/g, '<br>');
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatSend.addEventListener('click', sendChat);
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }});

document.querySelectorAll('.chat-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    chatInput.value = chip.dataset.q;
    sendChat();
  });
});

// Browse
const browseList = document.getElementById('browse-list');
browseList.innerHTML = PAGES.map(p =>
  '<div class="glass page-card">' +
  '<h3>' + escH(p.title) + '</h3>' +
  '<div class="tags" style="margin-bottom:8px">' + p.tags.map(t => '<span class="tag">' + escH(t) + '</span>').join('') + ' <span class="tag">' + escH(p.type) + '</span></div>' +
  '<div class="content">' + escH(p.content) + '</div>' +
  '</div>'
).join('');

// Tabs
document.querySelectorAll('.pg-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.pg-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.pg-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});
</script>
</body></html>`;
}
