/**
 * Unit tests for LbugReader — no real LadybugDB, no network.
 *
 * We exercise the row→SymbolInput mapping, BigInt coercion, content
 * filtering, and the soft-fail path when no adapter is available.
 */
import { describe, expect, it } from 'vitest';

import { type LbugAdapter, readRepoSymbols } from '../../src/services/codeintel/lbug.reader.js';

function fakeAdapter(rows: unknown[]): LbugAdapter {
  return {
    async withLbugDb(_p, fn) {
      return fn();
    },
    async executeQuery() {
      return rows;
    },
  };
}

describe('readRepoSymbols', () => {
  it('maps Function/Class rows to SymbolInput, normalises BigInt lines', async () => {
    const adapter = fakeAdapter([
      {
        uid: 'Function:src/a.ts:foo',
        label: 'Function',
        name: 'foo',
        filePath: 'src/a.ts',
        startLine: 1n,
        endLine: 5n,
        content: 'function foo() {}',
        description: 'does the thing',
      },
      {
        uid: 'Class:src/b.ts:Bar',
        label: 'Class',
        name: 'Bar',
        filePath: 'src/b.ts',
        startLine: 10,
        endLine: 20,
        content: 'class Bar {}',
        description: null,
      },
    ]);

    const out = await readRepoSymbols('/repo', {
      adapter,
      resolveLbugPath: () => '/fake/.gitnexus/lbug',
    });

    expect(out.symbols).toHaveLength(2);
    expect(out.counts).toEqual({ Function: 1, Class: 1 });
    expect(out.skipped).toBe(0);
    const foo = out.symbols[0]!;
    expect(typeof foo.startLine).toBe('number');
    expect(foo.startLine).toBe(1);
    expect(foo.endLine).toBe(5);
    expect(foo.docstring).toBe('does the thing');
    const bar = out.symbols[1]!;
    expect(bar.docstring).toBeUndefined();
  });

  it('skips symbols with empty / whitespace content and counts them', async () => {
    const adapter = fakeAdapter([
      {
        uid: 'Function:src/a.ts:foo',
        label: 'Function',
        name: 'foo',
        filePath: 'src/a.ts',
        startLine: 1,
        endLine: 5,
        content: '   \n  ',
        description: null,
      },
      {
        uid: 'Method:src/a.ts:bar',
        label: 'Method',
        name: 'bar',
        filePath: 'src/a.ts',
        startLine: 6,
        endLine: 10,
        content: null,
        description: null,
      },
      {
        uid: 'Function:src/a.ts:baz',
        label: 'Function',
        name: 'baz',
        filePath: 'src/a.ts',
        startLine: 11,
        endLine: 12,
        content: 'function baz() {}',
        description: null,
      },
    ]);

    const out = await readRepoSymbols('/repo', {
      adapter,
      resolveLbugPath: () => '/fake/.gitnexus/lbug',
    });

    expect(out.symbols).toHaveLength(1);
    expect(out.symbols[0]!.name).toBe('baz');
    expect(out.skipped).toBe(2);
  });

  it('falls back to label-path-name UID when row.uid is empty', async () => {
    const adapter = fakeAdapter([
      {
        uid: '',
        label: 'Interface',
        name: 'IFoo',
        filePath: 'src/i.ts',
        startLine: 1,
        endLine: 3,
        content: 'interface IFoo { x: number }',
        description: null,
      },
    ]);

    const out = await readRepoSymbols('/repo', {
      adapter,
      resolveLbugPath: () => '/fake',
    });

    expect(out.symbols[0]!.uid).toBe('Interface:src/i.ts:IFoo');
  });
});
