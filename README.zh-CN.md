<div align="center">

# 🧠 DeepBrain — 你的 AI 第二大脑

**面向每个人的个人知识管理工具**

不管你是学生、研究者、开发者还是知识工作者——DeepBrain 帮你把散落各处的知识汇集到一个智能大脑里。

[![npm](https://img.shields.io/npm/v/deepbrain)](https://www.npmjs.com/package/deepbrain)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-green)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)

[English](README.md) | **中文**

</div>

---

## 💡 你是否遇到过这些问题？

- 📚 **读书笔记** — 读完一本书，笔记存在某个 App 里，半年后完全忘了
- 🎓 **学习复习** — 学了很多东西，但没有系统的复习方法
- 📝 **知识管理** — Notion、Obsidian、飞书、语雀……知识散落在十几个工具里
- 🔬 **研究助手** — 论文笔记、项目文档、技术博客，想找的时候找不到

**DeepBrain 解决这一切。**

它是一个运行在你电脑上的 AI 大脑，用向量搜索理解你的知识，用自然语言帮你找到任何东西。

---

## 🎯 使用场景

### 📚 读书笔记

```bash
# 导入你的 Kindle 笔记 / 读书摘要
deepbrain put 三体读后感 "刘慈欣通过三体问题展示了宇宙的残酷法则——黑暗森林。核心观点是..."

# 半年后，想不起来具体内容？
deepbrain query "黑暗森林法则是什么？"
# → 精准返回你的笔记内容

# 生成复习闪卡
deepbrain flashcards generate
# → 自动从笔记生成问答卡片
```

### 🎓 学习复习

```bash
# 存入学习笔记
deepbrain put 机器学习笔记 ml-notes.md

# SM-2 间隔重复复习
deepbrain flashcards review
# → 按遗忘曲线安排复习，把知识刻进长期记忆

# 查看学习统计
deepbrain flashcards stats
```

### 📝 知识管理

```bash
# 从各平台一键导入
deepbrain import obsidian ./我的笔记库
deepbrain import notion ./notion导出
deepbrain import flomo ./flomo导出
deepbrain import yuque                    # 语雀 API 直接导入

# 语义搜索跨平台知识
deepbrain query "关于项目管理的最佳实践"
# → 不管笔记原来在哪个平台，都能找到
```

### 🔬 研究助手

```bash
# 导入论文笔记、技术文档
deepbrain import ebook paper.pdf
deepbrain put 调研报告 research.md

# 自动发现知识关联
deepbrain graph
deepbrain related 调研报告
# → 发现你可能忽略的相关知识

# 让 AI 基于你的知识库回答问题
deepbrain chat "根据我的调研，这个方向可行吗？"
```

---

## ⚡ 安装（1 分钟）

### 前提条件

- [Node.js](https://nodejs.org) 18 或以上版本（推荐用 [nvm](https://github.com/nvm-sh/nvm) 安装）

### 安装步骤

```bash
# 1. 全局安装
npm install -g deepbrain

# 2. 初始化（选一个 AI 提供商）
deepbrain init gemini          # Google Gemini — 推荐，有免费额度
deepbrain init deepseek        # DeepSeek — 国产大模型，性价比高
deepbrain init dashscope       # 阿里通义千问
deepbrain init zhipu           # 智谱 GLM
deepbrain init moonshot         # Moonshot（月之暗面）
deepbrain init ollama          # Ollama — 完全本地，零费用

# 3. 开始使用！
deepbrain put 第一条笔记 "你好，我的大脑！"
deepbrain query "你好"
```

### 检查安装

```bash
deepbrain doctor    # 检查配置、API 密钥、数据库状态
```

---

## 🌟 核心功能

### 1. 语义搜索 — 用你的话搜索

不用记关键词，用自然语言描述你要找的东西：

```bash
deepbrain query "上次团队讨论了什么技术方案？"
deepbrain query "关于用户增长的想法"
deepbrain query "React 和 Vue 的对比"
```

### 2. 知识图谱 — 自动发现关联

```bash
deepbrain graph                  # 构建知识图谱
deepbrain graph query "TypeScript"  # 查看某个话题的关联
deepbrain related <slug>          # 找相关页面
```

### 3. 闪卡复习 — 间隔重复

基于 SM-2 算法，像 Anki 一样帮你记住知识：

```bash
deepbrain flashcards generate    # 从知识库自动生成闪卡
deepbrain flashcards review      # 开始今日复习
deepbrain flashcards stats       # 查看复习统计
```

### 4. 梦境循环 — 自动维护

```bash
deepbrain dream    # 自动修复断链、刷新过期内容、补全缺失的向量
```

### 5. 与大脑对话 — RAG 问答

```bash
deepbrain chat "总结我这周学了什么"
deepbrain chat -i                # 多轮对话模式
deepbrain chat -i --session abc  # 恢复之前的对话
```

### 6. Web 界面

```bash
deepbrain web --port 3000    # 打开浏览器访问 http://localhost:3000
```

提供页面浏览、搜索、标签云、知识图谱可视化等功能。

---

## 📥 支持导入的平台（21 个）

### 国内平台（8 个）

| 平台 | 命令 | 说明 |
|------|------|------|
| 语雀 | `deepbrain import yuque` | API 导入 |
| 飞书 | `deepbrain import feishu` | 文档导入 |
| 石墨文档 | `deepbrain import shimo` | 导出文件 |
| 微信公众号 | `deepbrain import wechat` | 文章抓取 |
| Flomo | `deepbrain import flomo` | 导出数据 |
| FlowUs 息流 | `deepbrain import flowus` | 导出数据 |
| 思源笔记 | `deepbrain import siyuan` | 数据目录 |
| 我来 Wolai | `deepbrain import wolai` | 导出数据 |

### 国际平台（11 个）

| 平台 | 命令 |
|------|------|
| Notion | `deepbrain sync notion` / `deepbrain import notion` |
| Obsidian | `deepbrain import obsidian` / `deepbrain watch` |
| Evernote | `deepbrain import evernote` |
| Roam Research | `deepbrain import roam` |
| Logseq | `deepbrain import logseq` |
| Bear | `deepbrain import bear` |
| Apple Notes | `deepbrain import apple-notes` |
| Google Keep | `deepbrain import google-keep` |
| OneNote | `deepbrain import onenote` |
| Joplin | `deepbrain import joplin` |
| Day One | `deepbrain import dayone` |

### 其他

| 来源 | 命令 |
|------|------|
| GitHub 仓库 | `deepbrain import github --repo owner/repo` |
| GitHub Star | `deepbrain import github-stars --user name` |
| YouTube 视频 | `deepbrain import youtube <url>` |
| RSS 订阅 | `deepbrain sync rss --add <url>` |
| EPUB / PDF | `deepbrain import ebook <file>` |
| Readwise | `deepbrain import readwise` |

---

## 📤 导出（5 种格式）

数据是你的，随时带走：

```bash
deepbrain export --format markdown --output ./备份
deepbrain export --format obsidian --output ./我的笔记库     # 直接用 Obsidian 打开
deepbrain export --format logseq --output ./我的图谱         # 直接用 Logseq 打开
deepbrain export --format json --output ./data.json          # 程序处理
deepbrain export --format html --output ./网站               # 静态网站
```

---

## 🔌 MCP 集成 — 让 AI 助手读取你的大脑

DeepBrain 支持 MCP（Model Context Protocol），让 Claude Desktop、Cursor 等 AI 工具直接访问你的知识库。

在 AI 工具的设置中添加：

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

提供 12 个工具：存储、读取、搜索、链接、时间线、统计、维护等。

---

## 🔧 Chrome 扩展 — 网页剪藏

一键保存网页内容到你的大脑：

1. 启动 DeepBrain API：`deepbrain serve --port 3333`
2. 在 Chrome 中加载 `extension/` 目录（开发者模式）
3. 点击工具栏的 🧠 图标即可保存当前网页

详见 [扩展安装说明](extension/README.md)。

---

## 🥊 与相关工具对比

| 特性 | DeepBrain | Obsidian | Notion | Mem.ai | 腾讯 IMA |
|------|-----------|----------|--------|--------|---------|
| 导入来源 | 21 个平台 | 🟡 社区插件 | 🟡 有限导入 | ⚠️ 较少 | 仅微信 |
| 中文平台 | 8 个 | 🟡 社区插件 | ❌ | ❌ | 1 |
| 语义搜索 | ✅ 混合搜索 | 🟡 需插件 | 🟡 有限 AI 搜索 | ✅ | ❌ |
| 知识图谱 | ✅ 自动 | ✅ 手动+插件 | ❌ | ❌ | ❌ |
| 间隔重复 | ✅ SM-2 | 🟡 插件 | ❌ | ❌ | ❌ |
| 本地运行 | ✅ | ✅ | ❌ | ❌ | ❌ |
| AI 提供商 | 7 个可选 | 🟡 插件 | 内置 AI | 自有 | 仅混元 |
| MCP 集成 | ✅ 12 工具 | ❌ | ❌ | ❌ | ❌ |
| 开源 | ✅ Apache-2.0 | 🟡 核心闭源 | ❌ | ❌ | ❌ |
| 数据归属 | ✅ 100% 本地 | ✅ | ❌ 云端 | ❌ 云端 | ❌ 云端 |
| 社区规模 | 早期项目 | ✅ 大型社区 | ✅ 大型社区 | ⚠️ 中等 | ⚠️ 中等 |
| 插件生态 | 早期 | ✅ 丰富 | ✅ 丰富 | ❌ | ❌ |

DeepBrain 侧重 AI 驱动的语义搜索和知识进化，适合希望在本地管理知识并接入多种 AI 的用户。Obsidian 和 Notion 在社区生态和功能成熟度上有明显优势。

> 对比基于各产品公开信息（截至 2026 年 4 月），如有偏差欢迎 [Issue 指正](https://github.com/Deepleaper/deepbrain/issues)。

---

## 📖 完整 CLI 命令

```bash
# 初始化
deepbrain init [provider]                  # 初始化大脑
deepbrain init [provider] --brain <name>   # 创建命名大脑
deepbrain doctor                           # 健康检查

# 基础操作
deepbrain put <slug> [file]                # 添加/更新（自动摘要+标签）
deepbrain get <slug>                       # 读取
deepbrain query <text>                     # 语义搜索
deepbrain search <keyword>                 # 关键词搜索
deepbrain chat "question"                  # RAG 对话
deepbrain list [--type note]               # 列表
deepbrain stats                            # 统计

# 知识管理
deepbrain tag <slug> <tag>                 # 打标签
deepbrain link <from> <to>                 # 创建链接
deepbrain timeline <slug> <date> <text>    # 添加时间线
deepbrain dream                            # 维护循环
deepbrain graph                            # 知识图谱
deepbrain retag                            # 重新打标签
deepbrain compress [slug]                  # 压缩旧记忆

# 学习
deepbrain flashcards generate              # 生成闪卡
deepbrain flashcards review                # 复习
deepbrain digest --period weekly           # 知识周报

# 多大脑
deepbrain list-brains                      # 所有大脑
deepbrain --brain <name> ...               # 使用指定大脑
deepbrain merge <source> <target>          # 合并大脑

# 分享
deepbrain web [--port 3000]                # Web 界面
deepbrain serve [--port 3333]              # API 服务
deepbrain share --port 8080                # 只读分享
deepbrain share --export ./site            # 静态导出
deepbrain playground                       # 体验模式

# 备份
deepbrain backup --output brain.zip        # 备份
deepbrain restore brain.zip                # 恢复

# 全局参数
--brain <name>                             # 指定大脑
--lang zh                                  # 中文界面
```

---

## 📄 开源协议

Apache-2.0 © [Magicray1217](https://github.com/Magicray1217)

由 [跃盟科技 Deepleaper](https://www.deepleaper.com) 出品

---

<div align="center">

**🧠 你的知识值得拥有一个大脑，而不只是一个文件夹。**

[立即安装 →](https://www.npmjs.com/package/deepbrain) · [GitHub](https://github.com/Magicray1217/deepbrain) · [问题反馈](https://github.com/Magicray1217/deepbrain/issues)

</div>
