/**
 * Unit tests for RetrievalService — RRF math + helpers, no Postgres.
 *
 * The integration of vector + lexical legs is exercised by
 * tests/integration/retrieve.test.ts; here we lock down the deterministic
 * fusion math that the rest of the service trusts.
 */
import { describe, expect, it } from 'vitest';

import { _internal, RRF_K } from '../../src/services/codeintel/retrieve.service.js';

const { rrfFuse, toPgVector, escapeCypherString, pgQuote } = _internal;

function mkRow(id: string, distance = 0.1) {
  return {
    id,
    repo_id: 'r/r',
    source: 'symbol',
    symbol_uid: `Function:src/${id}.ts:${id}`,
    file_path: `src/${id}.ts`,
    start_line: 1,
    end_line: 5,
    content: `function ${id}() {}`,
    distance,
  };
}

describe('rrfFuse', () => {
  it('uses 1/(K+rank) and sums per-leg contributions', () => {
    const vector = [mkRow('a', 0.05), mkRow('b', 0.1), mkRow('c', 0.2)];
    const lexical = [mkRow('b', 0.1), mkRow('c', 0.2), mkRow('a', 0.05)];

    const fused = rrfFuse(vector, lexical, 3);
    // Every chunk hit both legs, so all get the same score irrespective
    // of leg ranking when the union of (rank_v, rank_l) is the same set.
    // a: 1/(K+1)+1/(K+3); b: 1/(K+2)+1/(K+1); c: 1/(K+3)+1/(K+2)
    const expected = {
      a: 1 / (RRF_K + 1) + 1 / (RRF_K + 3),
      b: 1 / (RRF_K + 2) + 1 / (RRF_K + 1),
      c: 1 / (RRF_K + 3) + 1 / (RRF_K + 2),
    };
    // Order: b > a > c (because b has rank-1 + rank-2; a has rank-1 + rank-3; c has 2+3)
    expect(fused.map((f) => f.id)).toEqual(['b', 'a', 'c']);
    expect(fused[0]!.score).toBeCloseTo(expected.b, 6);
    expect(fused[1]!.score).toBeCloseTo(expected.a, 6);
    expect(fused[2]!.score).toBeCloseTo(expected.c, 6);
  });

  it('only one leg contributes when the other is empty', () => {
    const fused = rrfFuse([mkRow('x'), mkRow('y')], [], 2);
    expect(fused).toHaveLength(2);
    expect(fused[0]!.id).toBe('x');
    expect(fused[0]!.score).toBeCloseTo(1 / (RRF_K + 1), 6);
    expect(fused[0]!.ranks.vector).toBe(1);
    expect(fused[0]!.ranks.lexical).toBe(-1);
  });

  it('breaks score ties by smaller cosine distance', () => {
    // Both rows appear in vector-only at rank 1 — identical scores by
    // construction (we test 1 row at a time below by making them share
    // a rank via the lexical leg).
    const vector = [mkRow('low-dist', 0.01), mkRow('high-dist', 0.5)];
    const lexical = [mkRow('high-dist', 0.5), mkRow('low-dist', 0.01)];
    // Both end up with score = 1/(K+1) + 1/(K+2). Tiebreak by distance.
    const fused = rrfFuse(vector, lexical, 2);
    expect(fused.map((f) => f.id)).toEqual(['low-dist', 'high-dist']);
  });

  it('clamps result count to topK', () => {
    const rows = Array.from({ length: 10 }, (_, i) => mkRow(`r${i}`));
    const fused = rrfFuse(rows, [], 3);
    expect(fused).toHaveLength(3);
  });

  it('exposes per-leg ranks for trace', () => {
    const fused = rrfFuse([mkRow('only-v')], [mkRow('only-l')], 2);
    const v = fused.find((f) => f.id === 'only-v')!;
    const l = fused.find((f) => f.id === 'only-l')!;
    expect(v.ranks).toEqual({ vector: 1, lexical: -1 });
    expect(l.ranks).toEqual({ vector: -1, lexical: 1 });
  });
});

describe('helpers', () => {
  it('toPgVector formats a number[] as the compact pgvector literal', () => {
    expect(toPgVector([1, 2, 3.5])).toBe('[1,2,3.5]');
    expect(toPgVector([])).toBe('[]');
  });

  it('escapeCypherString doubles single quotes and escapes backslashes', () => {
    expect(escapeCypherString("O'Brien")).toBe("O''Brien");
    expect(escapeCypherString('a\\b')).toBe('a\\\\b');
    expect(escapeCypherString("a\\'b")).toBe("a\\\\''b");
  });

  it('pgQuote wraps and escapes for SQL string literals', () => {
    expect(pgQuote("ab'c")).toBe("'ab''c'");
    expect(pgQuote('plain')).toBe("'plain'");
  });
});
