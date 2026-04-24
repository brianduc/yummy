/**
 * Atomic graph-directory swap.
 *
 * gitnexus writes its LadybugDB into `${repoPath}/.gitnexus/`. If that
 * directory exists at all when the analyzer starts, gitnexus tries to
 * incrementally update it — which is great when the prior run finished
 * cleanly, but disastrous when the prior process crashed mid-write and
 * left a half-baked database behind.
 *
 * To make a *force* re-analysis safe we:
 *
 *   1. Stage the work into `${repoPath}/.gitnexus.tmp/` (the analyzer
 *      thinks this is the real graph dir, because we set its env/cwd
 *      to point there).
 *   2. On success, atomically swap: `mv .gitnexus → .gitnexus.old &&
 *      mv .gitnexus.tmp → .gitnexus && rm -rf .gitnexus.old`.
 *      The two renames are atomic on the same filesystem; the rm at
 *      the end is best-effort cleanup.
 *
 * For incremental scans we skip the swap entirely and let gitnexus
 * write straight into `.gitnexus/`.
 *
 * NOTE: gitnexus 1.6 does not currently expose a "graph dir" override —
 * the helper here is purpose-built for a future PR that wires it through.
 * For now, `withStagedGraphDir` simply yields the staged path so the
 * scan service can decide whether to use it.
 */
import { rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

export interface SwapPaths {
  /** Live graph dir consumed by gitnexus normally. */
  live: string;
  /** Staging dir we write into. */
  staged: string;
  /** Sidelined dir holding the previous graph during the swap. */
  old: string;
}

export function swapPaths(repoPath: string): SwapPaths {
  const live = join(repoPath, '.gitnexus');
  return {
    live,
    staged: `${live}.tmp`,
    old: `${live}.old`,
  };
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Move `staged → live`, sidelining any pre-existing `live` first.
 * Both renames are on the same filesystem (same parent dir), so they're
 * atomic. On any error the live dir is left untouched.
 */
export async function commitStagedSwap(repoPath: string): Promise<void> {
  const p = swapPaths(repoPath);
  if (!(await exists(p.staged))) {
    throw new Error(`commitStagedSwap: staged dir missing at ${p.staged}`);
  }
  // Sideline the existing graph if present.
  if (await exists(p.live)) {
    await rm(p.old, { recursive: true, force: true });
    await rename(p.live, p.old);
  }
  try {
    await rename(p.staged, p.live);
  } catch (err) {
    // Roll back: put .old back where it was so we don't end up with no
    // graph dir at all.
    if (await exists(p.old)) {
      await rename(p.old, p.live).catch(() => {
        /* nothing useful we can do here */
      });
    }
    throw err;
  }
  // Best-effort cleanup of the sidelined old graph.
  await rm(p.old, { recursive: true, force: true }).catch(() => {});
}

/**
 * Discard whatever is in `${repoPath}/.gitnexus.tmp/`. Safe to call
 * even when nothing is there.
 */
export async function discardStaged(repoPath: string): Promise<void> {
  await rm(swapPaths(repoPath).staged, { recursive: true, force: true });
}
