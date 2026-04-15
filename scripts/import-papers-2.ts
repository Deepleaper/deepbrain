import { Brain } from '../src/core/brain.js';
const GEMINI_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBoc4y3H2YrWp4xkxHCtsd2lhzHwRIqdUA';

const papers = [
  {
    slug: 'paper-absolute-zero',
    type: 'paper',
    title: 'Absolute Zero: 零数据强化自博弈推理',
    tags: ['论文', 'AI/LLM', 'AI/LLM/推理', 'AI/LLM/强化学习', '重要'],
    compiled_truth: `# Absolute Zero: Reinforced Self-play Reasoning with Zero Data

**来源**: arXiv:2505.03335, 2025-05
**核心**: 单模型自我进化——既出题又解题，无需任何外部训练数据

## 关键机制
- 灵感来自 AlphaZero 的自博弈
- Absolute Zero Reasoner (AZR): 模型同时是 Proposer（出题）+ Solver（解题）
- 用代码执行器验证答案，提供统一的可验证奖励信号
- 训练课程自动进化：从简单题到复杂题

## 实验结果
- 零外部数据，超越使用数万人工样本的 zero-setting 模型
- 编程 + 数学推理 SOTA

## 跃盟视角
- 🔥 这是 Agent 自主学习的终极方向：不需要人工标注数据
- 与 Memento-Skills 互补：Memento 在任务层自进化，AZR 在推理能力层自进化
- 对跃盟 MRG 的启示：Agent 的推理能力可以自我训练，不依赖人工构建的推导链
`
  },
  {
    slug: 'paper-agents-md-evaluation',
    type: 'paper',
    title: 'Evaluating AGENTS.md: Context Engineering 对 Coding Agent 的影响',
    tags: ['论文', 'AI/Agent', 'AI/Agent/Context Engineering', 'AI/Agent/Coding', '重要'],
    compiled_truth: `# Evaluating AGENTS.md — Context Engineering for Coding Agents

**来源**: Gloaguen et al., 2026
**核心**: LLM 生成的 AGENTS.md 文件可能反而损害 Agent 性能

## 关键发现
- LLM 生成的 context 文件可能增加噪声和推理成本
- **人工编写的最小 context > LLM 自动生成的详细 context**
- 越少越好：精准的上下文比全面的上下文更有效

## 跃盟视角
- 🔴 直接挑战了"让 AI 自动生成文档"的假设
- 与跃盟 DUP（用户画像）设计一致：特征增强要精准，不是越多越好
- OpenClaw 的 AGENTS.md 应该人工维护，不应自动化
- 对 DeepBrain 的启示：知识检索质量 > 知识数量
`
  },
  {
    slug: 'paper-agentic-context-engineering',
    type: 'paper',
    title: 'ACE: 动态 Context Engineering — ICLR 2026',
    tags: ['论文', 'AI/Agent', 'AI/Agent/Context Engineering', 'ICLR'],
    compiled_truth: `# Agentic Context Engineering (ACE)

**来源**: Zhang et al., ICLR 2026
**核心**: 把 context 当作活文档——Agent 自动生成策略、反思结果、迭代优化上下文

## 与静态 AGENTS.md 的区别
- 静态：一次编写，反复使用
- ACE：迭代进化，成功策略保留，失败策略删除
- Context 不是输入，是 Agent 的"工作记忆"

## 跃盟视角
- 与 DeepBrain 的 Compiled Truth（可覆写）+ Timeline（只追加）双轨存储完美对应
- ACE 的 "context as evolving document" = DeepBrain 的页面更新机制
- MRG 中的 MNS→ME→MN 推导链也是一种动态 context
`
  },
  {
    slug: 'paper-mem0',
    type: 'paper',
    title: 'Mem0: 生产级 Agent 长期记忆架构',
    tags: ['论文', 'AI/Agent', 'AI/Agent/Memory', 'AI/Agent/生产级', '重要'],
    compiled_truth: `# Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory

**核心**: 以记忆为中心的 Agent 架构，图记忆增强长对话连贯性

## 关键设计
- 图记忆（Graph Memory）：不是简单的 key-value，是关系图谱
- 高效提取、合并、检索
- 面向生产环境的可扩展架构

## 跃盟视角
- DeepBrain 的知识图谱（双向链接 + Tag Graph）走的正是这条路
- Mem0 的图记忆 ≈ DeepBrain 的 links + tags 系统
- 验证了 DeepBrain 架构方向的正确性
- 但 Mem0 更偏会话记忆，DeepBrain 更偏知识管理
`
  },
  {
    slug: 'paper-halumem',
    type: 'paper',
    title: 'HaluMem: Agent 记忆幻觉评测基准',
    tags: ['论文', 'AI/Agent', 'AI/Agent/Memory', 'AI/评测', 'AI/幻觉'],
    compiled_truth: `# HaluMem: Evaluating Hallucinations in Agent Memory

**来源**: 2025 late
**核心**: 评测 Agent 记忆系统中的幻觉问题

## 幻觉来源分类
1. **记忆提取幻觉**: 从对话中提取错误信息
2. **记忆更新幻觉**: 更新时引入矛盾
3. **问答幻觉**: 基于记忆回答时产生的幻觉

## 跃盟视角
- DeepBrain 的 Dream Cycle（维护机制）需要加入幻觉检测
- Compiled Truth 的覆写机制天然减少"记忆更新幻觉"
- Timeline 的只追加设计避免了历史记忆被篡改
`
  },
  {
    slug: 'paper-beam-light',
    type: 'paper',
    title: 'BEAM & LIGHT: LLM 长期记忆评测与增强',
    tags: ['论文', 'AI/LLM', 'AI/Agent/Memory', 'AI/评测'],
    compiled_truth: `# BEAM & LIGHT — Long-Term Memory Benchmark and Augmentation

**来源**: 2025 late
**核心**: 
- BEAM = 大规模长期记忆评测基准
- LIGHT = LLM 记忆增强方案（情景记忆 + 工作记忆 + 草稿本记忆）

## 人类认知启发的三种记忆
1. **Episodic Memory**: 事件记忆（"昨天会议讨论了什么"）
2. **Working Memory**: 工作记忆（当前任务的临时信息）
3. **Scratchpad Memory**: 草稿本（推理过程中的中间结果）

## 跃盟视角
- DeepBrain 的三种数据类型恰好对应：
  - Timeline = Episodic Memory
  - Compiled Truth = Working Memory（当前最新状态）
  - 搜索结果/Tag Graph = Scratchpad（检索推理的中间产物）
- 进一步验证了 DeepBrain 的双轨存储 + 知识图谱架构
`
  },
  {
    slug: 'paper-deepseek-r1',
    type: 'paper',
    title: 'DeepSeek-R1: 强化学习驱动的推理模型',
    tags: ['论文', 'AI/LLM', 'AI/LLM/推理', 'AI/LLM/强化学习', 'DeepSeek', '重要'],
    compiled_truth: `# DeepSeek-R1 — RL-Powered Reasoning Model

**来源**: DeepSeek, 2025
**核心**: 用强化学习训练推理能力，媲美 OpenAI o1

## 关键特点
- R1-0528 版本解决了重复性和可读性问题
- 长上下文 + 工具使用场景优化
- V3 版本进一步面向 Agent 工作负载

## 实验结果
- 数学、代码、推理任务与 OpenAI o1 持平
- 开源可用，成本远低于 o1

## 跃盟视角
- AgentKits 已支持 DeepSeek 作为 LLM provider
- 推理模型是 Agent 链路中最核心的能力
- 成本优势对跃盟 RaaS（Robot as a Service）模式极其重要
`
  },
  {
    slug: 'paper-can-ai-agents-agree',
    type: 'paper',
    title: 'Can AI Agents Agree? LLM Agent 在对抗性共识中的行为',
    tags: ['论文', 'AI/Agent', 'AI/Agent/多Agent', 'AI/Agent/协调', 'AI/安全'],
    compiled_truth: `# Can AI Agents Agree?

**来源**: arXiv:2603.01213, Frédéric Berdoz et al., 2026-03
**核心**: LLM Agent 在对抗性共识场景中的行为研究

## 关键发现
- 🔴 即使在良性环境下，Agent 间的有效共识也不可靠
- 🔴 随着 Agent 数量增加，共识质量下降
- 对依赖"多 Agent 投票/协商"的部署方案发出警告

## 跃盟视角
- 直接挑战了简单的"多 Agent 民主决策"模式
- 支持跃盟 MST（Mission State Transition）的设计：不是让 Agent 协商决策，而是由编排层分配任务
- MRG 的 MNS→ME→MN 推导链是结构化的，不依赖 Agent 间的"共识"
`
  },
  {
    slug: 'paper-trap-vla',
    type: 'paper',
    title: 'TRAP: 对抗性补丁劫持 VLA 思维链推理',
    tags: ['论文', 'AI/安全', 'AI/Agent', 'AI/Agent/多模态'],
    compiled_truth: `# TRAP: Hijacking VLA CoT-Reasoning via Adversarial Patches

**来源**: arXiv, 2026-03-25
**核心**: Vision-Language-Action 模型的思维链推理可以被对抗性补丁劫持

## 威胁
- 在图像中嵌入对抗性 patch → 劫持模型的 Chain-of-Thought 推理
- 影响：具身 Agent（机器人、自动驾驶）的安全性

## 跃盟视角
- Agent 安全是 V1.0 的隐性需求
- 对 AgentKits Vision 模块有参考价值：多模态输入需要安全验证层
`
  },
  {
    slug: 'paper-efficient-agent-benchmarking',
    type: 'paper',
    title: '高效 Agent 评测: 减少 44-70% 评估任务',
    tags: ['论文', 'AI/Agent', 'AI/评测'],
    compiled_truth: `# Efficient Benchmarking of AI Agents

**来源**: arXiv:2603.23749, Franck Stéphane Ndzomga, 2026-03-24
**核心**: 只评测通过率 30-70% 的中间难度任务，减少 44-70% 的评估成本

## 方法
- 优化无关协议：利用历史通过率筛选信息量最大的任务
- 太简单（>70% 通过）和太难（<30% 通过）的任务贡献低
- 排名保真度高（高 Spearman 相关）

## 跃盟视角
- V1.0 评审中需要评估"Agent 能否达到人类水平"
- 这个方法可以大幅降低评估成本
`
  },
  {
    slug: 'paper-builderbench',
    type: 'paper',
    title: 'BuilderBench: 智能 Agent 的基础构件评测',
    tags: ['论文', 'AI/Agent', 'AI/评测', 'AI/Agent/预训练'],
    compiled_truth: `# BuilderBench: The Building Blocks of Intelligent Agents

**来源**: arXiv, 2026-03-25
**核心**: 面向 Agent 预训练研究的新 benchmark，通过开放式探索加速研究
`
  },
  {
    slug: 'paper-ai-agents-eu-law',
    type: 'paper',
    title: 'AI Agents Under EU Law: 合规挑战与框架',
    tags: ['论文', 'AI/Agent', 'AI/监管', 'AI/Agent/合规'],
    compiled_truth: `# AI Agents Under EU Law

**来源**: arXiv:2604.04604, Philipp Hacker et al., 2026-04-07
**核心**: AI Agent 提供商的系统性合规映射

## 关键挑战
1. 网络安全合规
2. 人类监督要求
3. 透明度义务
4. **运行时行为漂移** — 高风险 Agent 的行为在运行中可能偏移，不满足 EU AI Act

## 结论
- 具有不可追踪行为漂移的高风险 Agent 目前**无法满足** AI Act 的基本要求

## 跃盟视角
- 跃盟出海（OEM 画布）必须关注 EU AI Act 合规
- 行为漂移问题 = Memento-Skills 类自进化 Agent 的监管风险
- MST 的工作流编排天然比自由 Agent 更易合规（可追踪、可审计）
`
  },
  {
    slug: 'paper-maxs',
    type: 'paper',
    title: 'MAXS: LLM Agent 的元自适应探索框架',
    tags: ['论文', 'AI/Agent', 'AI/Agent/规划'],
    compiled_truth: `# MAXS: Meta-Adaptive Exploration with LLM Agents

**来源**: 2026-01
**核心**: 解决 LLM Agent 的"局部近视"和"轨迹不稳定"问题

## 关键机制
- 灵活前瞻策略：不只看下一步，看多步
- 轨迹收敛机制：防止 Agent 在多工具执行中漫无目的
- 面向多工具执行场景

## 跃盟视角
- MRG 的推导链（MNS→ME→MN→OMN）就是一种结构化的前瞻
- MST 的状态转移天然解决轨迹不稳定问题
`
  },
  {
    slug: 'paper-multi-agent-orchestration',
    type: 'paper',
    title: '多 Agent 系统编排: 架构、协议与企业采用',
    tags: ['论文', 'AI/Agent', 'AI/Agent/多Agent', 'AI/Agent/编排', '重要'],
    compiled_truth: `# The Orchestration of Multi-Agent Systems: Architectures, Protocols, and Enterprise Adoption

**核心**: 多 Agent 编排系统的统一架构框架

## 覆盖内容
- 编排架构分类
- 通信协议标准化
- 企业落地路径

## 跃盟视角
- 跃盟 MST（Mission State Transition）= 编排层
- MRG = 任务图谱层
- 这篇论文是跃盟架构的学术背书
`
  },
  {
    slug: 'paper-context-rot',
    type: 'paper',
    title: 'Context Rot: LLM 输入长度增加时的性能退化',
    tags: ['论文', 'AI/LLM', 'AI/LLM/上下文', 'AI/LLM/局限性'],
    compiled_truth: `# Context Rot — LLM Performance Degradation with Input Length

**来源**: Chroma, 2025
**核心**: LLM 性能随输入长度增加而退化，即使是简单任务

## 关键发现
- 准确度在某个临界点后**断崖式下降**（非线性）
- 即使任务很简单，长输入也会导致性能崩溃
- "更多 context ≠ 更好" — 精心结构化的 context 远比堆量重要

## 跃盟视角
- 🔴 直接影响 Agent 设计：不能把所有信息都塞进 prompt
- 支持 DUP 的"特征增强"设计：精选特征，不是全量注入
- DeepBrain 的搜索（top-K 检索）比全文注入更安全
- 与 AGENTS.md 评估论文结论一致：少即是多
`
  },
];

