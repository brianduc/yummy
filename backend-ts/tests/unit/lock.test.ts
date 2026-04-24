/**
 * Unit tests for the runWithLock concurrency helper.
 *
 * We focus on the in-process queue semantics — file-lock interaction is
 * exercised implicitly because we let it run for real against a tmp dir.
 * No gitnexus involvement; the protected `fn` is just an async noop.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { _resetInflight, runWithLock } from '../../src/services/codeintel/lock.js';

const tmpRoot = mkdtempSync(join(tmpdir(), 'yummy-lock-'));
afterAll(() => rmSync(tmpRoot, { recursive: true, force: true }));

beforeEach(() => _resetInflight());

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('runWithLock', () => {
  it('serializes overlapping calls for the same key', async () => {
    const graphDir = join(tmpRoot, 'serialize', '.gitnexus');
    const events: string[] = [];

    const a = runWithLock({ graphDir, key: 'serialize' }, async () => {
      events.push('a:start');
      await delay(40);
      events.push('a:end');
    });
    const b = runWithLock({ graphDir, key: 'serialize' }, async () => {
      events.push('b:start');
      await delay(10);
      events.push('b:end');
    });

    await Promise.all([a, b]);
    expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });

  it('does not propagate errors to subsequent same-key callers', async () => {
    const graphDir = join(tmpRoot, 'errors', '.gitnexus');

    const failing = runWithLock({ graphDir, key: 'errors' }, async () => {
      throw new Error('boom');
    });
    await expect(failing).rejects.toThrow('boom');

    // Next caller must still get to run — the queue must not be
    // permanently broken.
    const ok = await runWithLock({ graphDir, key: 'errors' }, async () => 42);
    expect(ok).toBe(42);
  });

  it('returns the protected function value', async () => {
    const graphDir = join(tmpRoot, 'returns', '.gitnexus');
    const v = await runWithLock({ graphDir, key: 'returns' }, async () => ({
      n: 1,
    }));
    expect(v).toEqual({ n: 1 });
  });

  it('allows different keys to run concurrently', async () => {
    const events: string[] = [];

    const a = runWithLock({ graphDir: join(tmpRoot, 'k1', '.gitnexus'), key: 'k1' }, async () => {
      events.push('a:start');
      await delay(40);
      events.push('a:end');
    });
    const b = runWithLock({ graphDir: join(tmpRoot, 'k2', '.gitnexus'), key: 'k2' }, async () => {
      events.push('b:start');
      await delay(10);
      events.push('b:end');
    });
    await Promise.all([a, b]);

    // b finishes before a because they run in parallel.
    expect(events.indexOf('b:end')).toBeLessThan(events.indexOf('a:end'));
    expect(events.indexOf('b:start')).toBeLessThan(events.indexOf('a:end'));
  });
});
