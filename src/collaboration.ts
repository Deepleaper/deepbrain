/**
 * DeepBrain — Collaborative Brains
 *
 * Share brains between users and merge knowledge.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Brain } from './core/brain.js';

// ── Types ─────────────────────────────────────────────────────────

export type Permission = 'read' | 'write' | 'admin';

export interface SharedUser {
  userId: string;
  permission: Permission;
  sharedAt: string;
}

export interface BrainManifest {
  name: string;
  owner: string;
  shared: SharedUser[];
  createdAt: string;
  description?: string;
}

export interface MergeResult {
  pagesAdded: number;
  pagesUpdated: number;
  linksAdded: number;
  conflicts: string[];
}

// ── Sharing ───────────────────────────────────────────────────────

function getManifestPath(brainDir: string): string {
  return join(brainDir, 'manifest.json');
}

function loadManifest(brainDir: string): BrainManifest {
  const path = getManifestPath(brainDir);
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, 'utf8'));
  }
  return {
    name: 'default',
    owner: 'local',
    shared: [],
    createdAt: new Date().toISOString(),
  };
}

function saveManifest(brainDir: string, manifest: BrainManifest): void {
  writeFileSync(getManifestPath(brainDir), JSON.stringify(manifest, null, 2));
}

/**
 * Share a brain with another user.
 */
export function shareBrain(
  brainDir: string,
  userId: string,
  permission: Permission = 'read',
): BrainManifest {
  const manifest = loadManifest(brainDir);

  // Remove existing share for this user
  manifest.shared = manifest.shared.filter(s => s.userId !== userId);

  manifest.shared.push({
    userId,
    permission,
    sharedAt: new Date().toISOString(),
  });

  saveManifest(brainDir, manifest);
  return manifest;
}

/**
 * Revoke sharing for a user.
 */
export function unshareBrain(brainDir: string, userId: string): BrainManifest {
  const manifest = loadManifest(brainDir);
  manifest.shared = manifest.shared.filter(s => s.userId !== userId);
  saveManifest(brainDir, manifest);
  return manifest;
}

/**
 * List shared users for a brain.
 */
export function listShared(brainDir: string): SharedUser[] {
  return loadManifest(brainDir).shared;
}

/**
 * Check if a user has a specific permission.
 */
export function hasPermission(brainDir: string, userId: string, required: Permission): boolean {
  const manifest = loadManifest(brainDir);
  if (manifest.owner === userId) return true;

  const share = manifest.shared.find(s => s.userId === userId);
  if (!share) return false;

  const levels: Permission[] = ['read', 'write', 'admin'];
  return levels.indexOf(share.permission) >= levels.indexOf(required);
}

// ── Merging ───────────────────────────────────────────────────────

/**
 * Merge knowledge from source brain into target brain.
 * Pages are matched by slug. Conflicts are reported.
 */
export async function mergeBrains(
  sourceBrain: Brain,
  targetBrain: Brain,
  options: { overwrite?: boolean; dryRun?: boolean } = {},
): Promise<MergeResult> {
  const result: MergeResult = {
    pagesAdded: 0,
    pagesUpdated: 0,
    linksAdded: 0,
    conflicts: [],
  };

  const sourcePages = await sourceBrain.list({ limit: 1000 });

  for (const page of sourcePages) {
    const existing = await targetBrain.get(page.slug);

    if (!existing) {
      // New page — add it
      if (!options.dryRun) {
        await targetBrain.put(page.slug, {
          type: page.type,
          title: page.title,
          compiled_truth: page.compiled_truth,
          timeline: page.timeline,
          frontmatter: page.frontmatter as Record<string, unknown>,
          owner: page.owner,
        });
      }
      result.pagesAdded++;
    } else if (options.overwrite) {
      // Existing page — overwrite if option set
      if (!options.dryRun) {
        await targetBrain.put(page.slug, {
          type: page.type,
          title: page.title,
          compiled_truth: page.compiled_truth,
          timeline: page.timeline,
          frontmatter: page.frontmatter as Record<string, unknown>,
          owner: page.owner,
        });
      }
      result.pagesUpdated++;
    } else {
      // Conflict
      result.conflicts.push(`${page.slug}: exists in both brains`);
    }

    // Merge links
    const links = await sourceBrain.getLinks(page.slug);
    for (const link of links) {
      if (!options.dryRun) {
        await targetBrain.link(link.from_slug, link.to_slug, link.context, link.link_type);
      }
      result.linksAdded++;
    }

    // Merge tags
    const tags = await sourceBrain.getTags(page.slug);
    for (const tag of tags) {
      if (!options.dryRun) {
        await targetBrain.tag(page.slug, tag);
      }
    }
  }

  return result;
}

// ── Formatting ────────────────────────────────────────────────────

export function formatMergeResult(result: MergeResult): string {
  const lines: string[] = [];
  lines.push(`\n🔀 Merge Result:`);
  lines.push(`   Pages added:   ${result.pagesAdded}`);
  lines.push(`   Pages updated: ${result.pagesUpdated}`);
  lines.push(`   Links added:   ${result.linksAdded}`);

  if (result.conflicts.length > 0) {
    lines.push(`\n⚠️  Conflicts (${result.conflicts.length}):`);
    for (const c of result.conflicts) {
      lines.push(`   • ${c}`);
    }
    lines.push(`\n   Use --overwrite to replace existing pages.`);
  }

  return lines.join('\n');
}

export function formatSharedList(manifest: BrainManifest): string {
  const lines: string[] = [];
  lines.push(`\n👥 Brain: ${manifest.name}`);
  lines.push(`   Owner: ${manifest.owner}`);

  if (manifest.shared.length === 0) {
    lines.push(`   Not shared with anyone.`);
  } else {
    lines.push(`\n   Shared with:`);
    for (const s of manifest.shared) {
      lines.push(`   • ${s.userId} (${s.permission}) — since ${s.sharedAt.split('T')[0]}`);
    }
  }

  return lines.join('\n');
}
