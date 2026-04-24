/**
 * Unit tests for RetrievalService — RRF math + helpers, no Postgres.
 *
 * The integration of vector + lexical + path legs is exercised by
 * tests/integration/retrieve.test.ts; here we lock down the deterministic
 * fusion math + path-leg tokenizer that the rest of the service trusts.
 */
import { describe, expect, it } from 'vitest';

import { _internal, RRF_K } from '../../src/services/codeintel/retrieve.service.js';

const { rrfFuse, toPgVector, escapeCypherString, pgQuote, tokenizeForPathLeg } = _internal;

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

    const fused = rrfFuse(vector, lexical, [], 3);
    // a: 1/(K+1)+1/(K+3); b: 1/(K+2)+1/(K+1); c: 1/(K+3)+1/(K+2)
    const expected = {
      a: 1 / (RRF_K + 1) + 1 / (RRF_K + 3),
      b: 1 / (RRF_K + 2) + 1 / (RRF_K + 1),
      c: 1 / (RRF_K + 3) + 1 / (RRF_K + 2),
    };
    // Order: b > a > c
    expect(fused.map((f) => f.id)).toEqual(['b', 'a', 'c']);
    expect(fused[0]!.score).toBeCloseTo(expected.b, 6);
    expect(fused[1]!.score).toBeCloseTo(expected.a, 6);
    expect(fused[2]!.score).toBeCloseTo(expected.c, 6);
  });

  it('only one leg contributes when the others are empty', () => {
    const fused = rrfFuse([mkRow('x'), mkRow('y')], [], [], 2);
    expect(fused).toHaveLength(2);
    expect(fused[0]!.id).toBe('x');
    expect(fused[0]!.score).toBeCloseTo(1 / (RRF_K + 1), 6);
    expect(fused[0]!.ranks.vector).toBe(1);
    expect(fused[0]!.ranks.lexical).toBe(-1);
    expect(fused[0]!.ranks.path).toBe(-1);
  });

  it('path leg contributes alongside vector + lexical', () => {
    // Each leg surfaces a different chunk at rank 1; all three should
    // tie at score = 1/(K+1) and be returned in input-stable order
    // (insertion order in the Map -> vector, lexical, path).
    const fused = rrfFuse([mkRow('v')], [mkRow('l')], [mkRow('p')], 3);
    expect(fused).toHaveLength(3);
    const expected = 1 / (RRF_K + 1);
    for (const f of fused) expect(f.score).toBeCloseTo(expected, 6);
    expect(fused.find((f) => f.id === 'p')!.ranks.path).toBe(1);
    expect(fused.find((f) => f.id === 'v')!.ranks.vector).toBe(1);
    expect(fused.find((f) => f.id === 'l')!.ranks.lexical).toBe(1);
  });

  it('agreement across all three legs beats single-leg hits', () => {
    // `triple` appears in every leg at rank 2; `solo` only in vector at
    // rank 1. Score: triple = 3/(K+2); solo = 1/(K+1). With K=60 that's
    // 0.0484 vs 0.0164 — triple wins by ~3×.
    const v = [mkRow('solo'), mkRow('triple')];
    const l = [mkRow('other'), mkRow('triple')];
    const p = [mkRow('other2'), mkRow('triple')];
    const fused = rrfFuse(v, l, p, 1);
    expect(fused[0]!.id).toBe('triple');
    expect(fused[0]!.score).toBeCloseTo(3 / (RRF_K + 2), 6);
  });

  it('breaks score ties by smaller cosine distance', () => {
    const vector = [mkRow('low-dist', 0.01), mkRow('high-dist', 0.5)];
    const lexical = [mkRow('high-dist', 0.5), mkRow('low-dist', 0.01)];
    const fused = rrfFuse(vector, lexical, [], 2);
    expect(fused.map((f) => f.id)).toEqual(['low-dist', 'high-dist']);
  });

  it('clamps result count to topK', () => {
    const rows = Array.from({ length: 10 }, (_, i) => mkRow(`r${i}`));
    const fused = rrfFuse(rows, [], [], 3);
    expect(fused).toHaveLength(3);
  });

  it('exposes per-leg ranks for trace', () => {
    const fused = rrfFuse([mkRow('only-v')], [mkRow('only-l')], [mkRow('only-p')], 3);
    const v = fused.find((f) => f.id === 'only-v')!;
    const l = fused.find((f) => f.id === 'only-l')!;
    const p = fused.find((f) => f.id === 'only-p')!;
    expect(v.ranks).toEqual({ vector: 1, lexical: -1, path: -1 });
    expect(l.ranks).toEqual({ vector: -1, lexical: 1, path: -1 });
    expect(p.ranks).toEqual({ vector: -1, lexical: -1, path: 1 });
  });
});

describe('tokenizeForPathLeg', () => {
  it('splits on code separators so route literals yield identifier tokens', () => {
    expect(tokenizeForPathLeg('show me /api/sdlc/start')).toEqual(
      expect.arrayContaining(['sdlc', 'start']),
    );
  });

  it('drops short tokens and English stopwords', () => {
    const tokens = tokenizeForPathLeg('what does the runScan function do');
    // 'what'/'does'/'the'/'function'/'do' are stopwords; 'runscan' (>=4) wins.
    expect(tokens).toContain('runscan');
    expect(tokens).not.toContain('what');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('function');
  });

  it('lowercases and dedupes', () => {
    const tokens = tokenizeForPathLeg('Sdlc sdlc SDLC');
    expect(tokens).toEqual(['sdlc']);
  });

  it('returns empty array for pure-stopword queries', () => {
    expect(tokenizeForPathLeg('what is the')).toEqual([]);
  });

  it('preserves identifier boundaries from camelCase only via separators', () => {
    // We do NOT split camelCase: `runSdlcStream` stays as one token.
    // (Splitting camelCase loses the identifier match in ILIKE — we'd
    // never hit the literal `runSdlcStream` in source if we broke it up.)
    const tokens = tokenizeForPathLeg('check runSdlcStream behaviour');
    expect(tokens).toContain('runsdlcstream');
    expect(tokens).toContain('behaviour');
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
