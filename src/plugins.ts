/**
 * DeepBrain — Plugin System
 *
 * Extensible plugin architecture for importers, exporters,
 * search strategies, and post-processors.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Brain } from './core/brain.js';

// ── Types ─────────────────────────────────────────────────────────

export type PluginType = 'importer' | 'exporter' | 'search' | 'post-processor';

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  type: PluginType;
  entry: string; // Relative path to main module
  config?: Record<string, { type: string; required?: boolean; default?: unknown; description?: string }>;
}

export interface PluginInstance {
  manifest: PluginManifest;
  path: string;
  enabled: boolean;
}

export interface ImporterPlugin {
  import(source: string, options?: Record<string, unknown>): Promise<Array<{ slug: string; title: string; content: string; type?: string }>>;
}

export interface ExporterPlugin {
  export(brain: Brain, options?: Record<string, unknown>): Promise<string | Buffer>;
}

export interface SearchPlugin {
  search(brain: Brain, query: string, options?: Record<string, unknown>): Promise<Array<{ slug: string; score: number; text: string }>>;
}

export interface PostProcessorPlugin {
  process(content: string, metadata?: Record<string, unknown>): Promise<string>;
}

// ── Plugin Registry ───────────────────────────────────────────────

export class PluginRegistry {
  private pluginsDir: string;
  private plugins: Map<string, PluginInstance> = new Map();

  constructor(pluginsDir: string) {
    this.pluginsDir = pluginsDir;
    if (!existsSync(pluginsDir)) {
      mkdirSync(pluginsDir, { recursive: true });
    }
    this.loadAll();
  }

  /**
   * Load all installed plugins from the plugins directory.
   */
  private loadAll(): void {
    if (!existsSync(this.pluginsDir)) return;

    const entries = readdirSync(this.pluginsDir);
    for (const entry of entries) {
      const manifestPath = join(this.pluginsDir, entry, 'plugin.json');
      if (existsSync(manifestPath)) {
        try {
          const manifest: PluginManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
          this.plugins.set(manifest.name, {
            manifest,
            path: join(this.pluginsDir, entry),
            enabled: true,
          });
        } catch {
          // Skip invalid plugins
        }
      }
    }
  }

  /**
   * List all installed plugins.
   */
  list(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  /**
   * List plugins of a specific type.
   */
  listByType(type: PluginType): PluginInstance[] {
    return this.list().filter(p => p.manifest.type === type);
  }

  /**
   * Get a plugin by name.
   */
  get(name: string): PluginInstance | undefined {
    return this.plugins.get(name);
  }

  /**
   * Add a plugin from a directory or manifest.
   */
  add(name: string, manifest: PluginManifest, entryCode: string): void {
    const pluginDir = join(this.pluginsDir, name);
    mkdirSync(pluginDir, { recursive: true });

    writeFileSync(join(pluginDir, 'plugin.json'), JSON.stringify(manifest, null, 2));
    writeFileSync(join(pluginDir, manifest.entry), entryCode);

    this.plugins.set(name, {
      manifest,
      path: pluginDir,
      enabled: true,
    });
  }

  /**
   * Remove a plugin.
   */
  remove(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;

    rmSync(plugin.path, { recursive: true, force: true });
    this.plugins.delete(name);
    return true;
  }

  /**
   * Enable/disable a plugin.
   */
  setEnabled(name: string, enabled: boolean): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    plugin.enabled = enabled;
    return true;
  }

  /**
   * Create a plugin template.
   */
  static createTemplate(name: string, type: PluginType): { manifest: PluginManifest; code: string } {
    const manifest: PluginManifest = {
      name,
      version: '1.0.0',
      description: `${name} plugin for DeepBrain`,
      type,
      entry: 'index.js',
    };

    const templates: Record<PluginType, string> = {
      importer: `// ${name} — Importer Plugin
export async function import(source, options = {}) {
  // Return array of { slug, title, content, type? }
  return [];
}`,
      exporter: `// ${name} — Exporter Plugin
export async function export(brain, options = {}) {
  // Return string or Buffer
  const pages = await brain.list();
  return JSON.stringify(pages, null, 2);
}`,
      search: `// ${name} — Search Plugin
export async function search(brain, query, options = {}) {
  // Return array of { slug, score, text }
  return [];
}`,
      'post-processor': `// ${name} — Post-Processor Plugin
export async function process(content, metadata = {}) {
  // Transform and return content
  return content;
}`,
    };

    return { manifest, code: templates[type] };
  }
}

// ── Formatting ────────────────────────────────────────────────────

export function formatPluginList(plugins: PluginInstance[]): string {
  if (plugins.length === 0) {
    return '\n🔌 No plugins installed.\n\n   Create one: deepbrain plugin add <name> --type importer';
  }

  const lines: string[] = [];
  lines.push(`\n🔌 Installed Plugins (${plugins.length}):\n`);

  const byType = new Map<string, PluginInstance[]>();
  for (const p of plugins) {
    const list = byType.get(p.manifest.type) ?? [];
    list.push(p);
    byType.set(p.manifest.type, list);
  }

  for (const [type, list] of byType) {
    lines.push(`   ${type}:`);
    for (const p of list) {
      const status = p.enabled ? '✅' : '⏸️';
      lines.push(`     ${status} ${p.manifest.name} v${p.manifest.version} — ${p.manifest.description}`);
    }
  }

  return lines.join('\n');
}
