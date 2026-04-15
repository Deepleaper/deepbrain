/**
 * DeepBrain — Knowledge Graph
 *
 * Auto-extract entities and relationships from pages.
 * Build a graph of connected concepts.
 */

import type { Brain } from './core/brain.js';
import { createChat } from 'agentkits';
import type { ChatMessage } from 'agentkits';

// ── Types ─────────────────────────────────────────────────────────

export interface Entity {
  name: string;
  type: string;  // person, organization, concept, technology, place, event, etc.
  slug?: string; // linked page slug if exists
  mentions: number;
}

export interface Relationship {
  from: string;
  to: string;
  type: string;  // relates_to, part_of, created_by, uses, etc.
  context: string;
  weight: number;
}

export interface KnowledgeGraph {
  entities: Entity[];
  relationships: Relationship[];
  clusters: EntityCluster[];
}

export interface EntityCluster {
  name: string;
  entities: string[];
  centralEntity: string;
}

export interface GraphQueryResult {
  entity: Entity;
  related: Array<{ entity: Entity; relationship: Relationship }>;
  paths: string[][];
}

// ── Entity Extraction ─────────────────────────────────────────────

/**
 * Extract entities and relationships from text using LLM.
 */
export async function extractEntities(
  text: string,
  config: { provider?: string; model?: string; apiKey?: string },
): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
  const chat = createChat({
    provider: (config.provider ?? 'ollama') as any,
    model: config.model,
    apiKey: config.apiKey,
  });

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `Extract entities and relationships from the text. Return ONLY valid JSON:
{
  "entities": [{"name": "Entity Name", "type": "person|org|concept|tech|place|event"}],
  "relationships": [{"from": "Entity A", "to": "Entity B", "type": "relates_to|part_of|created_by|uses|competes_with", "context": "brief context"}]
}
Be thorough but precise. Merge duplicates. Use consistent naming.`,
    },
    { role: 'user', content: text.slice(0, 4000) },
  ];

  try {
    const response = await chat.chat(messages, { maxTokens: 1000 });
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        entities: (parsed.entities ?? []).map((e: any) => ({ ...e, mentions: 1 })),
        relationships: (parsed.relationships ?? []).map((r: any) => ({ ...r, weight: 1 })),
      };
    }
  } catch {
    // Fall back to simple extraction
  }
  return simpleExtract(text);
}

/**
 * Simple regex-based entity extraction (fallback when LLM unavailable).
 */
function simpleExtract(text: string): { entities: Entity[]; relationships: Relationship[] } {
  const entities: Entity[] = [];
  const seen = new Set<string>();

  // Extract capitalized phrases (potential entities)
  const caps = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) ?? [];
  for (const cap of caps) {
    const name = cap.trim();
    if (!seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      entities.push({ name, type: 'concept', mentions: 1 });
    }
  }

  // Extract quoted terms
  const quoted = text.match(/"([^"]+)"/g) ?? [];
  for (const q of quoted) {
    const name = q.replace(/"/g, '').trim();
    if (name.length > 2 && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      entities.push({ name, type: 'concept', mentions: 1 });
    }
  }

  // Extract CJK terms (Chinese proper nouns are harder, just extract bracketed)
  const cjk = text.match(/《([^》]+)》/g) ?? [];
  for (const c of cjk) {
    const name = c.replace(/[《》]/g, '');
    if (!seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      entities.push({ name, type: 'concept', mentions: 1 });
    }
  }

  return { entities, relationships: [] };
}

// ── Graph Building ────────────────────────────────────────────────

/**
 * Build a full knowledge graph from all pages in the brain.
 */
export async function buildKnowledgeGraph(
  brain: Brain,
  config: { provider?: string; model?: string; apiKey?: string },
): Promise<KnowledgeGraph> {
  const pages = await brain.list({ limit: 500 });
  const allEntities = new Map<string, Entity>();
  const allRelationships: Relationship[] = [];

  for (const page of pages) {
    const text = `${page.title}\n${page.compiled_truth}`;
    const { entities, relationships } = await extractEntities(text, config);

    for (const entity of entities) {
      const key = entity.name.toLowerCase();
      if (allEntities.has(key)) {
        const existing = allEntities.get(key)!;
        existing.mentions += entity.mentions;
      } else {
        entity.slug = page.slug;
        allEntities.set(key, entity);
      }
    }

    for (const rel of relationships) {
      // Check for duplicate relationships
      const existing = allRelationships.find(
        r => r.from.toLowerCase() === rel.from.toLowerCase() && r.to.toLowerCase() === rel.to.toLowerCase() && r.type === rel.type,
      );
      if (existing) {
        existing.weight++;
      } else {
        allRelationships.push(rel);
      }
    }
  }

  // Also include existing links as relationships
  for (const page of pages) {
    const links = await brain.getLinks(page.slug);
    for (const link of links) {
      allRelationships.push({
        from: page.title || page.slug,
        to: link.to_slug,
        type: link.link_type || 'related',
        context: link.context || '',
        weight: 2, // Explicit links get higher weight
      });
    }
  }

  const entities = Array.from(allEntities.values()).sort((a, b) => b.mentions - a.mentions);
  const clusters = buildClusters(entities, allRelationships);

  return { entities, relationships: allRelationships, clusters };
}

