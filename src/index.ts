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
