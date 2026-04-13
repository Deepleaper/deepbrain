/**
 * DeepBrain — Tag Graph
 *
 * Automatically discovers relationships between knowledge through tags.
 * Supports hierarchical tags (#AI/Agent/RAG), co-occurrence analysis,
 * and tag-based knowledge recommendation.
 *
 * Usage:
 *   import { TagGraph } from 'deepbrain/tag-graph';
 *   const tg = new TagGraph(brain);
 *   const related = await tg.recommend('my-page', 5);
 *   const graph = await tg.getGraph();
 */

import type { Brain } from '../core/brain.js';

// ── Types ──────────────────────────────────────────────

export interface TagNode {
  tag: string;
  count: number;          // how many pages have this tag
  parent: string | null;  // hierarchical parent (e.g., 'AI' for 'AI/Agent')
  children: string[];     // direct children
  depth: number;          // hierarchy depth (0 = root)
}

export interface TagEdge {
  source: string;
  target: string;
  weight: number;         // co-occurrence count (pages sharing both tags)
}

export interface TagGraphData {
  nodes: TagNode[];
  edges: TagEdge[];
  stats: {
    totalTags: number;
    totalEdges: number;
    maxDepth: number;
    mostConnected: string | null;
  };
}

export interface TagRecommendation {
  slug: string;
  title: string;
  score: number;          // 0-1, based on tag overlap
  sharedTags: string[];
}

export interface TagCluster {
  name: string;           // cluster label (most frequent tag)
  tags: string[];
  pages: string[];        // slugs
  size: number;
}

export interface TagTreeNode {
  tag: string;
  fullPath: string;
  count: number;
  children: TagTreeNode[];
}

// ── Tag Graph Engine ───────────────────────────────────

export class TagGraph {
  constructor(private brain: Brain) {}

  // ── Hierarchy ──────────────────────────────────

  /**
   * Parse hierarchical tag into segments.
   * "#AI/Agent/RAG" → ["AI", "AI/Agent", "AI/Agent/RAG"]
   */
  parseHierarchy(tag: string): string[] {
    const clean = tag.replace(/^#/, '');
    const parts = clean.split('/');
    const result: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      result.push(parts.slice(0, i + 1).join('/'));
    }
    return result;
  }

  /**
   * Get the parent of a hierarchical tag.
   * "AI/Agent/RAG" → "AI/Agent", "AI" → null
   */
  getParent(tag: string): string | null {
    const idx = tag.lastIndexOf('/');
    return idx === -1 ? null : tag.slice(0, idx);
  }

  /**
   * Expand a tag to include all hierarchy levels.
   * Auto-creates parent tags so the tree is complete.
   */
  async expandHierarchy(slug: string, tag: string): Promise<void> {
    const levels = this.parseHierarchy(tag);
    for (const level of levels) {
      await this.brain.tag(slug, level);
    }
  }

  // ── Co-occurrence ──────────────────────────────

  /**
   * Get all tag co-occurrence pairs with weights.
   * Weight = number of pages that share both tags.
   */
  async getCooccurrence(): Promise<TagEdge[]> {
    const db = (this.brain as any).db;
    const result = await db.query(`
      SELECT a.tag AS source, b.tag AS target, COUNT(*) AS weight
      FROM page_tags a
      JOIN page_tags b ON a.slug = b.slug AND a.tag < b.tag
      GROUP BY a.tag, b.tag
      ORDER BY weight DESC
    `);
    return result.rows.map((r: any) => ({
      source: r.source,
      target: r.target,
      weight: parseInt(r.weight),
    }));
  }

  // ── Full Graph ─────────────────────────────────

