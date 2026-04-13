/**
 * DeepBrain — Types Tests (unit, no DB needed)
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../src/core/types.js';

describe('Types', () => {
  it('should have correct default config', () => {
    expect(DEFAULT_CONFIG.engine).toBe('pglite');
    expect(DEFAULT_CONFIG.embedding_provider).toBe('ollama');
    expect(DEFAULT_CONFIG.data_dir).toBe('./brain');
    expect(DEFAULT_CONFIG.database).toBe('./deepbrain-data');
  });

  it('default config should not have api_key', () => {
    expect(DEFAULT_CONFIG).not.toHaveProperty('api_key');
  });
});
