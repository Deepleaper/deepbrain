/**
 * DeepBrain — EPUB/PDF Text Importer
 *
 * Import text content from EPUB and PDF files.
 * Supports: .epub (XML-based extraction), .pdf (text extraction via pdfjs-like approach).
 *
 * Usage:
 *   import { importEpub } from 'deepbrain/import';
 *   const pages = await importEpub({ files: ['book.epub'] });
 */

import { readFile } from 'fs/promises';
import { basename, extname } from 'path';
import type { ImportedPage } from './yuque.js';

// ── Types ──────────────────────────────────────────────────────────

export interface EbookImportOptions {
  files: string[];
  /** Split long books into chunks of this many chars (default: 10000) */
  chunkSize?: number;
  onProgress?: (current: number, total: number, file: string) => void;
}

// ── EPUB Extraction (ZIP of XHTML) ────────────────────────────────

async function extractEpubText(filePath: string): Promise<Array<{ title: string; body: string }>> {
  // EPUB is a ZIP file containing XHTML chapters
  try {
    const { execSync } = await import('child_process');
    // Use PowerShell to extract text from EPUB (ZIP)
    const cmd = `powershell -Command "
      Add-Type -AssemblyName System.IO.Compression.FileSystem;
      $$zip = [System.IO.Compression.ZipFile]::OpenRead('${filePath.replace(/'/g, "''")}');
      $$chapters = @();
      foreach ($$entry in $$zip.Entries) {
        if ($$entry.FullName -match '\\.(xhtml|html|htm)$$' -and $$entry.FullName -notmatch 'toc|nav|cover') {
          $$reader = New-Object System.IO.StreamReader($$entry.Open());
          $$xml = $$reader.ReadToEnd();
          $$reader.Close();
          $$text = $$xml -replace '<[^>]+>', ' ' -replace '\\s+', ' ';
          $$text = $$text.Trim();
          if ($$text.Length -gt 50) {
            Write-Output '---CHAPTER_START---';
            Write-Output $$entry.FullName;
            Write-Output $$text;
            Write-Output '---CHAPTER_END---';
          }
        }
      }
      $$zip.Dispose()
    "`;
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 30000, maxBuffer: 50 * 1024 * 1024 });

    const chapters: Array<{ title: string; body: string }> = [];
    const parts = output.split('---CHAPTER_START---').filter(Boolean);

    for (const part of parts) {
      const lines = part.split('\n');
      const endIdx = lines.findIndex(l => l.includes('---CHAPTER_END---'));
      if (endIdx <= 1) continue;

      const name = lines[0]?.trim() ?? 'chapter';
      const body = lines.slice(1, endIdx).join('\n').trim();
      if (body.length > 50) {
        chapters.push({
          title: basename(name, extname(name)),
          body,
        });
      }
    }

    return chapters;
  } catch {
    return [{ title: basename(filePath, '.epub'), body: `[EPUB extraction failed for ${basename(filePath)}]` }];
  }
}

// ── PDF Text Extraction ───────────────────────────────────────────

async function extractPdfText(filePath: string): Promise<string> {
  try {
    const { execSync } = await import('child_process');
    // Try PowerShell with iTextSharp or fallback to basic extraction
    const cmd = `powershell -Command "
      # Try to use .NET to read PDF text (basic approach)
      $$bytes = [System.IO.File]::ReadAllBytes('${filePath.replace(/'/g, "''")}');
      $$text = [System.Text.Encoding]::UTF8.GetString($$bytes);
      # Extract text between stream/endstream or BT/ET markers
      $$matches = [regex]::Matches($$text, '(?<=BT\\s)([\\s\\S]*?)(?=\\sET)');
      $$result = '';
      foreach ($$m in $$matches) {
        $$line = $$m.Value -replace '\\([^)]*\\)', '' -replace '[\\[\\]]', '' -replace 'Tj|TJ|Td|Tm|Tf|T\\*', '';
        $$parens = [regex]::Matches($$m.Value, '\\(([^)]*)\\)');
        foreach ($$p in $$parens) {
          $$result += $$p.Groups[1].Value;
        }
        $$result += ' ';
      }
      Write-Output $$result.Trim()
    "`;
    const text = execSync(cmd, { encoding: 'utf-8', timeout: 30000, maxBuffer: 50 * 1024 * 1024 }).trim();
    return text || `[PDF text extraction yielded no text for ${basename(filePath)}. Consider using a dedicated PDF library.]`;
  } catch {
    return `[PDF extraction failed for ${basename(filePath)}. Install a PDF library for better results.]`;
  }
}

// ── Chunk Long Text ───────────────────────────────────────────────

function chunkText(text: string, size: number): string[] {
  if (text.length <= size) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + size;

    // Try to break at paragraph boundary
    if (end < text.length) {
      const paraBreak = text.lastIndexOf('\n\n', end);
      if (paraBreak > start + size * 0.5) end = paraBreak;
      else {
        const lineBreak = text.lastIndexOf('\n', end);
        if (lineBreak > start + size * 0.5) end = lineBreak;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end;
  }

  return chunks.filter(c => c.length > 0);
}

// ── Slug ──────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\u4e00-\u9fff\u3400-\u4dbf-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'untitled';
}

// ── Main Import ───────────────────────────────────────────────────

export async function importEbook(options: EbookImportOptions): Promise<ImportedPage[]> {
  const { files, chunkSize = 10000, onProgress } = options;
  const pages: ImportedPage[] = [];

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const ext = extname(filePath).toLowerCase();
    const bookName = basename(filePath, ext);

    onProgress?.(i + 1, files.length, basename(filePath));

    if (ext === '.epub') {
      const chapters = await extractEpubText(filePath);
      for (let j = 0; j < chapters.length; j++) {
        const ch = chapters[j];
        const chunks = chunkText(ch.body, chunkSize);

        for (let k = 0; k < chunks.length; k++) {
          const suffix = chunks.length > 1 ? `-part${k + 1}` : '';
          pages.push({
            slug: `${toSlug(bookName)}/${toSlug(ch.title)}${suffix}`,
            title: chunks.length > 1 ? `${ch.title} (Part ${k + 1})` : ch.title,
            body: chunks[k],
            tags: ['book', bookName],
            metadata: {
              source_platform: 'epub',
              book: bookName,
              chapter: String(j + 1),
              ...(chunks.length > 1 ? { part: String(k + 1) } : {}),
            },
            source: filePath,
          });
        }
      }
    } else if (ext === '.pdf') {
      const text = await extractPdfText(filePath);
      const chunks = chunkText(text, chunkSize);

      for (let k = 0; k < chunks.length; k++) {
        const suffix = chunks.length > 1 ? `-part${k + 1}` : '';
        pages.push({
          slug: `${toSlug(bookName)}${suffix}`,
          title: chunks.length > 1 ? `${bookName} (Part ${k + 1})` : bookName,
          body: chunks[k],
          tags: ['book', bookName],
          metadata: {
            source_platform: 'pdf',
            book: bookName,
            ...(chunks.length > 1 ? { part: String(k + 1) } : {}),
          },
          source: filePath,
        });
      }
    }
  }

  return pages;
}
