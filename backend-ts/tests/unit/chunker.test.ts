/**
 * Unit tests for the Chunker — no network, no DB.
 */
import { describe, expect, it } from 'vitest';

import { chunkDoc, chunkFileFallback, chunkSymbol } from '../../src/services/codeintel/chunker.js';

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

describe('chunkFileFallback', () => {
  const opts = { maxBytes: 200_000, sliceLines: 200 };

  it('returns a single chunk for a small file', () => {
    const out = chunkFileFallback(
      'acme/widget',
      'components/Button.tsx',
      'export const Button = () => <button>Click</button>;\n',
      opts,
    );
    expect(out).toHaveLength(1);
    const c = out[0]!;
    expect(c.source).toBe('file');
    expect(c.symbolUid).toBeNull();
    expect(c.filePath).toBe('components/Button.tsx');
    expect(c.startLine).toBe(1);
    // Header line (`// path:1-N`) is prepended; content includes the body.
    expect(c.content).toContain('components/Button.tsx');
    expect(c.content).toContain('Button');
  });

  it('slices large files into sliceLines-sized windows with NO overlap', () => {
    // 510 lines → 3 slices at sliceLines=200 → [1-200, 201-400, 401-510].
    const lines = Array.from({ length: 510 }, (_, i) => `line ${i + 1}`);
    const out = chunkFileFallback('r', 'big.ts', lines.join('\n'), opts);
    expect(out).toHaveLength(3);
    expect(out[0]!.startLine).toBe(1);
    expect(out[0]!.endLine).toBe(200);
    expect(out[1]!.startLine).toBe(201);
    expect(out[1]!.endLine).toBe(400);
    expect(out[2]!.startLine).toBe(401);
    expect(out[2]!.endLine).toBe(510);
    // No overlap: contents must be disjoint.
    expect(out[0]!.content).toContain('line 200');
    expect(out[0]!.content).not.toContain('line 201');
    expect(out[1]!.content).toContain('line 201');
    expect(out[1]!.content).not.toContain('line 200');
  });

  it('returns [] for binary files (NUL byte in head)', () => {
    const binary = `${'A'.repeat(100)}\0${'B'.repeat(100)}`;
    const out = chunkFileFallback('r', 'image.png', binary, opts);
    expect(out).toEqual([]);
  });

  it('returns [] for files exceeding maxBytes', () => {
    const huge = 'a'.repeat(300_000);
    const out = chunkFileFallback('r', 'huge.txt', huge, opts);
    expect(out).toEqual([]);
  });

  it('returns [] for whitespace-only files', () => {
    expect(chunkFileFallback('r', 'empty.ts', '   \n\n\n', opts)).toEqual([]);
    expect(chunkFileFallback('r', 'empty.ts', '', opts)).toEqual([]);
  });

  it('is idempotent: same input → same shas', () => {
    const text = 'export const x = 1;\nexport const y = 2;\n';
    const a = chunkFileFallback('r', 'a.ts', text, opts).map((c) => c.contentSha);
    const b = chunkFileFallback('r', 'a.ts', text, opts).map((c) => c.contentSha);
    expect(a).toEqual(b);
    expect(a).toHaveLength(1);
  });

  it('normalizes CRLF to LF before chunking', () => {
    const body = 'export const greeting = "hello";\nexport const farewell = "bye";\n';
    const lf = chunkFileFallback('r', 'f.ts', body, opts);
    const crlf = chunkFileFallback('r', 'f.ts', body.replace(/\n/g, '\r\n'), opts);
    expect(lf).toHaveLength(1);
    expect(crlf).toHaveLength(1);
    expect(lf[0]!.contentSha).toBe(crlf[0]!.contentSha);
  });
});
