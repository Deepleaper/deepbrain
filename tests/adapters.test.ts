/**
 * Adapter Tests
 */
import { describe, it, expect } from 'vitest';
import { OpenClawAdapter, NativeAdapter, adapters } from '../src/adapters/index.js';
import type { MemoryAdapter } from '../src/adapters/index.js';

describe('Adapters', () => {
  // ── Exports ──────────────────────────────────────────

  it('NativeAdapter is exported', () => {
    expect(NativeAdapter).toBeDefined();
  });

  it('OpenClawAdapter is exported', () => {
    expect(OpenClawAdapter).toBeDefined();
  });

  it('adapters registry contains openclaw', () => {
    expect(adapters.openclaw).toBeDefined();
  });

  it('adapters registry contains native', () => {
    expect(adapters.native).toBeDefined();
  });

  // ── NativeAdapter ────────────────────────────────────

  describe('NativeAdapter', () => {
    const adapter = new NativeAdapter();

    it('has name "native"', () => {
      expect(adapter.name).toBe('native');
    });

    it('toTrace converts string input', () => {
      const trace = adapter.toTrace('some memory text');
      expect(trace.action).toBe('memory');
      expect(trace.result).toBe('some memory text');
    });

    it('toTrace handles non-string input', () => {
      const trace = adapter.toTrace(12345);
      expect(trace.result).toBe('12345');
    });

    it('fromRecall passes through results', () => {
      const input = [{ slug: 'a' }, { slug: 'b' }];
      const output = adapter.fromRecall(input);
      expect(output).toEqual(input);
    });

    it('implements MemoryAdapter interface', () => {
      const a: MemoryAdapter = adapter;
      expect(a.name).toBe('native');
      expect(typeof a.toTrace).toBe('function');
      expect(typeof a.fromRecall).toBe('function');
    });
  });

  // ── OpenClawAdapter ──────────────────────────────────

  describe('OpenClawAdapter', () => {
    const adapter = new OpenClawAdapter();

    it('has name "openclaw"', () => {
      expect(adapter.name).toBe('openclaw');
    });

    it('toTrace converts string input', () => {
      const trace = adapter.toTrace('MEMORY.md content');
      expect(trace.action).toBe('memory');
      expect(trace.result).toBe('MEMORY.md content');
    });

    it('fromRecall passes through results', () => {
      const input = [{ slug: 'x' }];
      expect(adapter.fromRecall(input)).toEqual(input);
    });

    it('implements MemoryAdapter interface', () => {
      const a: MemoryAdapter = adapter;
      expect(typeof a.name).toBe('string');
      expect(typeof a.toTrace).toBe('function');
      expect(typeof a.fromRecall).toBe('function');
    });
  });
});
