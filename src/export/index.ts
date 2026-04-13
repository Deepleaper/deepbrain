/**
 * DeepBrain — Export Module
 *
 * Export knowledge from DeepBrain to various formats.
 * Supports: Markdown, JSON, HTML, Obsidian vault, Logseq graph
 *
 * Usage:
 *   import { exportMarkdown, exportJSON, exportObsidian } from 'deepbrain';
 *   await exportMarkdown(brain, './export');
 *   await exportJSON(brain, './export/brain.json');
 */

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

// ── Types ──────────────────────────────────────────────────────────

export interface ExportOptions {
  /** Output directory or file path */
  output: string;
  /** Filter by tags */
  tags?: string[];
  /** Include timeline entries */
  includeTimeline?: boolean;
  /** Include links/graph */
  includeLinks?: boolean;
  /** Progress callback */
  onProgress?: (current: number, total: number, slug: string) => void;
}

export interface ExportedPage {
  slug: string;
  title: string;
  body: string;
  tags: string[];
  links: string[];
  timeline: Array<{ date: string; content: string }>;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface BrainLike {
  list(): Promise<Array<{ slug: string; title: string; tags: string[]; type: string; created_at: string; updated_at: string }>>;
  get(slug: string): Promise<{ slug: string; title: string; body: string; tags: string[]; type: string; created_at: string; updated_at: string; metadata?: any } | null>;
  getTimeline?(slug: string): Promise<Array<{ date: string; content: string }>>;
  getLinks?(slug: string): Promise<Array<{ from_slug: string; to_slug: string }>>;
}

// ── Helpers ────────────────────────────────────────────────────────

function slugToFilename(slug: string): string {
  return slug.replace(/[<>:"/\\|?*]/g, '_');
}

function pageToMarkdown(page: ExportedPage): string {
  const lines: string[] = [];

  // YAML frontmatter
  lines.push('---');
  lines.push(`title: "${page.title.replace(/"/g, '\\"')}"`);
  lines.push(`slug: ${page.slug}`);
  if (page.tags.length > 0) lines.push(`tags: [${page.tags.map(t => `"${t}"`).join(', ')}]`);
  if (page.links.length > 0) lines.push(`links: [${page.links.map(l => `"${l}"`).join(', ')}]`);
  lines.push(`created: ${page.createdAt}`);
  lines.push(`updated: ${page.updatedAt}`);
  lines.push('---');
  lines.push('');

  // Body
  lines.push(page.body);

  // Timeline
  if (page.timeline.length > 0) {
    lines.push('');
    lines.push('## Timeline');
    lines.push('');
    for (const entry of page.timeline) {
      lines.push(`- **${entry.date}**: ${entry.content}`);
    }
  }

  return lines.join('\n');
}

function pageToObsidian(page: ExportedPage): string {
  let md = pageToMarkdown(page);

  // Convert links to Obsidian [[wikilinks]]
  for (const link of page.links) {
    md = md.replace(new RegExp(`\\[${link}\\]`, 'g'), `[[${link}]]`);
  }

  // Add tags as Obsidian tags
  if (page.tags.length > 0) {
    const tagLine = page.tags.map(t => `#${t}`).join(' ');
    md = md.replace(/^---\n/, `---\n`) + `\n\n${tagLine}\n`;
  }

  return md;
}

function pageToLogseq(page: ExportedPage): string {
  const lines: string[] = [];

  // Logseq properties
  lines.push(`title:: ${page.title}`);
  if (page.tags.length > 0) lines.push(`tags:: ${page.tags.join(', ')}`);
  lines.push(`created:: ${page.createdAt}`);
  lines.push('');

  // Body as bullet points (Logseq format)
  const bodyLines = page.body.split('\n');
  for (const line of bodyLines) {
    if (line.trim() === '') continue;
    if (line.startsWith('#')) {
      lines.push(`- ${line}`);
    } else {
      lines.push(`- ${line}`);
    }
  }

  // Links as page refs
  for (const link of page.links) {
    lines.push(`- Related: [[${link}]]`);
  }

  return lines.join('\n');
}

function pageToHtml(page: ExportedPage): string {
  // Simple markdown → HTML (headers, bold, italic, links, lists)
  let html = page.body;
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${page.title}</title>
<style>body{max-width:800px;margin:40px auto;padding:0 20px;font-family:system-ui;line-height:1.6}
h1,h2,h3{margin-top:1.5em}code{background:#f4f4f4;padding:2px 6px;border-radius:3px}</style>
</head><body>
<h1>${page.title}</h1>
<p><small>Tags: ${page.tags.join(', ')} | Created: ${page.createdAt}</small></p>
${html}
</body></html>`;
}

// ── Fetch all pages ───────────────────────────────────────────────

async function fetchAllPages(brain: BrainLike, options: ExportOptions): Promise<ExportedPage[]> {
  const list = await brain.list();
  const pages: ExportedPage[] = [];

  const filtered = options.tags?.length
    ? list.filter(p => p.tags.some(t => options.tags!.includes(t)))
    : list;

  for (let i = 0; i < filtered.length; i++) {
    const item = filtered[i];
    options.onProgress?.(i + 1, filtered.length, item.slug);

    const page = await brain.get(item.slug);
    if (!page) continue;

    const timeline = (options.includeTimeline && brain.getTimeline)
      ? await brain.getTimeline(item.slug) : [];

    const linksRaw = (options.includeLinks && brain.getLinks)
      ? await brain.getLinks(item.slug) : [];
    const links = linksRaw.map(l => l.from_slug === item.slug ? l.to_slug : l.from_slug);

    pages.push({
      slug: page.slug,
      title: page.title,
      body: page.body,
      tags: page.tags ?? [],
      links,
      timeline,
      metadata: page.metadata ?? {},
      createdAt: page.created_at,
      updatedAt: page.updated_at,
    });
  }

  return pages;
}

// ── Export Functions ───────────────────────────────────────────────

/** Export as individual Markdown files */
export async function exportMarkdown(brain: BrainLike, options: ExportOptions): Promise<number> {
  const pages = await fetchAllPages(brain, { ...options, includeTimeline: true, includeLinks: true });
  await mkdir(options.output, { recursive: true });

  for (const page of pages) {
    const content = pageToMarkdown(page);
    await writeFile(join(options.output, `${slugToFilename(page.slug)}.md`), content, 'utf-8');
  }

  return pages.length;
}

/** Export as single JSON file */
export async function exportJSON(brain: BrainLike, options: ExportOptions): Promise<number> {
  const pages = await fetchAllPages(brain, { ...options, includeTimeline: true, includeLinks: true });

  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    pageCount: pages.length,
    pages,
  };

  await writeFile(options.output, JSON.stringify(data, null, 2), 'utf-8');
  return pages.length;
}

/** Export as HTML files */
export async function exportHTML(brain: BrainLike, options: ExportOptions): Promise<number> {
  const pages = await fetchAllPages(brain, { ...options, includeTimeline: true, includeLinks: true });
  await mkdir(options.output, { recursive: true });

  // Index page
  const indexHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>DeepBrain Export</title>
<style>body{max-width:800px;margin:40px auto;padding:0 20px;font-family:system-ui;line-height:1.6}
a{color:#0066cc;text-decoration:none}a:hover{text-decoration:underline}</style></head><body>
<h1>DeepBrain Knowledge Base</h1><p>${pages.length} pages exported at ${new Date().toISOString()}</p>
<ul>${pages.map(p => `<li><a href="${slugToFilename(p.slug)}.html">${p.title}</a> <small>(${p.tags.join(', ')})</small></li>`).join('\n')}</ul>
</body></html>`;

  await writeFile(join(options.output, 'index.html'), indexHtml, 'utf-8');

  for (const page of pages) {
    await writeFile(join(options.output, `${slugToFilename(page.slug)}.html`), pageToHtml(page), 'utf-8');
  }

  return pages.length;
}

/** Export as Obsidian vault */
export async function exportObsidian(brain: BrainLike, options: ExportOptions): Promise<number> {
  const pages = await fetchAllPages(brain, { ...options, includeTimeline: true, includeLinks: true });
  await mkdir(options.output, { recursive: true });

  for (const page of pages) {
    const content = pageToObsidian(page);
    await writeFile(join(options.output, `${slugToFilename(page.slug)}.md`), content, 'utf-8');
  }

  return pages.length;
}

/** Export as Logseq graph */
export async function exportLogseq(brain: BrainLike, options: ExportOptions): Promise<number> {
  const pages = await fetchAllPages(brain, { ...options, includeTimeline: true, includeLinks: true });
  const pagesDir = join(options.output, 'pages');
  await mkdir(pagesDir, { recursive: true });

  for (const page of pages) {
    const content = pageToLogseq(page);
    await writeFile(join(pagesDir, `${slugToFilename(page.slug)}.md`), content, 'utf-8');
  }

  return pages.length;
}
