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
};

let currentLocale: Locale = 'en';

/** Detect locale from env / system */
export function detectLocale(): Locale {
  const lang = process.env.LANG ?? process.env.LANGUAGE ?? process.env.LC_ALL ?? '';
  if (lang.startsWith('zh')) return 'zh';
  // Check if running on a Chinese system
  const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
  if (locale.startsWith('zh')) return 'zh';
  return 'en';
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