  /**
   * Build the complete tag graph: nodes + edges + stats.
   */
  async getGraph(): Promise<TagGraphData> {
    const db = (this.brain as any).db;

    // Get all tags with counts
    const tagRows = await db.query(`
      SELECT tag, COUNT(*) AS count FROM page_tags GROUP BY tag ORDER BY count DESC
    `);

    // Build nodes with hierarchy
    const nodeMap = new Map<string, TagNode>();
    for (const row of tagRows.rows) {
      const parent = this.getParent(row.tag);
      const depth = row.tag.split('/').length - 1;
      nodeMap.set(row.tag, {
        tag: row.tag,
        count: parseInt(row.count),
        parent,
        children: [],
        depth,
      });
    }

    // Fill children arrays
    for (const [tag, node] of nodeMap) {
      if (node.parent && nodeMap.has(node.parent)) {
        nodeMap.get(node.parent)!.children.push(tag);
      }
    }

    const nodes = Array.from(nodeMap.values());
    const edges = await this.getCooccurrence();

    // Stats
    const maxDepth = nodes.reduce((max, n) => Math.max(max, n.depth), 0);
    const connectionCount = new Map<string, number>();
    for (const e of edges) {
      connectionCount.set(e.source, (connectionCount.get(e.source) ?? 0) + e.weight);
      connectionCount.set(e.target, (connectionCount.get(e.target) ?? 0) + e.weight);
    }
    let mostConnected: string | null = null;
    let maxConn = 0;
    for (const [tag, count] of connectionCount) {
      if (count > maxConn) { maxConn = count; mostConnected = tag; }
    }

    return {
      nodes,
      edges,
      stats: {
        totalTags: nodes.length,
        totalEdges: edges.length,
        maxDepth,
        mostConnected,
      },
    };
  }

  // ── Tree View ──────────────────────────────────

