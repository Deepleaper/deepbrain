/**
 * Trace Analyzer (inspired by Trajectory-Informed + M★ papers)
 *
 * Analyzes execution traces to extract learnable insights,
 * feeding them back into the agent brain for continuous improvement.
 */

import type { AgentBrain } from '../agent-brain.js';

export interface SpanData {
  name: string;
  status: 'ok' | 'error' | string;
  duration_ms: number;
  attributes: Record<string, unknown>;
  error?: string;
}

export interface TraceData {
  trace_id?: string;
  spans: SpanData[];
}

export interface LearnableInsight {
  content: string;
  insight_type: 'strategy' | 'recovery' | 'optimization';
  source_trace_id: string;
  confidence: number;
}

/** Duration threshold (ms) for considering a span "slow" */
const SLOW_THRESHOLD_MS = 5000;

export class TraceAnalyzer {
  private slowThreshold: number;

  constructor(slowThreshold: number = SLOW_THRESHOLD_MS) {
    this.slowThreshold = slowThreshold;
  }

  /**
   * Analyze a single trace and extract learnable insights.
   */
  analyzeTrace(trace: TraceData): LearnableInsight[] {
    const traceId = trace.trace_id || `trace-${Date.now()}`;
    const insights: LearnableInsight[] = [];

    for (const span of trace.spans) {
      const isSuccess = span.status === 'ok';
      const isSlow = span.duration_ms >= this.slowThreshold;

      if (!isSuccess && span.error) {
        // Failed spans → recovery tip
        insights.push({
          content: `Recovery tip for "${span.name}": Error encountered — ${span.error}. Consider adding error handling or retry logic.`,
          insight_type: 'recovery',
          source_trace_id: traceId,
          confidence: 0.8,
        });
      } else if (isSuccess && isSlow) {
        // Successful but slow → optimization tip
        insights.push({
          content: `Optimization tip for "${span.name}": Completed successfully but took ${span.duration_ms}ms. Consider caching, batching, or parallelization.`,
          insight_type: 'optimization',
          source_trace_id: traceId,
          confidence: 0.7,
        });
      } else if (isSuccess && !isSlow) {
        // Fast success → strategy tip (only for non-trivial spans)
        if (span.duration_ms > 100) {
          insights.push({
            content: `Strategy tip: "${span.name}" completed efficiently in ${span.duration_ms}ms. This pattern works well.`,
            insight_type: 'strategy',
            source_trace_id: traceId,
            confidence: 0.6,
          });
        }
      }
    }

    return insights;
  }

  /**
   * Batch analyze multiple traces with deduplication.
   */
  batchAnalyze(traces: TraceData[]): LearnableInsight[] {
    const allInsights: LearnableInsight[] = [];
    for (const trace of traces) {
      allInsights.push(...this.analyzeTrace(trace));
    }

    // Deduplicate by content similarity (exact match on span name + type)
    const seen = new Set<string>();
    const deduped: LearnableInsight[] = [];

    for (const insight of allInsights) {
      // Extract span name from content for dedup key
      const nameMatch = insight.content.match(/"([^"]+)"/);
      const key = `${insight.insight_type}:${nameMatch?.[1] || insight.content.slice(0, 50)}`;

      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(insight);
      }
    }

    return deduped;
  }
}

/**
 * Feed traces into an AgentBrain by analyzing them and calling learn() for each insight.
 */
export async function feedTracesToBrain(
  analyzer: TraceAnalyzer,
  agent: AgentBrain,
  traces: TraceData[],
): Promise<LearnableInsight[]> {
  const insights = analyzer.batchAnalyze(traces);

  for (const insight of insights) {
    await agent.learn(
      {
        action: `Trace analysis: ${insight.insight_type}`,
        result: insight.content,
        context: {
          source_trace_id: insight.source_trace_id,
          confidence: insight.confidence,
        },
        insight_type: insight.insight_type,
      },
      { tags: ['trace-insight', insight.insight_type] },
    );
  }

  return insights;
}