/**
 * Simple clustering based on connected components.
 */
function buildClusters(entities: Entity[], relationships: Relationship[]): EntityCluster[] {
  const adjacency = new Map<string, Set<string>>();

  for (const entity of entities) {
    adjacency.set(entity.name.toLowerCase(), new Set());
  }

  for (const rel of relationships) {
    const from = rel.from.toLowerCase();
    const to = rel.to.toLowerCase();
    if (adjacency.has(from)) adjacency.get(from)!.add(to);
    if (adjacency.has(to)) adjacency.get(to)!.add(from);
  }

  const visited = new Set<string>();
  const clusters: EntityCluster[] = [];

  for (const entity of entities) {
    const key = entity.name.toLowerCase();
    if (visited.has(key)) continue;

    const cluster: string[] = [];
    const queue = [key];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      cluster.push(current);
      const neighbors = adjacency.get(current) ?? new Set();
      for (const n of neighbors) {
        if (!visited.has(n)) queue.push(n);
      }
    }

    if (cluster.length > 1) {
      // Find central entity (most connections)
      let maxConns = 0;
      let central = cluster[0];
      for (const c of cluster) {
        const conns = (adjacency.get(c) ?? new Set()).size;
        if (conns > maxConns) { maxConns = conns; central = c; }
      }

      // Find original-case names
      const nameMap = new Map(entities.map(e => [e.name.toLowerCase(), e.name]));
      clusters.push({
        name: nameMap.get(central) ?? central,
        entities: cluster.map(c => nameMap.get(c) ?? c),
        centralEntity: nameMap.get(central) ?? central,
      });
    }
  }

  return clusters.sort((a, b) => b.entities.length - a.entities.length);
}

/**
 * Query the knowledge graph for an entity and its relationships.
 */
export async function queryGraph(
  brain: Brain,
  entityQuery: string,
  config: { provider?: string; model?: string; apiKey?: string },
): Promise<GraphQueryResult | null> {
  const graph = await buildKnowledgeGraph(brain, config);
  const queryLower = entityQuery.toLowerCase();

  // Find matching entity
  const entity = graph.entities.find(e => e.name.toLowerCase().includes(queryLower));
  if (!entity) return null;

  // Find related entities
  const related: Array<{ entity: Entity; relationship: Relationship }> = [];
  for (const rel of graph.relationships) {
    if (rel.from.toLowerCase().includes(queryLower)) {
      const relEntity = graph.entities.find(e => e.name.toLowerCase() === rel.to.toLowerCase());
      if (relEntity) related.push({ entity: relEntity, relationship: rel });
    }
    if (rel.to.toLowerCase().includes(queryLower)) {
      const relEntity = graph.entities.find(e => e.name.toLowerCase() === rel.from.toLowerCase());
      if (relEntity) related.push({ entity: relEntity, relationship: { ...rel, from: rel.to, to: rel.from } });
    }
  }

  return { entity, related, paths: [] };
}

// ── Visualization ─────────────────────────────────────────────────

/**
 * Format knowledge graph for terminal display.
 */
export function formatGraph(graph: KnowledgeGraph): string {
  const lines: string[] = [];

  lines.push('🕸️  Knowledge Graph\n');
  lines.push(`   Entities: ${graph.entities.length}`);
  lines.push(`   Relationships: ${graph.relationships.length}`);
  lines.push(`   Clusters: ${graph.clusters.length}\n`);

  // Top entities
  lines.push('📌 Top Entities:');
  for (const entity of graph.entities.slice(0, 20)) {
    const typeEmoji = {
      person: '👤', organization: '🏢', org: '🏢',
      concept: '💡', technology: '🔧', tech: '🔧',
      place: '📍', event: '📅',
    }[entity.type] ?? '•';
    lines.push(`   ${typeEmoji} ${entity.name} (${entity.type}, ${entity.mentions} mentions)`);
  }

  // Clusters
  if (graph.clusters.length > 0) {
    lines.push('\n🔮 Knowledge Clusters:');
    for (const cluster of graph.clusters.slice(0, 10)) {
      lines.push(`   ⭐ ${cluster.name}: ${cluster.entities.join(', ')}`);
    }
  }

  // Key relationships
  if (graph.relationships.length > 0) {
    lines.push('\n🔗 Key Relationships:');
    const sorted = [...graph.relationships].sort((a, b) => b.weight - a.weight);
    for (const rel of sorted.slice(0, 15)) {
      lines.push(`   ${rel.from} —[${rel.type}]→ ${rel.to}${rel.context ? ` (${rel.context})` : ''}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a graph query result for terminal display.
 */
export function formatQueryResult(result: GraphQueryResult): string {
  const lines: string[] = [];

  lines.push(`\n🔍 Entity: ${result.entity.name} (${result.entity.type})`);
  lines.push(`   Mentions: ${result.entity.mentions}`);
  if (result.entity.slug) lines.push(`   Page: ${result.entity.slug}`);

  if (result.related.length > 0) {
    lines.push(`\n🔗 Related (${result.related.length}):`);
    for (const r of result.related) {
      lines.push(`   → ${r.entity.name} (${r.relationship.type})${r.relationship.context ? ` — ${r.relationship.context}` : ''}`);
    }
  } else {
    lines.push('\n   No relationships found.');
  }

  return lines.join('\n');
}
