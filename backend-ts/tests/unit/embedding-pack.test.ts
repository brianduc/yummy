/**
 * packByTokenBudget unit tests.
 *
 * The splitter is the safety net that prevents a dense batch of large
 * symbols from blowing past the OpenAI per-request token cap. We test
 * the bin-packing invariants only — the surrounding limiter wiring is
 * covered by rate-limiter.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { _internal } from '../../src/services/codeintel/embedding.service.js';

const { packByTokenBudget } = _internal;

describe('packByTokenBudget', () => {
  it('returns a single sub-batch when total fits under the cap', () => {
    const inputs = ['a', 'b', 'c'];
    const tokens = [10, 20, 30];
    const out = packByTokenBudget(inputs, tokens, 1000);
    expect(out).toHaveLength(1);
    expect(out[0]?.inputs).toEqual(['a', 'b', 'c']);
    expect(out[0]?.tokens).toBe(60);
  });

  it('splits into multiple sub-batches that each stay under the cap', () => {
    const inputs = ['a', 'b', 'c', 'd', 'e'];
    const tokens = [400, 400, 400, 400, 400];
    const out = packByTokenBudget(inputs, tokens, 1000);
    // 1000-cap → at most 2 × 400 per sub-batch (3 × 400 = 1200 > 1000).
    for (const sub of out) expect(sub.tokens).toBeLessThanOrEqual(1000);
    // All inputs are accounted for, in order.
    expect(out.flatMap((s) => s.inputs)).toEqual(inputs);
  });

  it('preserves caller ordering across sub-batches', () => {
    const inputs = Array.from({ length: 20 }, (_, i) => `item-${i}`);
    const tokens = inputs.map(() => 300);
    const out = packByTokenBudget(inputs, tokens, 1000);
    expect(out.flatMap((s) => s.inputs)).toEqual(inputs);
  });

  it('isolates an oversized single input into its own sub-batch', () => {
    // Single input > maxTokens — it goes into its own sub-batch and the
    // limiter will reject it at acquire() time with HttpError(413), which
    // is the correct fail-fast behaviour.
    const inputs = ['small', 'HUGE', 'small'];
    const tokens = [100, 5000, 100];
    const out = packByTokenBudget(inputs, tokens, 1000);
    // Find the sub-batch containing HUGE — it must be alone.
    const huge = out.find((s) => s.inputs.includes('HUGE'));
    expect(huge?.inputs).toEqual(['HUGE']);
  });

  it('returns an empty array for empty inputs', () => {
    expect(packByTokenBudget([], [], 1000)).toEqual([]);
  });

  it('handles cap exactly equal to a single item size', () => {
    const out = packByTokenBudget(['a', 'b'], [1000, 1000], 1000);
    expect(out).toHaveLength(2);
    expect(out[0]?.inputs).toEqual(['a']);
    expect(out[1]?.inputs).toEqual(['b']);
  });
});
