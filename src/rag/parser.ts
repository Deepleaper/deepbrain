/**
 * DeepBrain — Document Parser
 *
 * Parse various document formats into plain text.
 * Zero external deps — all parsing is regex/string-based.
 */

import { readFileSync } from 'node:fs';
import { extname, basename } from 'node:path';

export interface ParsedDocument {
  content: string;
  metadata: {
    title?: string;
    format: string;
    pages?: number;
    wordCount: number;
  };
}

export class DocumentParser {
  parseMarkdown(content: string): ParsedDocument {
    // Extract title from first heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch?.[1]?.trim();

    // Strip markdown syntax but keep text
    let text = content
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/, '').replace(/```/, ''))
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove images
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      // Convert links to text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove bold/italic markers
      .replace(/(\*{1,3}|_{1,3})([^*_]+)\1/g, '$2')
      // Remove heading markers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}$/gm, '')
      // Remove blockquote markers
      .replace(/^>\s?/gm, '')
      // Clean up extra whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return {
      content: text,
      metadata: {
        title,
        format: 'markdown',
        wordCount: this.countWords(text),
      },
    };
  }

  parsePlainText(content: string): ParsedDocument {
    const text = content.trim();
    const firstLine = text.split('\n')[0]?.trim();
    return {
      content: text,
      metadata: {
        title: firstLine && firstLine.length < 100 ? firstLine : undefined,
        format: 'plaintext',
        wordCount: this.countWords(text),
      },
    };
  }

  parseHTML(content: string): ParsedDocument {
    // Extract title from <title> or <h1>
    const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i)
      ?? content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const title = titleMatch?.[1]?.trim();

    let text = content
      // Remove script and style blocks
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Replace <br> and block elements with newlines
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n')
      .replace(/<(p|div|h[1-6]|li|tr|blockquote)[^>]*>/gi, '\n')
      // Remove remaining tags
      .replace(/<[^>]+>/g, '')
      // Decode common entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      // Clean whitespace
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return {
      content: text,
      metadata: {
        title,
        format: 'html',
        wordCount: this.countWords(text),
      },
    };
  }

  parseCSV(content: string): ParsedDocument {
    const lines = content.trim().split('\n');
    if (lines.length === 0) {
      return { content: '', metadata: { format: 'csv', wordCount: 0 } };
    }

    const headers = this.parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(line => this.parseCSVLine(line));

    // Convert to readable structured text
    const textParts: string[] = [];
    for (const row of rows) {
      const pairs = headers.map((h, i) => `${h}: ${row[i] ?? ''}`).join(', ');
      textParts.push(pairs);
    }

    const text = textParts.join('\n');
    return {
      content: text,
      metadata: {
        format: 'csv',
        wordCount: this.countWords(text),
      },
    };
  }

  parseJSON(content: string): ParsedDocument {
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return this.parsePlainText(content);
    }

    const text = this.flattenJSON(parsed);
    return {
      content: text,
      metadata: {
        format: 'json',
        wordCount: this.countWords(text),
      },
    };
  }

  parse(content: string, format?: string): ParsedDocument {
    const fmt = format ?? this.detectFormat(content);
    switch (fmt) {
      case 'markdown': case 'md': return this.parseMarkdown(content);
      case 'html': return this.parseHTML(content);
      case 'csv': return this.parseCSV(content);
      case 'json': return this.parseJSON(content);
      default: return this.parsePlainText(content);
    }
  }

  parseFile(filePath: string): ParsedDocument {
    const content = readFileSync(filePath, 'utf-8');
    const ext = extname(filePath).toLowerCase().replace('.', '');
    const formatMap: Record<string, string> = {
      md: 'markdown', markdown: 'markdown',
      html: 'html', htm: 'html',
      csv: 'csv',
      json: 'json',
      txt: 'plaintext',
    };
    const format = formatMap[ext] ?? 'plaintext';
    const result = this.parse(content, format);
    if (!result.metadata.title) {
      result.metadata.title = basename(filePath, extname(filePath));
    }
    return result;
  }

  // ── Internal ───────────────────────────────────────────────

  private detectFormat(content: string): string {
    const trimmed = content.trim();
    // JSON
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try { JSON.parse(trimmed); return 'json'; } catch { /* not json */ }
    }
    // HTML
    if (/<(!DOCTYPE|html|head|body|div|p|h[1-6]|span)\b/i.test(trimmed)) return 'html';
    // CSV — check if multiple lines with consistent comma count
    const lines = trimmed.split('\n').slice(0, 5);
    if (lines.length >= 2) {
      const counts = lines.map(l => (l.match(/,/g) || []).length);
      if (counts[0] > 0 && counts.every(c => c === counts[0])) return 'csv';
    }
    // Markdown — check for markdown-specific syntax
    if (/^#{1,6}\s/m.test(trimmed) || /\[.+\]\(.+\)/.test(trimmed) || /^[-*]\s/m.test(trimmed)) return 'markdown';
    return 'plaintext';
  }

  private countWords(text: string): number {
    // Count both English words and CJK characters
    const englishWords = text.match(/[a-zA-Z0-9]+/g)?.length ?? 0;
    const cjkChars = text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g)?.length ?? 0;
    return englishWords + cjkChars;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  private flattenJSON(obj: any, prefix: string = ''): string {
    if (obj === null || obj === undefined) return '';
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    if (Array.isArray(obj)) {
      return obj.map((item, i) => this.flattenJSON(item, `${prefix}[${i}]`)).join('\n');
    }
    if (typeof obj === 'object') {
      return Object.entries(obj)
        .map(([k, v]) => {
          const key = prefix ? `${prefix}.${k}` : k;
          const val = this.flattenJSON(v, key);
          if (typeof v === 'object' && v !== null) return val;
          return `${key}: ${val}`;
        })
        .join('\n');
    }
    return String(obj);
  }
}