  /**
   * Get tags as a hierarchical tree structure.
   */
  async getTree(): Promise<TagTreeNode[]> {
    const db = (this.brain as any).db;
    const tagRows = await db.query(`
      SELECT tag, COUNT(*) AS count FROM page_tags GROUP BY tag ORDER BY tag
    `);

    const flatMap = new Map<string, { count: number }>();
    for (const row of tagRows.rows) {
      flatMap.set(row.tag, { count: parseInt(row.count) });
    }

    // Build tree
    const roots: TagTreeNode[] = [];
    const treeMap = new Map<string, TagTreeNode>();

    const sorted = Array.from(flatMap.keys()).sort();
    for (const tag of sorted) {
      const node: TagTreeNode = {
        tag: tag.split('/').pop()!,
        fullPath: tag,
        count: flatMap.get(tag)!.count,
        children: [],
      };
      treeMap.set(tag, node);

      const parent = this.getParent(tag);
      if (parent && treeMap.has(parent)) {
        treeMap.get(parent)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  // ── Recommendation ─────────────────────────────

  /**
   * Recommend related pages based on tag overlap.
   * Uses Jaccard similarity: |shared tags| / |union tags|
   */
  async recommend(slug: string, limit = 5): Promise<TagRecommendation[]> {
    const db = (this.brain as any).db;
    const myTags = await this.brain.getTags(slug);
    if (myTags.length === 0) return [];

    // Expand hierarchical tags (include parents)
    const expandedTags = new Set<string>();
    for (const t of myTags) {
      for (const level of this.parseHierarchy(t)) {
        expandedTags.add(level);
      }
    }
    const tagArray = Array.from(expandedTags);

    // Find pages sharing any of these tags
    const placeholders = tagArray.map((_, i) => `$${i + 2}`).join(',');
    const result = await db.query(`
      SELECT pt.slug, COUNT(*) AS shared,
             ARRAY_AGG(pt.tag) AS shared_tags
      FROM page_tags pt
      WHERE pt.tag IN (${placeholders})
        AND pt.slug != $1
      GROUP BY pt.slug
      ORDER BY shared DESC
      LIMIT ${limit * 2}
    `, [slug, ...tagArray]);

    // Calculate Jaccard similarity
    const recommendations: TagRecommendation[] = [];
    for (const row of result.rows) {
      const otherTags = await this.brain.getTags(row.slug);
      const otherExpanded = new Set<string>();
      for (const t of otherTags) {
        for (const level of this.parseHierarchy(t)) {
          otherExpanded.add(level);
        }
      }

      const union = new Set([...expandedTags, ...otherExpanded]);
      const intersection = tagArray.filter(t => otherExpanded.has(t));
      const score = union.size > 0 ? intersection.length / union.size : 0;

      // Get page title
      const page = await this.brain.get(row.slug);
      if (!page) continue;

      recommendations.push({
        slug: row.slug,
        title: page.title,
        score,
        sharedTags: intersection,
      });
    }

    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // ── Clustering ─────────────────────────────────

  /**
   * Cluster pages by tag affinity.
   * Groups pages that share the most tags together.
   */
  async cluster(minClusterSize = 2): Promise<TagCluster[]> {
    const db = (this.brain as any).db;

    // Get all tag→slug mappings
    const allTags = await db.query(`
      SELECT tag, ARRAY_AGG(slug) AS slugs
      FROM page_tags
      GROUP BY tag
      HAVING COUNT(*) >= $1
      ORDER BY COUNT(*) DESC
    `, [minClusterSize]);

    const clusters: TagCluster[] = [];
    const assigned = new Set<string>();

    for (const row of allTags.rows) {
      // Skip if all pages already assigned
      const unassigned = row.slugs.filter((s: string) => !assigned.has(s));
      if (unassigned.length < minClusterSize) continue;

      // Find all tags shared by these pages
      const clusterTags = new Set<string>();
      clusterTags.add(row.tag);

      for (const slug of unassigned) {
        const tags = await this.brain.getTags(slug);
        for (const t of tags) clusterTags.add(t);
        assigned.add(slug);
      }

      clusters.push({
        name: row.tag,
        tags: Array.from(clusterTags),
        pages: unassigned,
        size: unassigned.length,
      });
    }

    return clusters;
  }

  // ── Tag Operations ─────────────────────────────

  /**
   * Rename a tag across all pages.
   */
  async renameTag(oldTag: string, newTag: string): Promise<number> {
    const db = (this.brain as any).db;
    const result = await db.query(
      'UPDATE page_tags SET tag = $2 WHERE tag = $1',
      [oldTag, newTag],
    );
    return result.affectedRows ?? 0;
  }

  /**
   * Merge multiple tags into one.
   */
  async mergeTags(sourceTags: string[], targetTag: string): Promise<number> {
    let count = 0;
    const db = (this.brain as any).db;
    for (const src of sourceTags) {
      if (src === targetTag) continue;
      // Get all slugs with source tag
      const rows = await db.query(
        'SELECT slug FROM page_tags WHERE tag = $1', [src],
      );
      for (const row of rows.rows) {
        await this.brain.tag(row.slug, targetTag);
        await this.brain.untag(row.slug, src);
        count++;
      }
    }
    return count;
  }

  /**
   * Find orphan tags (tags with only 1 page).
   */
  async findOrphanTags(): Promise<string[]> {
    const db = (this.brain as any).db;
    const result = await db.query(`
      SELECT tag FROM page_tags GROUP BY tag HAVING COUNT(*) = 1
    `);
    return result.rows.map((r: any) => r.tag);
  }

  /**
   * Auto-tag a page based on content keywords.
   * Returns suggested tags (does not apply them).
   */
  async suggestTags(slug: string, existingTags?: string[]): Promise<string[]> {
    const page = await this.brain.get(slug);
    if (!page) return [];

    const content = page.compiled_truth.toLowerCase();
    const allTags = await this.getAllTags();

    // Score each existing tag by keyword match in content
    const suggestions: Array<{ tag: string; score: number }> = [];
    const currentTags = new Set(existingTags ?? await this.brain.getTags(slug));

    for (const { tag, count } of allTags) {
      if (currentTags.has(tag)) continue;

      // Check if tag words appear in content
      const tagWords = tag.toLowerCase().split(/[\/\-_\s]+/);
      const matchCount = tagWords.filter(w => w.length > 1 && content.includes(w)).length;
      if (matchCount > 0) {
        const score = (matchCount / tagWords.length) * Math.log2(count + 1);
        suggestions.push({ tag, score });
      }
    }

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(s => s.tag);
  }

  /**
   * Get all tags with their page counts.
   */
  async getAllTags(): Promise<Array<{ tag: string; count: number }>> {
    const db = (this.brain as any).db;
    const result = await db.query(`
      SELECT tag, COUNT(*) AS count FROM page_tags GROUP BY tag ORDER BY count DESC
    `);
    return result.rows.map((r: any) => ({ tag: r.tag, count: parseInt(r.count) }));
  }
}
