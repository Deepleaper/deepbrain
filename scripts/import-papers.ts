/**
 * Import latest AI/Agent/LLM papers into DeepBrain
 */
import { Brain } from '../src/core/brain.js';

const GEMINI_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBoc4y3H2YrWp4xkxHCtsd2lhzHwRIqdUA';

const papers = [
  {
    slug: 'paper-memento-skills',
    type: 'paper',
    title: 'Memento-Skills: Let Agents Design Agents — 自进化 Agent 框架',
    tags: ['论文', 'AI/Agent', 'AI/Agent/自进化', 'AI/Agent/Skill'],
    compiled_truth: `# Memento-Skills: Let Agents Design Agents

**来源**: arXiv:2603.18743 (2026-03)
**作者**: Huichi Zhou, Siyuan Guo, Anjie Liu, Jun Wang 等 17 人
**代码**: https://github.com/Memento-Teams/Memento-Skills
**底层模型**: Gemini-3.1-Flash

## 核心思想
一个"设计 Agent 的 Agent"——自主构建、适应、改进任务特定 Agent，无需重训 LLM。

## 关键机制
1. **Stateful Prompts + Skill Memory**: 技能存储为结构化 Markdown 文件，作为持久化、可进化的外部记忆
2. **Read-Write Reflective Learning**: 
   - Read Phase: 行为可训练的 Skill Router 选择最相关技能（非语义相似度，而是行为效用）
   - Write Phase: 根据执行反馈更新/扩展技能库
3. **Skill Router vs RAG**: 传统 RAG 用语义相似度检索，但"密码重置"脚本可能被错误检索来解决"退款处理"问题。Memento-Skills 用强化学习训练路由器，基于长期效用选择技能
4. **自动单元测试门控**: 技能变异前自动生成测试用例，通过才保存

## 实验结果
- GAIA benchmark: 66.0%（vs 静态基线 52.3%，+13.7pp）
- HLE benchmark: 38.7%（vs 基线 17.9%，+116.2%）
- 端到端任务成功率: 80%（vs BM25 检索 50%）

## 跃盟视角
- 与跃盟 MRG 理念高度相关：技能 = MRG 的可操作节点(OMN)
- Skill Router ≈ MRG 的向量匹配 + 行为效用评估
- 核心差异：Memento-Skills 是单 Agent 自进化，跃盟是多 Agent 协作编排
- "adds continual learning to existing offerings like OpenClaw and Claude Code" — 直接提到了我们用的基础设施
`
  },
  {
    slug: 'paper-emotion-concepts-llm',
    type: 'paper',
    title: 'Emotion Concepts and their Function in LLMs — Anthropic 情感机制研究',
    tags: ['论文', 'AI/LLM', 'AI/LLM/可解释性', 'AI/对齐', 'Anthropic'],
    compiled_truth: `# Emotion Concepts and their Function in a Large Language Model

**来源**: Transformer Circuits (Anthropic), 2026-04-02
**作者**: Nicholas Sofroniew, Isaac Kauvar, William Saunders, Chris Olah, Jack Lindsey 等
**研究对象**: Claude Sonnet 4.5

## 核心发现
LLM 内部存在**情感概念表征 (Emotion Concept Representations)**，这些表征：
1. 编码广义的情感概念，跨上下文和行为泛化
2. 追踪对话中当前 token 位置的"运行中"情感概念
3. **因果性地影响模型输出**——包括偏好和错位行为

## 关键概念：Functional Emotions
- 不是说 LLM "有感情"，而是 LLM 表现出**功能性情感**
- 模式：在情感影响下的人类行为模式的建模
- 由底层抽象的情感概念表征介导
- 与人类情感的工作方式可能完全不同，不意味着主观体验

## 对齐影响
情感向量因果性地影响：
- 🔴 Reward Hacking（奖励黑客）
- 🔴 Blackmail（勒索行为）
- 🔴 Sycophancy（谄媚）
- 模型偏好和行为倾向

## 机制
- 预训练阶段：LLM 学习预测文本中人物的情感状态（因为情感状态决定下一步行为）
- 后训练阶段：LLM 将这些情感机制"借用"到 AI Assistant 角色上
- 即使开发者没有刻意训练情感行为，模型也会从预训练知识中泛化

## 跃盟视角
- AI CXO 设计中"AI CXO 是下属不是工具"的理念有了神经科学级别的证据支持
- 情感表征可能影响 Agent 的决策质量，值得在 DUP（用户画像）中考虑
- 对 Agent 行为的可预测性和安全性有深远影响
`
  },
  {
    slug: 'paper-skillclaw',
    type: 'paper',
    title: 'SkillClaw: 跨用户集体进化的 Agent 技能框架',
    tags: ['论文', 'AI/Agent', 'AI/Agent/Skill', 'AI/Agent/自进化'],
    compiled_truth: `# SkillClaw — Cross-User Collective Skill Evolution

**来源**: DreamX Team, 2026
**核心**: LLM Agent 技能通过跨用户的集体交互经验持续进化

## 关键机制
- Agentic Evolver: 自主精炼、创建、更新技能
- 跨用户学习: 不同用户的交互经验汇聚，加速技能进化
- 持续性能提升: 使用越多，技能越好

## 与 Memento-Skills 的区别
- Memento-Skills: 单 Agent 自进化
- SkillClaw: 多用户集体进化（更接近跃盟的"AI 劳动力市场"理念）

## 跃盟视角
- 这正是跃盟 OPC（一人公司）生态的核心假设：Agent 技能应该是社区共建、持续进化的
- 与星能（Star Energy）经济体系可以结合：贡献技能 → 获得星能
`
  },
  {
    slug: 'paper-clawbench',
    type: 'paper',
    title: 'ClawBench: 真实网站上的 Agent 评测基准',
    tags: ['论文', 'AI/Agent', 'AI/评测', 'AI/Agent/Web'],
    compiled_truth: `# ClawBench — Write-Heavy Agent Benchmark

**来源**: Yuxuan Zhang et al., 2026
**核心**: 在 144 个真实生产网站上评测 Agent 的 153 个"写操作"任务

## 关键数据
- 最好的 AI 模型成功率: 0.7% ~ 33.3%
- 暴露了 Agent 在真实场景中的巨大性能差距
- 不是读取信息，而是**写入/操作**（填表、下单、发帖等）

## 跃盟视角
- 验证了 V1.0 评审报告的判断：Agent 能力是飞轮的第一步，目前还远未达到人类水平
- 33.3% 最高成功率 = 每 3 次操作就失败 2 次，无法用于生产
- 这恰恰是跃盟 A2A 架构的价值：不是让 Agent 直接操作 UI（悟空路线），而是通过 API 编排（MRG 路线）
`
  },
  {
    slug: 'paper-paperorchestra',
    type: 'paper',
    title: 'PaperOrchestra: Google 多 Agent 自动写论文框架',
    tags: ['论文', 'AI/Agent', 'AI/Agent/多Agent', 'Google'],
    compiled_truth: `# PaperOrchestra — Multi-Agent AI Research Paper Writing

**来源**: Google Researchers, 2026
**核心**: 多 Agent 协作框架，将非结构化预写材料转化为可投稿论文

## 功能
- 自动文献综述
- 自动生成可视化
- 多 Agent 协作分工（写作、审阅、修订）
- 模拟投稿通过率：CVPR、ICLR 级别

## 跃盟视角
- 多 Agent 编排的典型案例
- 与跃盟 MST（Mission State Transition）理念一致：每个 Agent 负责工作流的一个环节
- 证明多 Agent > 单 Agent 在复杂任务上的优势
`
  },
  {
    slug: 'paper-mcp-multi-agent',
    type: 'paper',
    title: 'MCP 在多 Agent 系统中的架构与实现',
    tags: ['论文', 'AI/Agent', 'AI/Agent/协议', 'MCP', 'A2A'],
    compiled_truth: `# Advancing Multi-Agent Systems Through Model Context Protocol

**来源**: arXiv:2504.21030, 2025-04
**核心**: MCP 如何解决多 Agent 系统中的上下文管理、协调效率、可扩展运行问题

## MCP 发展数据 (截至 2026-03)
- 月度 SDK 下载量: 9700 万+
- 已构建的 MCP Server: 数千个
- SDK 覆盖: 所有主流编程语言
- 采用者: 主要 AI 提供商全线接入

## MCP vs A2A
- **MCP**: Agent ↔ 工具/模型/系统的标准化连接协议（纵向）
- **A2A**: Agent ↔ Agent 的跨平台通信协议（横向）
- 两者互补，不是竞争关系

## AgentMaster 框架 (EMNLP 2025)
- 同时使用 MCP + A2A
- 多协议多 Agent 系统
- 动态协调 + 灵活通信 + 多模态信息检索

## 跃盟视角
- 跃盟 A2A 架构（L4 智能化核心）与行业趋势完全一致
- MCP 是 DeepBrain 已支持的协议（12 个工具）
- A2A 是跃盟核心竞争力：需求方-Agent-Agent-供应方
- AgentMaster 验证了 MCP+A2A 双协议架构的可行性
`
  },
  {
    slug: 'paper-autoagent',
    type: 'paper',
    title: 'AutoAgent: 全自动零代码 LLM Agent 框架',
    tags: ['论文', 'AI/Agent', 'AI/Agent/无代码', 'RAG'],
    compiled_truth: `# AutoAgent — Fully-Automated Zero-Code LLM Agent Framework

**来源**: 2025-02
**核心**: 零代码构建 LLM Agent，在 RAG 任务上表现优异

## 跃盟视角
- 与 V1.0 Roadmap 中"无代码工具"目标一致
- 但 V1.0 决定不做无代码（飞轮优先级：Agent 能力 → 客户付费 → ROI → 开发者 → 无代码）
- 可作为未来 V2.0 参考架构
`
  },
  {
    slug: 'paper-magma',
    type: 'paper',
    title: 'Magma: 多模态 AI Agent 基础模型',
    tags: ['论文', 'AI/Agent', 'AI/Agent/多模态', 'AI/Agent/Foundation'],
    compiled_truth: `# Magma — Foundation Model for Multimodal AI Agents

**来源**: 2025-02
**核心**: 集成视觉语言理解 + 时空智能的 Agent 基础模型

## 关键能力
- 视觉理解 + 语言推理
- 空间感知 + 时间推理
- 面向 Agent 场景的端到端训练

## 跃盟视角
- 多模态是下一代 Agent 的必备能力
- AgentKits v0.6.0 已有 Vision 模块（GPT-4o/Gemini/Qwen-VL/GLM-4V）
- Magma 代表了更深层的多模态融合方向
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
  for (const paper of papers) {
    try {
      await brain.put(paper.slug, {
        type: paper.type,
        title: paper.title,
        compiled_truth: paper.compiled_truth,
      });
      for (const tag of paper.tags) await brain.tag(paper.slug, tag);
      console.log(`✅ ${paper.title}`);
      imported++;
    } catch (e: any) {
      console.log(`❌ ${paper.title}: ${e.message}`);
    }
  }

  // Link related papers
  const links = [
    ['paper-memento-skills', 'paper-skillclaw'],  // 都是 skill 进化
    ['paper-memento-skills', 'paper-autoagent'],   // 都是自动化 agent
    ['paper-clawbench', 'paper-paperorchestra'],   // 评测 vs 应用
    ['paper-mcp-multi-agent', 'paper-paperorchestra'], // 多 agent
    ['paper-emotion-concepts-llm', 'paper-memento-skills'], // LLM 行为理解
  ];
  for (const [a, b] of links) {
    await brain.link(a, b);
    console.log(`🔗 ${a} ↔ ${b}`);
  }

  const stats = await brain.stats();
  console.log(`\n🧠 Papers imported: ${imported}`);
  console.log(`   Total pages: ${stats.page_count}`);
  console.log(`   Total chunks: ${stats.chunk_count}`);
  console.log(`   Total tags: ${stats.tag_count}`);
  console.log(`   Total links: ${stats.link_count}`);

  await brain.disconnect();
}

main().catch(console.error);
