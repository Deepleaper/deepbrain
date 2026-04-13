/**
 * DeepBrain — Import Module
 *
 * Import knowledge from various platforms and formats.
 *
 * Supported sources:
 * - Notion (Markdown, HTML, CSV export)
 * - Obsidian (Markdown vault with [[wikilinks]])
 * - 语雀 Yuque (Markdown, Lakebook export)
 * - 飞书 Feishu/Lark (Markdown, DOCX export)
 * - 石墨 Shimo (Markdown, HTML export)
 * - 微信公众号 WeChat Articles (saved HTML)
 * - EPUB/PDF (text extraction with chunking)
 */

export { importNotion } from './notion.js';
export type { ImportOptions as NotionImportOptions } from './notion.js';

export { importObsidian } from './obsidian.js';
export type { ObsidianImportOptions } from './obsidian.js';

export { importYuque } from './yuque.js';
export type { YuqueImportOptions, ImportedPage } from './yuque.js';

export { importFeishu } from './feishu.js';
export type { FeishuImportOptions } from './feishu.js';

export { importShimo } from './shimo.js';
export type { ShimoImportOptions } from './shimo.js';

export { importWechat } from './wechat.js';
export type { WechatImportOptions } from './wechat.js';

export { importEbook } from './ebook.js';
export type { EbookImportOptions } from './ebook.js';
