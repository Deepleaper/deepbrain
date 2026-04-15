/**
 * DeepBrain - GitHub Importer
 *
 * Import knowledge from GitHub repos (README, docs/, wiki)
 * and starred repos as knowledge pages.
 *
 * CLI:
 *   deepbrain import github --repo owner/repo
 *   deepbrain import github-stars --user <username>
 */

import type { Brain } from '../core/brain.js';

export interface GitHubImportOptions {
  /** GitHub personal access token (optional, for private repos / higher rate limits) */
  token?: string;
  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface GitHubRepoImportOptions extends GitHubImportOptions {
  /** Repository in owner/repo format */
  repo: string;
  /** Import README (default: true) */
  readme?: boolean;
  /** Import docs/ directory (default: true) */
  docs?: boolean;
  /** Import wiki (default: true) */
  wiki?: boolean;
  /** Slug prefix (default: 'github/') */
  prefix?: string;
}

export interface GitHubStarsImportOptions extends GitHubImportOptions {
  /** GitHub username */
  user: string;
  /** Max stars to import (default: 100) */
  limit?: number;
  /** Slug prefix (default: 'github-stars/') */
  prefix?: string;
}

export interface GitHubImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

async function ghFetch(url: string, token?: string): Promise<any> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'DeepBrain/1.5.0',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

async function ghFetchRaw(url: string, token?: string): Promise<string | null> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3.raw',
    'User-Agent': 'DeepBrain/1.5.0',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  return res.text();
}

/**
 * Import a GitHub repo's README, docs/, and wiki into DeepBrain.
 */
export async function importGitHubRepo(
  brain: Brain,
  options: GitHubRepoImportOptions,
): Promise<GitHubImportResult> {
  const { repo, token, prefix = 'github/', readme = true, docs = true, wiki = true } = options;
  const log = options.onProgress ?? (() => {});
  const result: GitHubImportResult = { imported: 0, skipped: 0, errors: [] };
  const [owner, name] = repo.split('/');
  if (!owner || !name) throw new Error(`Invalid repo format: ${repo}. Use owner/repo.`);

  const baseSlug = `${prefix}${owner}-${name}`;

  // 1. Import README
  if (readme) {
    log(`Fetching README for ${repo}...`);
    const readmeContent = await ghFetchRaw(
      `https://api.github.com/repos/${repo}/readme`,
      token,
    );
    if (readmeContent) {
      // Also fetch repo metadata
      const repoData = await ghFetch(`https://api.github.com/repos/${repo}`, token);
      const meta = repoData ? `⭐ ${repoData.stargazers_count} | 🍴 ${repoData.forks_count} | ${repoData.language ?? 'Unknown'}\n${repoData.description ?? ''}\n\n` : '';
      await brain.put(`${baseSlug}-readme`, {
        type: 'reference',
        title: `${repo} - README`,
        compiled_truth: meta + readmeContent,
        frontmatter: { source: 'github', repo, import_type: 'readme' },
      });
      log(`  ✅ README imported`);
      result.imported++;
    } else {
      log(`  ⏭️  No README found`);
      result.skipped++;
    }
  }

  // 2. Import docs/ directory
  if (docs) {
    log(`Fetching docs/ for ${repo}...`);
    const docsTree = await ghFetch(
      `https://api.github.com/repos/${repo}/contents/docs`,
      token,
    );
    if (Array.isArray(docsTree)) {
      for (const file of docsTree) {
        if (file.type !== 'file' || (!file.name.endsWith('.md') && !file.name.endsWith('.txt'))) continue;
        try {
          const content = await ghFetchRaw(file.download_url, token);
          if (!content) { result.skipped++; continue; }
          const slug = `${baseSlug}-docs-${file.name.replace(/\.\w+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
          await brain.put(slug, {
            type: 'reference',
            title: `${repo}/docs/${file.name}`,
            compiled_truth: content,
            frontmatter: { source: 'github', repo, path: `docs/${file.name}` },
          });
          log(`  ✅ docs/${file.name}`);
          result.imported++;
        } catch (e: any) {
          result.errors.push(`docs/${file.name}: ${e.message}`);
        }
      }
    } else {
      log(`  ⏭️  No docs/ directory`);
    }
  }

  // 3. Import wiki
  if (wiki) {
    log(`Fetching wiki for ${repo}...`);
    // GitHub wiki API: list wiki pages via the repo's wiki git
    // The REST API doesn't directly expose wiki content, so we try the common pattern
    const wikiPages = await ghFetch(
      `https://api.github.com/repos/${repo}/contents/wiki`,
      token,
    );
    // Wiki is typically a separate git repo; try fetching Home page
    const wikiHome = await ghFetchRaw(
      `https://raw.githubusercontent.com/wiki/${repo}/Home.md`,
      token,
    );
    if (wikiHome) {
      await brain.put(`${baseSlug}-wiki-home`, {
        type: 'reference',
        title: `${repo} - Wiki Home`,
        compiled_truth: wikiHome,
        frontmatter: { source: 'github-wiki', repo },
      });
      log(`  ✅ Wiki Home imported`);
      result.imported++;
    } else {
      log(`  ⏭️  No wiki found`);
      result.skipped++;
    }
  }

  return result;
}

/**
 * Import GitHub starred repos as knowledge pages.
 */
export async function importGitHubStars(
  brain: Brain,
  options: GitHubStarsImportOptions,
): Promise<GitHubImportResult> {
  const { user, token, limit = 100, prefix = 'github-stars/' } = options;
  const log = options.onProgress ?? (() => {});
  const result: GitHubImportResult = { imported: 0, skipped: 0, errors: [] };

  log(`Fetching starred repos for ${user}...`);

  let page = 1;
  const perPage = Math.min(limit, 100);
  let total = 0;

  while (total < limit) {
    const stars = await ghFetch(
      `https://api.github.com/users/${user}/starred?per_page=${perPage}&page=${page}`,
      token,
    );
    if (!Array.isArray(stars) || stars.length === 0) break;

    for (const repo of stars) {
      if (total >= limit) break;
      try {
        const slug = `${prefix}${repo.full_name.replace(/\//g, '-').toLowerCase()}`;
        const content = [
          `# ${repo.full_name}`,
          '',
          repo.description ?? '_No description_',
          '',
          `- **Language:** ${repo.language ?? 'Unknown'}`,
          `- **Stars:** ${repo.stargazers_count}`,
          `- **Forks:** ${repo.forks_count}`,
          `- **Topics:** ${(repo.topics ?? []).join(', ') || 'none'}`,
          `- **URL:** ${repo.html_url}`,
          `- **Created:** ${repo.created_at}`,
          `- **Updated:** ${repo.updated_at}`,
          '',
        ].join('\n');

        // Try to fetch README for richer content
        const readmeContent = await ghFetchRaw(
          `https://api.github.com/repos/${repo.full_name}/readme`,
          token,
        ).catch(() => null);

        const fullContent = readmeContent
          ? content + '---\n\n' + readmeContent.slice(0, 5000)
          : content;

        await brain.put(slug, {
          type: 'reference',
          title: repo.full_name,
          compiled_truth: fullContent,
          frontmatter: {
            source: 'github-stars',
            repo: repo.full_name,
            stars: repo.stargazers_count,
            language: repo.language,
            topics: repo.topics,
          },
        });
        log(`  ⭐ ${repo.full_name} (${repo.stargazers_count}★)`);
        result.imported++;
        total++;
      } catch (e: any) {
        result.errors.push(`${repo.full_name}: ${e.message}`);
        total++;
      }
    }
    page++;
  }

  log(`\nDone: ${result.imported} starred repos imported.`);
  return result;
}
