/**
 * Memory Adapters — Bridge between Agent frameworks and DeepBrain.
 *
 * Each adapter translates a framework's memory format to DeepBrain's learn/recall/evolve API.
 * Phase 1: Stub interfaces. Phase 2: Full implementations.
 */

export interface MemoryAdapter {
  name: string;
  /** Convert framework-native memory to DeepBrain learn() input */
  toTrace(nativeMemory: unknown): { action: string; result: string; context?: Record<string, unknown> };
  /** Convert DeepBrain recall() output to framework-native format */
  fromRecall(results: unknown[]): unknown[];
}

export class OpenClawAdapter implements MemoryAdapter {
  name = 'openclaw';
  toTrace(memory: unknown) {
    // OpenClaw MEMORY.md format
    const text = String(memory);
    return { action: 'memory', result: text };
  }
  fromRecall(results: unknown[]) { return results; }
}

export class NativeAdapter implements MemoryAdapter {
  name = 'native';
  toTrace(memory: unknown) {
    const text = String(memory);
    return { action: 'memory', result: text };
  }
  fromRecall(results: unknown[]) { return results; }
}

export const adapters: Record<string, MemoryAdapter> = {
  openclaw: new OpenClawAdapter(),
  native: new NativeAdapter(),
};
