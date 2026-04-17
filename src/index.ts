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

// Tag Graph
export { TagGraph } from './tag-graph/index.js';
export type {
  TagNode, TagEdge, TagGraphData,
  TagRecommendation, TagCluster, TagTreeNode,
} from './tag-graph/index.js';

// Memory Operations DSL
export { parseOp, executeOp } from './operations.js';
export type { OpType, MemoryOp, OpResult } from './operations.js';

// Proactive Memory Injection
export { injectMemories, formatInjection } from './proactive.js';
export type { InjectionConfig, InjectedMemory, InjectionResult } from './proactive.js';

// Memory Tiers
export { getByTier, getTierStats, setTier, runTierCycle, getCoreContext, recordAccess } from './memory-tiers.js';
export type { MemoryTier, TierConfig, TierStats } from './memory-tiers.js';

// Temporal Tracking
export { storeWithTemporal, queryAsOf, getKnowledgeEvolution, formatTimeline } from './temporal.js';
export type { TemporalMetadata, TemporalSnapshot, KnowledgeEvolution } from './temporal.js';

// Memory Compression
export { compressText, compressPage, runCompression, getFullVersion } from './compression.js';
export type { CompressionConfig, CompressionResult } from './compression.js';

// Knowledge Graph
export { extractEntities, buildKnowledgeGraph, queryGraph, formatGraph, formatQueryResult } from './knowledge-graph.js';
export type { Entity, Relationship, KnowledgeGraph, EntityCluster, GraphQueryResult } from './knowledge-graph.js';

// Smart Digest
export { generateDigest, formatDigest } from './digest.js';
export type { DigestConfig, Digest, DigestEntry, DigestConnection } from './digest.js';

// Collaborative Brains
export { shareBrain, unshareBrain, listShared, hasPermission, mergeBrains, formatMergeResult, formatSharedList } from './collaboration.js';
export type { Permission, SharedUser, BrainManifest, MergeResult } from './collaboration.js';

// API Server
export { startServer } from './server.js';
export type { ServerConfig } from './server.js';

// Plugin System
export { PluginRegistry, formatPluginList } from './plugins.js';
export type { PluginManifest, PluginInstance, PluginType, ImporterPlugin, ExporterPlugin, SearchPlugin, PostProcessorPlugin } from './plugins.js';

// Advanced Search
export { advancedSearch, formatAdvancedResults } from './search-advanced.js';
export type { AdvancedSearchOpts, SearchSuggestion, FacetedResults } from './search-advanced.js';

// i18n
export { initI18n, setLocale, getLocale, detectLocale, t } from './i18n.js';
export type { Locale } from './i18n.js';

// Webhooks
export { fireWebhook, loadWebhookConfig, defaultWebhookConfig } from './webhooks.js';
export type { WebhookEvent, WebhookConfig, WebhookPayload } from './webhooks.js';

// Auto-Tagging
export { generateTags, autoTagPage, retagAll, loadAutoTagConfig } from './auto-tag.js';
export type { AutoTagConfig, AutoTagResult } from './auto-tag.js';

// Flashcards (v1.3)
export { generateFlashcards, getDueCards, reviewCard, getFlashcardStats, sm2, loadDeck, saveDeck } from './flashcards.js';
export type { Flashcard, FlashcardDeck, FlashcardStats, ReviewGrade, GenerateOpts } from './flashcards.js';

// Digest Email (v1.3)
export { generateDigestEmail } from './digest-email.js';
export type { DigestEmailConfig, DigestResult } from './digest-email.js';

// Multi-Brain Chat (v1.3)
export { chatWithBrain, chatWithBrains } from './commands/chat.js';
export type { ChatOptions, MultiBrainChatOptions } from './commands/chat.js';

// Backup & Restore (v1.4)
export { backupBrain, restoreBrain } from './backup.js';
export type { BackupManifest, BackupResult, RestoreResult } from './backup.js';

// Agent Brain API (v1.6)
export { AgentBrain } from './agent-brain.js';
export type { Trace, LearnOptions, RecallOptions, EvolveOptions, EvolveReport } from './agent-brain.js';

// Memory Adapters (v1.6)
export { OpenClawAdapter, NativeAdapter, adapters } from './adapters/index.js';
export type { MemoryAdapter } from './adapters/index.js';

// Brain Templates (v1.4)
export { applyTemplate, listTemplates, TEMPLATES } from './templates.js';
export type { BrainTemplate } from './templates.js';

// API Client SDK (v1.4)
export { DeepBrainClient } from './sdk.js';
export type { DeepBrainClientConfig, SDKPage, SDKSearchResult, SDKChatResponse, SDKStats } from './sdk.js';
