/**
 * DeepBrain — Main Entry
 */

export { Brain } from './core/brain.js';
export type {
  Page, PageInput, PageFilters,
  Chunk, ChunkInput,
  SearchResult, SearchOpts,
  Link, GraphNode,
  TimelineEntry, TimelineInput, TimelineOpts,
  BrainStats, BrainHealth,
  DeepBrainConfig,
} from './core/types.js';
export { DEFAULT_CONFIG } from './core/types.js';
export { dream } from './dream/index.js';
export type { DreamReport, DreamConfig } from './dream/index.js';

// Import (all 21 sources)
export * from './import/index.js';

// Export (5 formats)
export { exportMarkdown, exportJSON, exportHTML, exportObsidian, exportLogseq } from './export/index.js';
export type { ExportOptions, ExportedPage, BrainLike } from './export/index.js';

// Web UI
export { startWebUI } from './web/index.js';
export type { WebUIConfig } from './web/index.js';

// Browser Clipper
export { clipPage, clipSelection, generateBookmarklet } from './clipper/index.js';
export type { ClipResult } from './clipper/index.js';
