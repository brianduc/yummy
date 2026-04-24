/**
 * Concurrency control for gitnexus graph writes.
 *
 * LadybugDB allows only one writer per database directory. We enforce
 * that with two layers:
 *
 *   1. **In-process mutex** (`Map<repoId, Promise<void>>`): cheap; serializes
 *      back-to-back scans of the same repo from inside this Node process.
 *   2. **proper-lockfile on `${graphDir}/lbug.lock`**: guards against
 *      multiple processes (e.g. backend + a CLI re-analyze) racing on the
 *      same on-disk database.
 *
 * Both are required: the in-process layer keeps simultaneous HTTP scans
 * from holding the cross-process lock and starving each other; the file
 * lock keeps a stray CLI invocation safe.
 *
 * Lock files live next to the graph dir, NOT inside it, because:
 *   - the graph dir may not exist yet on a first run, and
 *   - we wipe-and-swap the graph dir in `atomic-swap.ts`; a lock inside
 *     would vanish mid-rename.
 */
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import lockfile from 'proper-lockfile';

/** Singleton in-process queue, keyed by repoId. */
const inflight = new Map<string, Promise<unknown>>();

export interface RunWithLockOptions {
  /** Absolute path to the graph dir (e.g. `${repoPath}/.gitnexus`). */
  graphDir: string;
  /** Stable id used for the in-process queue (typically `repoId`). */
  key: string;
  /** Max wait for the file lock, in ms. Default 60s. */
  fileLockStaleMs?: number;
}

/**
 * Run `fn` with both layers of mutual exclusion held. The promise it
 * returns is what subsequent same-key callers will queue behind.
 *
 * If `fn` throws, the in-process slot is cleared so the next caller
 * isn't blocked forever; the file lock is always released by
 * `proper-lockfile`'s release callback.
 */
export async function runWithLock<T>(
  options: RunWithLockOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = inflight.get(options.key);
  // Chain via `.then` so we don't propagate the previous caller's error.
  const next = (previous ?? Promise.resolve()).then(() => runWithFileLock(options, fn));
  inflight.set(options.key, next);
  try {
    return await next;
  } finally {
    // Only clear when we're still the head — otherwise we'd evict a
    // newer queued promise.
    if (inflight.get(options.key) === next) inflight.delete(options.key);
  }
}

async function runWithFileLock<T>(options: RunWithLockOptions, fn: () => Promise<T>): Promise<T> {
  // proper-lockfile needs the *parent* directory to exist; the lock
  // file itself doesn't have to pre-exist — the lib creates a sentinel.
  await mkdir(dirname(options.graphDir), { recursive: true });

  const release = await lockfile.lock(options.graphDir, {
    realpath: false, // graphDir may not exist on first run
    stale: options.fileLockStaleMs ?? 60_000,
    retries: { retries: 5, factor: 1.5, minTimeout: 200, maxTimeout: 2_000 },
  });
  try {
    return await fn();
  } finally {
    await release().catch(() => {
      /* lock already released or stale-cleared — ignore */
    });
  }
}

/** Test-only: drop all in-process queue entries. */
export function _resetInflight(): void {
  inflight.clear();
}