async function main() {
  const brain = new Brain({
    embedding_provider: 'gemini',
    api_key: GEMINI_KEY,
    database: './deepbrain-data',
  });
  await brain.connect();

  let imported = 0;
  for (const p of papers) {
    try {
      await brain.put(p.slug, { type: p.type, title: p.title, compiled_truth: p.compiled_truth });
      for (const tag of p.tags) await brain.tag(p.slug, tag);
      console.log(`✅ ${p.title}`);
      imported++;
    } catch (e: any) {
      console.log(`❌ ${p.title}: ${e.message}`);
    }
  }

  // Link related papers
  const links = [
    ['paper-absolute-zero', 'paper-deepseek-r1'],           // 推理
    ['paper-absolute-zero', 'paper-memento-skills'],         // 自进化
    ['paper-agents-md-evaluation', 'paper-agentic-context-engineering'], // context engineering
    ['paper-agents-md-evaluation', 'paper-context-rot'],     // context 质量
    ['paper-mem0', 'paper-halumem'],                         // memory
    ['paper-mem0', 'paper-beam-light'],                      // memory
    ['paper-can-ai-agents-agree', 'paper-multi-agent-orchestration'], // 多agent
    ['paper-mcp-multi-agent', 'paper-multi-agent-orchestration'],     // 多agent
    ['paper-trap-vla', 'paper-magma'],                       // 多模态安全
    ['paper-clawbench', 'paper-efficient-agent-benchmarking'], // 评测
    ['paper-clawbench', 'paper-builderbench'],               // 评测
    ['paper-ai-agents-eu-law', 'paper-memento-skills'],      // 自进化合规风险
    ['paper-maxs', 'paper-multi-agent-orchestration'],       // 编排
    ['paper-skillclaw', 'paper-absolute-zero'],              // 自进化
  ];
  for (const [a, b] of links) {
    try { await brain.link(a, b); } catch {}
  }

  const stats = await brain.stats();
  console.log(`\n🧠 Batch 2 imported: ${imported}`);
  console.log(`   Total pages: ${stats.page_count}`);
  console.log(`   Total chunks: ${stats.chunk_count}`);
  console.log(`   Total tags: ${stats.tag_count}`);
  console.log(`   Total links: ${stats.link_count}`);
  await brain.disconnect();
}
main().catch(console.error);
