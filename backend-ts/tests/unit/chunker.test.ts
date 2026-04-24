/**
 * Unit tests for the Chunker — no network, no DB.
 */
import { describe, expect, it } from 'vitest';

import { chunkDoc, chunkSymbol } from '../../src/services/codeintel/chunker.js';

describe('chunkSymbol', () => {
  it('produces a chunk with header + body and stable contentSha', () => {
    const c = chunkSymbol('acme/widget', {
      uid: 'Function:src/foo.ts:bar',
      name: 'bar',
      filePath: 'src/foo.ts',
      startLine: 10,
      endLine: 20,
      content: 'function bar() {\n  return 42;\n}',
      signature: 'function bar(): number',
    });
    expect(c).not.toBeNull();
    expect(c?.source).toBe('symbol');
    expect(c?.symbolUid).toBe('Function:src/foo.ts:bar');
    expect(c?.repoId).toBe('acme/widget');
    expect(c?.startLine).toBe(10);
    expect(c?.endLine).toBe(20);
    expect(c?.content).toContain('src/foo.ts:10-20');
    expect(c?.content).toContain('function bar(): number');
    expect(c?.content).toContain('return 42');
    expect(c?.contentSha).toMatch(/^[0-9a-f]{64}$/);
    expect(c?.tokenCountEstimate).toBeGreaterThan(0);
  });

  it('returns null for whitespace-only symbols', () => {
    const c = chunkSymbol('r', {
      uid: 'X',
      name: 'x',
      filePath: 'a',
      startLine: 1,
      endLine: 1,
      content: '   \n\n',
    });
    expect(c).toBeNull();
  });

  it('produces identical contentSha for identical input (idempotent)', () => {
    const make = () =>
      chunkSymbol('r', {
        uid: 'U',
        name: 'n',
        filePath: 'f.ts',
        startLine: 1,
        endLine: 3,
        content: 'const x = 1;\nconst y = 2;\nexport {};\n',
      });
    expect(make()?.contentSha).toBe(make()?.contentSha);
  });

  it('truncates very large symbols below MAX_CHARS', () => {
    const huge = 'a'.repeat(200_000);
    const c = chunkSymbol('r', {
      uid: 'U',
      name: 'n',
      filePath: 'f.ts',
      startLine: 1,
      endLine: 1000,
      content: huge,
    });
    if (!c) throw new Error('expected chunk');
    expect(c.content.length).toBeLessThan(35_000);
  });
});

describe('chunkDoc', () => {
  it('returns a single chunk for a short doc', () => {
    const out = chunkDoc('r', {
      filePath: 'README.md',
      content: '# Hello\n\nThis is a short README.\n',
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.source).toBe('doc');
    expect(out[0]?.symbolUid).toBeNull();
    expect(out[0]?.startLine).toBe(1);
  });

  it('skips empty docs', () => {
    expect(chunkDoc('r', { filePath: 'empty.md', content: '' })).toEqual([]);
    expect(chunkDoc('r', { filePath: 'ws.md', content: '   \n\n' })).toEqual([]);
  });

  it('splits a long doc into overlapping chunks', () => {
    // 30k chars → at DOC_WINDOW=6k with 600 overlap, expect ~5–6 chunks.
    const big = Array.from(
      { length: 600 },
      (_, i) => `Line ${i}: lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
    ).join('\n');
    const out = chunkDoc('r', { filePath: 'big.md', content: big });
    expect(out.length).toBeGreaterThanOrEqual(4);
    // Every chunk has unique sha and non-empty content
    const shas = new Set(out.map((c) => c.contentSha));
    expect(shas.size).toBe(out.length);
    for (const c of out) expect(c.content.length).toBeGreaterThan(100);
  });

  it('yields the same shas for the same input (idempotent)', () => {
    const input = { filePath: 'a.md', content: 'paragraph one.\n\nparagraph two.\n' };
    const a = chunkDoc('r', input).map((c) => c.contentSha);
    const b = chunkDoc('r', input).map((c) => c.contentSha);
    expect(a).toEqual(b);
  });
});
