/**
 * Unit tests for the atomic graph-dir swap.
 *
 * Each test uses an isolated tmp `repoPath`. We exercise:
 *   1. swapPaths composes the expected three paths.
 *   2. commitStagedSwap promotes staged → live when no live exists.
 *   3. commitStagedSwap promotes staged → live AND removes the previous
 *      live (via the .old sideline) when both exist.
 *   4. commitStagedSwap throws cleanly when staged is missing and leaves
 *      the existing live untouched.
 *   5. discardStaged removes a staged dir without touching live.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  commitStagedSwap,
  discardStaged,
  swapPaths,
} from '../../src/services/codeintel/atomic-swap.js';

const tmpRoot = mkdtempSync(join(tmpdir(), 'yummy-swap-'));
afterAll(() => rmSync(tmpRoot, { recursive: true, force: true }));

let counter = 0;
function nextRepoPath(): string {
  counter += 1;
  return join(tmpRoot, `repo-${counter}`);
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

let repoPath: string;
beforeEach(() => {
  repoPath = nextRepoPath();
});

describe('atomic-swap.swapPaths', () => {
  it('composes live, staged, and old paths under repoPath', () => {
    const p = swapPaths('/some/repo');
    expect(p.live).toBe('/some/repo/.gitnexus');
    expect(p.staged).toBe('/some/repo/.gitnexus.tmp');
    expect(p.old).toBe('/some/repo/.gitnexus.old');
  });
});

describe('atomic-swap.commitStagedSwap', () => {
  it('promotes staged → live when no live exists', async () => {
    const p = swapPaths(repoPath);
    await mkdir(p.staged, { recursive: true });
    await writeFile(join(p.staged, 'marker'), 'new');

    await commitStagedSwap(repoPath);

    expect(await exists(p.staged)).toBe(false);
    expect(await readFile(join(p.live, 'marker'), 'utf8')).toBe('new');
    expect(await exists(p.old)).toBe(false);
  });

  it('replaces an existing live and cleans up .old', async () => {
    const p = swapPaths(repoPath);
    await mkdir(p.live, { recursive: true });
    await writeFile(join(p.live, 'marker'), 'old');
    await mkdir(p.staged, { recursive: true });
    await writeFile(join(p.staged, 'marker'), 'new');

    await commitStagedSwap(repoPath);

    expect(await readFile(join(p.live, 'marker'), 'utf8')).toBe('new');
    expect(await exists(p.staged)).toBe(false);
    expect(await exists(p.old)).toBe(false);
  });

  it('throws when staged is missing and leaves live untouched', async () => {
    const p = swapPaths(repoPath);
    await mkdir(p.live, { recursive: true });
    await writeFile(join(p.live, 'marker'), 'old');

    await expect(commitStagedSwap(repoPath)).rejects.toThrow(/staged dir missing/);
    // Live must still be there, untouched.
    expect(await readFile(join(p.live, 'marker'), 'utf8')).toBe('old');
  });
});

describe('atomic-swap.discardStaged', () => {
  it('removes the staged dir without touching live', async () => {
    const p = swapPaths(repoPath);
    await mkdir(p.live, { recursive: true });
    await writeFile(join(p.live, 'marker'), 'live');
    await mkdir(p.staged, { recursive: true });
    await writeFile(join(p.staged, 'marker'), 'staged');

    await discardStaged(repoPath);

    expect(await exists(p.staged)).toBe(false);
    expect(await readFile(join(p.live, 'marker'), 'utf8')).toBe('live');
  });

  it('is a no-op when nothing is staged', async () => {
    await discardStaged(repoPath);
    expect(await exists(swapPaths(repoPath).staged)).toBe(false);
  });
});
