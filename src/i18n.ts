/**
 * DeepBrain — Multi-Language Support (i18n)
 *
 * Supports English and Chinese with auto-detection.
 */

export type Locale = 'en' | 'zh';

const messages: Record<string, Record<Locale, string>> = {
  // CLI messages
  'brain.initialized': { en: '🧠 DeepBrain initialized!', zh: '🧠 DeepBrain 已初始化！' },
  'brain.name': { en: 'Brain', zh: '大脑' },
  'brain.provider': { en: 'Provider', zh: '提供商' },
  'brain.config': { en: 'Config', zh: '配置' },
  'brain.data': { en: 'Data', zh: '数据' },
  'brain.try': { en: 'Try: deepbrain put my-first-note notes.md', zh: '试试: deepbrain put my-first-note notes.md' },
  'page.saved': { en: '✅ {slug} saved ({chars} chars, type: {type})', zh: '✅ {slug} 已保存（{chars} 字符，类型：{type}）' },
  'page.notFound': { en: 'Page not found: {slug}', zh: '页面未找到：{slug}' },
  'search.noResults': { en: 'No results found.', zh: '未找到结果。' },
  'search.results': { en: '🔍 {count} results for "{query}"', zh: '🔍 "{query}" 找到 {count} 条结果' },
  'search.keyword': { en: '🔑 {count} results for "{query}"', zh: '🔑 "{query}" 找到 {count} 条结果' },
  'stats.title': { en: '🧠 DeepBrain Stats', zh: '🧠 DeepBrain 统计' },
  'stats.pages': { en: 'Pages', zh: '页面' },
  'stats.chunks': { en: 'Chunks', zh: '分块' },
  'stats.links': { en: 'Links', zh: '链接' },
  'stats.tags': { en: 'Tags', zh: '标签' },
  'stats.timeline': { en: 'Timeline', zh: '时间线' },
  'stats.embedded': { en: 'Embedded', zh: '已向量化' },
  'list.title': { en: '📋 {count} pages', zh: '📋 {count} 个页面' },
  'dream.running': { en: '💤 Running Dream Cycle...', zh: '💤 正在运行 Dream Cycle...' },
  'dream.complete': { en: '✅ Dream complete', zh: '✅ Dream 完成' },
  'link.created': { en: '🔗 {from} → {to}', zh: '🔗 {from} → {to}' },
  'timeline.added': { en: '📅 Timeline added to {slug}', zh: '📅 时间线已添加到 {slug}' },
  'summary.auto': { en: '📝 Summary: {summary}', zh: '📝 摘要：{summary}' },
  'tags.auto': { en: '🏷️  Tags: {tags}', zh: '🏷️  标签：{tags}' },
  'tags.skipped': { en: 'ℹ️  Auto-summary skipped (LLM unavailable).', zh: 'ℹ️  自动摘要已跳过（LLM 不可用）。' },
  'retag.start': { en: '🏷️  Re-tagging all pages...', zh: '🏷️  正在重新标记所有页面...' },
  'retag.done': { en: '✅ Re-tagged {count} pages', zh: '✅ 已重新标记 {count} 个页面' },
  'retag.page': { en: '  🏷️  {slug}: {tags}', zh: '  🏷️  {slug}：{tags}' },
  'error.credentials': { en: '❌ Missing credentials!', zh: '❌ 缺少凭证！' },
  'error.notInitialized': { en: '❌ Brain not initialized!', zh: '❌ 大脑未初始化！' },
  'webhook.fired': { en: '🔔 Webhook fired: {event}', zh: '🔔 Webhook 已触发：{event}' },
  'webhook.failed': { en: '⚠️ Webhook failed: {url}', zh: '⚠️ Webhook 失败：{url}' },

  // Web UI
  'web.title': { en: 'DeepBrain', zh: 'DeepBrain 智脑' },
  'web.pages': { en: 'Pages', zh: '页面' },
  'web.search': { en: 'Search', zh: '搜索' },
  'web.tags': { en: 'Tags', zh: '标签' },
  'web.stats': { en: 'Stats', zh: '统计' },
  'web.graph': { en: 'Knowledge Graph', zh: '知识图谱' },
  'web.brains': { en: 'Brains', zh: '大脑' },
  'web.allPages': { en: 'All Pages', zh: '所有页面' },
  'web.noPages': { en: 'No pages yet. Add some knowledge!', zh: '暂无页面，添加一些知识吧！' },
  'web.searchPlaceholder': { en: 'Search your brain...', zh: '搜索你的大脑...' },
  'web.score': { en: 'Score', zh: '分数' },
  'web.type': { en: 'Type', zh: '类型' },
  'web.updated': { en: 'Updated', zh: '更新于' },
  'web.tagCloud': { en: 'Tag Cloud', zh: '标签云' },
  'web.tagTree': { en: 'Tag Tree', zh: '标签树' },
  'web.allTags': { en: 'All Tags', zh: '所有标签' },
  'web.noTags': { en: 'No tags yet', zh: '暂无标签' },
  'web.footer': { en: 'DeepBrain — Your AI-powered second brain', zh: 'DeepBrain — 你的 AI 第二大脑' },
  'web.metadata': { en: 'Metadata', zh: '元数据' },
  'web.backlinks': { en: 'Backlinks', zh: '反向链接' },
  'web.relatedPages': { en: 'Related Pages', zh: '相关页面' },
  'web.flashcards': { en: 'Flashcards', zh: '闪卡' },
  'web.playground': { en: 'Playground', zh: '体验场' },
  'web.chat': { en: 'Chat', zh: '对话' },
  'web.save': { en: 'Save', zh: '保存' },
  'web.delete': { en: 'Delete', zh: '删除' },
  'web.edit': { en: 'Edit', zh: '编辑' },
  'web.cancel': { en: 'Cancel', zh: '取消' },
  'web.confirm': { en: 'Confirm', zh: '确认' },
  'web.loading': { en: 'Loading...', zh: '加载中...' },
  'web.noResults': { en: 'No results', zh: '无结果' },

  // Init messages
  'init.detected': { en: '🔍 Auto-detected API key from {key}', zh: '🔍 自动检测到 API 密钥：{key}' },
  'init.success': { en: '🧠 DeepBrain initialized!', zh: '🧠 DeepBrain 已初始化！' },
  'init.brain': { en: '   Brain:    {name}', zh: '   大脑：    {name}' },
  'init.provider': { en: '   Provider: {provider}', zh: '   提供商：  {provider}' },
  'init.config': { en: '   Config:   {path}', zh: '   配置：    {path}' },
  'init.data': { en: '   Data:     {path}', zh: '   数据：    {path}' },
  'init.template.applied': { en: '📋 Template "{name}" applied!', zh: '📋 模板 "{name}" 已应用！' },
  'init.template.notFound': { en: '⚠️ Template "{name}" not found.', zh: '⚠️ 模板 "{name}" 未找到。' },
  'init.checklist': { en: '📋 Getting Started Checklist:', zh: '📋 快速入门清单：' },
  'init.checklist.addNote': { en: '   ◻ Add your first note:   deepbrain put my-note notes.md', zh: '   ◻ 添加第一条笔记：deepbrain put 我的笔记 notes.md' },
  'init.checklist.search': { en: '   ◻ Search your brain:      deepbrain query "something"', zh: '   ◻ 搜索大脑：      deepbrain query "搜点什么"' },
  'init.checklist.chat': { en: '   ◻ Chat with your brain:   deepbrain chat "question"', zh: '   ◻ 与大脑对话：    deepbrain chat "你的问题"' },
  'init.checklist.playground': { en: '   ◻ Try the playground:     deepbrain playground', zh: '   ◻ 试试体验模式：  deepbrain playground' },
  'init.checklist.doctor': { en: '   ◻ Check health:           deepbrain doctor', zh: '   ◻ 健康检查：      deepbrain doctor' },
  'init.providers': { en: '📋 Available providers & pricing:', zh: '📋 可用的 AI 提供商及价格：' },

  // Doctor messages
  'doctor.title': { en: '🩺 DeepBrain Doctor', zh: '🩺 DeepBrain 健康检查' },
  'doctor.pass': { en: '✅ {item}: OK', zh: '✅ {item}：正常' },
  'doctor.fail': { en: '❌ {item}: FAILED', zh: '❌ {item}：异常' },
  'doctor.warn': { en: '⚠️ {item}: WARNING', zh: '⚠️ {item}：警告' },

  // Flashcard messages
  'flashcards.generate': { en: '📇 Generating flashcards...', zh: '📇 正在生成闪卡...' },
  'flashcards.generated': { en: '✅ Generated {count} flashcards', zh: '✅ 已生成 {count} 张闪卡' },
  'flashcards.review.start': { en: '📇 Starting review ({count} cards due)', zh: '📇 开始复习（{count} 张待复习）' },
  'flashcards.review.done': { en: '✅ Review complete!', zh: '✅ 复习完成！' },
  'flashcards.noDue': { en: '🎉 No cards due for review!', zh: '🎉 没有待复习的闪卡！' },

  // Backup messages
  'backup.start': { en: '💾 Backing up brain...', zh: '💾 正在备份大脑...' },
  'backup.done': { en: '✅ Backup saved to {path}', zh: '✅ 备份已保存到 {path}' },
  'restore.start': { en: '📂 Restoring brain...', zh: '📂 正在恢复大脑...' },
  'restore.done': { en: '✅ Brain restored!', zh: '✅ 大脑已恢复！' },

  // Import messages
  'import.start': { en: '📥 Importing from {source}...', zh: '📥 正在从 {source} 导入...' },
  'import.done': { en: '✅ Imported {count} pages from {source}', zh: '✅ 从 {source} 导入了 {count} 个页面' },
  'import.progress': { en: '  [{current}/{total}] {name}', zh: '  [{current}/{total}] {name}' },

  // Share messages
  'share.start': { en: '🌐 Sharing brain on port {port}...', zh: '🌐 大脑分享服务启动在端口 {port}...' },
  'share.export': { en: '📦 Exporting static site to {path}...', zh: '📦 正在导出静态站点到 {path}...' },

  // Graph messages
  'graph.building': { en: '🕸️ Building knowledge graph...', zh: '🕸️ 正在构建知识图谱...' },
  'graph.done': { en: '✅ Knowledge graph built: {entities} entities, {relations} relations', zh: '✅ 知识图谱已构建：{entities} 个实体，{relations} 个关系' },
};

let currentLocale: Locale = 'en';

/** Detect locale from env / system. Defaults to Chinese (primary audience). */
export function detectLocale(): Locale {
  const lang = process.env.DEEPBRAIN_LANG ?? process.env.LANG ?? process.env.LANGUAGE ?? process.env.LC_ALL ?? '';
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('zh')) return 'zh';
  // Check system locale
  const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
  if (locale.startsWith('en')) return 'en';
  // Default to Chinese — DeepBrain 面向中文用户
  return 'zh';
}

/** Set the current locale */
export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

/** Get the current locale */
export function getLocale(): Locale {
  return currentLocale;
}

/** Translate a message key with optional interpolation */
export function t(key: string, params?: Record<string, string | number>): string {
  const msg = messages[key];
  if (!msg) return key;
  let text = msg[currentLocale] ?? msg.en ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

/** Initialize i18n — call once at startup */
export function initI18n(locale?: Locale): void {
  currentLocale = locale ?? detectLocale();
}
