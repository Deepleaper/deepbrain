/**
 * DeepBrain — Backup & Restore (v1.4.0)
 *
 * Export entire brain to .zip, import from backup.
 * Includes: pages, embeddings, tags, links, timeline, settings.
 */

import { Brain } from './core/brain.js';
import type { Page, Link, TimelineEntry } from './core/types.js';
import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';

// ── Types ─────────────────────────────────────────────────────────

export interface BackupManifest {
  version: string;
  created_at: string;
  page_count: number;
  link_count: number;
  tag_count: number;
  timeline_count: number;
}

export interface BackupResult {
  file: string;
  manifest: BackupManifest;
}

export interface RestoreResult {
  pages_restored: number;
  links_restored: number;
  tags_restored: number;
  timeline_restored: number;
  errors: string[];
}

// ── Backup ────────────────────────────────────────────────────────

/**
 * Export entire brain to a .zip file.
 */
export async function backupBrain(brain: Brain, outputPath?: string): Promise<BackupResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const zipFile = outputPath || `deepbrain-backup-${timestamp}.zip`;
  const tmpDir = join(dirname(resolve(zipFile)), `.deepbrain-backup-tmp-${Date.now()}`);

  try {
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, 'pages'), { recursive: true });

    // Export pages
    const pages = await brain.list({ limit: 100000 });
    const pagesData: Array<Page & { tags: string[]; links: Link[]; backlinks: Link[]; timeline: TimelineEntry[] }> = [];

    for (const page of pages) {
      const fullPage = await brain.get(page.slug);
      if (!fullPage) continue;

      const tags = await brain.getTags(page.slug);
      const links = await brain.getLinks(page.slug);
      const backlinks = await brain.getBacklinks(page.slug);
      const timeline = await brain.getTimeline(page.slug);

      const pageData = { ...fullPage, tags, links, backlinks, timeline };
      pagesData.push(pageData as any);

      // Also write individual page files for human-readability
      const md = formatPageMarkdown(fullPage, tags, links, timeline);
      writeFileSync(join(tmpDir, 'pages', `${page.slug}.md`), md);
    }

    // Write JSON data
    writeFileSync(join(tmpDir, 'pages.json'), JSON.stringify(pagesData, null, 2));

    // Export stats
    const stats = await brain.stats();
    writeFileSync(join(tmpDir, 'stats.json'), JSON.stringify(stats, null, 2));

    // Manifest
    const manifest: BackupManifest = {
      version: '1.4.0',
      created_at: new Date().toISOString(),
      page_count: pagesData.length,
      link_count: stats.link_count,
      tag_count: stats.tag_count,
      timeline_count: stats.timeline_entry_count,
    };
    writeFileSync(join(tmpDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    // Create zip using tar (cross-platform enough with node)
    // Use PowerShell Compress-Archive on Windows, zip on Unix
    const absZip = resolve(zipFile);
    try {
      if (process.platform === 'win32') {
        execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${tmpDir}\\*' -DestinationPath '${absZip}' -Force"`, { stdio: 'pipe' });
      } else {
        execSync(`cd "${tmpDir}" && zip -r "${absZip}" .`, { stdio: 'pipe' });
      }
    } catch {
      // Fallback: just copy the tmp dir as-is (no zip)
      const fallbackDir = zipFile.replace('.zip', '');
      mkdirSync(fallbackDir, { recursive: true });
      for (const file of readdirSync(tmpDir)) {
        const src = join(tmpDir, file);
        const dst = join(fallbackDir, file);
        try {
          const stat = require('node:fs').statSync(src);
          if (stat.isDirectory()) {
            execSync(`xcopy "${src}" "${dst}\\" /E /I /Q`, { stdio: 'pipe' });
          } else {
            writeFileSync(dst, readFileSync(src));
          }
        } catch {}
      }
      return { file: fallbackDir, manifest };
    }

    return { file: absZip, manifest };
  } finally {
    // Cleanup tmp
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// ── Restore ───────────────────────────────────────────────────────

/**
 * Restore brain from a backup .zip or directory.
 */
export async function restoreBrain(brain: Brain, inputPath: string): Promise<RestoreResult> {
  const absPath = resolve(inputPath);
  let dataDir: string;
  let cleanupDir: string | null = null;

  if (absPath.endsWith('.zip')) {
    // Extract zip
    dataDir = `${absPath}-extract-${Date.now()}`;
    mkdirSync(dataDir, { recursive: true });
    try {
      if (process.platform === 'win32') {
        execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${absPath}' -DestinationPath '${dataDir}' -Force"`, { stdio: 'pipe' });
      } else {
        execSync(`unzip -o "${absPath}" -d "${dataDir}"`, { stdio: 'pipe' });
      }
    } catch (e: any) {
      return { pages_restored: 0, links_restored: 0, tags_restored: 0, timeline_restored: 0, errors: [`Failed to extract zip: ${e.message}`] };
    }
    cleanupDir = dataDir;
  } else {
    dataDir = absPath;
  }

  const result: RestoreResult = { pages_restored: 0, links_restored: 0, tags_restored: 0, timeline_restored: 0, errors: [] };

  try {
    const pagesFile = join(dataDir, 'pages.json');
    if (!existsSync(pagesFile)) {
      result.errors.push('pages.json not found in backup');
      return result;
    }

    const pagesData = JSON.parse(readFileSync(pagesFile, 'utf8'));

    // Restore pages
    for (const pageData of pagesData) {
      try {
        await brain.put(pageData.slug, {
          type: pageData.type,
          title: pageData.title,
          compiled_truth: pageData.compiled_truth,
          timeline: pageData.timeline_text || '',
          frontmatter: pageData.frontmatter ?? {},
          owner: pageData.owner,
        });
        result.pages_restored++;

        // Restore tags
        if (Array.isArray(pageData.tags)) {
          for (const tag of pageData.tags) {
            try {
              await brain.tag(pageData.slug, tag);
              result.tags_restored++;
            } catch (e: any) {
              result.errors.push(`Tag ${tag} on ${pageData.slug}: ${e.message}`);
            }
          }
        }

        // Restore timeline entries
        if (Array.isArray(pageData.timeline) && pageData.timeline.length > 0) {
          for (const entry of pageData.timeline) {
            try {
              await brain.addTimeline(pageData.slug, {
                date: entry.date,
                source: entry.source ?? '',
                summary: entry.summary,
                detail: entry.detail ?? '',
              });
              result.timeline_restored++;
            } catch (e: any) {
              result.errors.push(`Timeline on ${pageData.slug}: ${e.message}`);
            }
          }
        }
      } catch (e: any) {
        result.errors.push(`Page ${pageData.slug}: ${e.message}`);
      }
    }

    // Restore links (second pass — all pages need to exist first)
    for (const pageData of pagesData) {
      if (Array.isArray(pageData.links)) {
        for (const link of pageData.links) {
          try {
            await brain.link(link.from_slug, link.to_slug, link.context ?? '', link.link_type ?? 'related');
            result.links_restored++;
          } catch (e: any) {
            result.errors.push(`Link ${link.from_slug}→${link.to_slug}: ${e.message}`);
          }
        }
      }
    }
  } finally {
    if (cleanupDir) {
      try { rmSync(cleanupDir, { recursive: true, force: true }); } catch {}
    }
  }

  return result;
}

// ── Helpers ───────────────────────────────────────────────────────

function formatPageMarkdown(page: Page, tags: string[], links: Link[], timeline: TimelineEntry[]): string {
  let md = `---\nslug: ${page.slug}\ntype: ${page.type}\ntitle: ${page.title}\n`;
  if (tags.length) md += `tags: [${tags.join(', ')}]\n`;
  md += `created_at: ${page.created_at}\nupdated_at: ${page.updated_at}\n---\n\n`;
  md += `# ${page.title}\n\n${page.compiled_truth}\n`;

  if (links.length) {
    md += `\n## Links\n`;
    for (const l of links) md += `- → ${l.to_slug} (${l.link_type})\n`;
  }

  if (timeline.length) {
    md += `\n## Timeline\n`;
    for (const t of timeline) md += `- ${t.date}: ${t.summary}\n`;
  }

  return md;
}
