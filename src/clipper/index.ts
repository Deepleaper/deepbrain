/**
 * DeepBrain — Browser Clipper
 *
 * Clip web pages to DeepBrain from any browser.
 * Works as a bookmarklet or browser extension content script.
 *
 * Usage (bookmarklet):
 *   javascript:(function(){...clipToDeepBrain()...})()
 *
 * Usage (extension):
 *   import { clipPage, clipSelection } from 'deepbrain/clipper';
 */

export interface ClipResult {
  title: string;
  url: string;
  body: string;
  tags: string[];
  selectedText?: string;
  metadata: {
    source_platform: 'web-clipper';
    source_url: string;
    clipped_at: string;
    author?: string;
    description?: string;
    image?: string;
  };
}

/** Extract readable content from current page DOM */
export function clipPage(doc: Document = document): ClipResult {
  const title = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')
    ?? doc.title ?? 'Untitled';

  const author = doc.querySelector('meta[name="author"]')?.getAttribute('content')
    ?? doc.querySelector('meta[property="article:author"]')?.getAttribute('content')
    ?? undefined;

  const description = doc.querySelector('meta[name="description"]')?.getAttribute('content')
    ?? doc.querySelector('meta[property="og:description"]')?.getAttribute('content')
    ?? undefined;

  const image = doc.querySelector('meta[property="og:image"]')?.getAttribute('content')
    ?? undefined;

  // Find main content area
  const article = doc.querySelector('article')
    ?? doc.querySelector('[role="main"]')
    ?? doc.querySelector('main')
    ?? doc.querySelector('.post-content, .article-content, .entry-content, .content')
    ?? doc.body;

  const body = htmlToMarkdown(article);

  // Extract tags from meta keywords
  const keywordsMeta = doc.querySelector('meta[name="keywords"]')?.getAttribute('content');
  const tags = keywordsMeta ? keywordsMeta.split(',').map(t => t.trim()).filter(Boolean) : [];

  return {
    title,
    url: doc.location?.href ?? '',
    body,
    tags,
    metadata: {
      source_platform: 'web-clipper',
      source_url: doc.location?.href ?? '',
      clipped_at: new Date().toISOString(),
      author,
      description,
      image,
    },
  };
}

/** Clip selected text only */
export function clipSelection(doc: Document = document): ClipResult {
  const selection = doc.getSelection?.()?.toString() ?? '';
  const result = clipPage(doc);
  result.body = selection || result.body;
  result.selectedText = selection;
  return result;
}

/** Convert HTML element to Markdown */
function htmlToMarkdown(el: Element): string {
  const lines: string[] = [];

  function walk(node: Node) {
    if (node.nodeType === 3) { // Text
      const text = (node as Text).textContent ?? '';
      if (text.trim()) lines.push(text);
      return;
    }

    if (node.nodeType !== 1) return;
    const elem = node as Element;
    const tag = elem.tagName.toLowerCase();

    // Skip non-content
    if (['script', 'style', 'nav', 'footer', 'aside', 'iframe', 'noscript'].includes(tag)) return;

    switch (tag) {
      case 'h1': lines.push(`\n# ${elem.textContent?.trim()}\n`); return;
      case 'h2': lines.push(`\n## ${elem.textContent?.trim()}\n`); return;
      case 'h3': lines.push(`\n### ${elem.textContent?.trim()}\n`); return;
      case 'h4': lines.push(`\n#### ${elem.textContent?.trim()}\n`); return;
      case 'p': lines.push(`\n${elem.textContent?.trim()}\n`); return;
      case 'br': lines.push('\n'); return;
      case 'hr': lines.push('\n---\n'); return;
      case 'blockquote':
        lines.push(`\n> ${elem.textContent?.trim()}\n`); return;
      case 'pre':
      case 'code':
        if (tag === 'pre') lines.push(`\n\`\`\`\n${elem.textContent}\n\`\`\`\n`);
        else lines.push(`\`${elem.textContent}\``);
        return;
      case 'a': {
        const href = elem.getAttribute('href');
        lines.push(`[${elem.textContent?.trim()}](${href})`);
        return;
      }
      case 'img': {
        const src = elem.getAttribute('src') ?? elem.getAttribute('data-src');
        const alt = elem.getAttribute('alt') ?? '';
        if (src) lines.push(`\n![${alt}](${src})\n`);
        return;
      }
      case 'li': lines.push(`\n- ${elem.textContent?.trim()}`); return;
      case 'strong':
      case 'b': lines.push(`**${elem.textContent?.trim()}**`); return;
      case 'em':
      case 'i': lines.push(`*${elem.textContent?.trim()}*`); return;
      default:
        for (const child of Array.from(node.childNodes)) walk(child);
    }
  }

  walk(el);
  return lines.join('').replace(/\n{3,}/g, '\n\n').trim();
}

/** Generate bookmarklet code that sends clip to DeepBrain API */
export function generateBookmarklet(apiUrl: string): string {
  return `javascript:(function(){var d=document,t=d.title,u=d.location.href,s=d.getSelection().toString()||'',b=d.querySelector('article,main,.content,[role=main]');var m=b?b.innerText:d.body.innerText;fetch('${apiUrl}/api/clip',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:t,url:u,body:s||m.slice(0,5000),tags:[]})}).then(function(r){return r.json()}).then(function(j){alert('Saved to DeepBrain: '+j.slug)}).catch(function(e){alert('Error: '+e.message)})})()`;
}
