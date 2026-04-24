/**
 * GraphClient — thin wrapper over the `gitnexus` library.
 *
 * Uses the deep import `gitnexus/dist/core/run-analyze.js` because gitnexus
 * 1.6.x ships only a CLI binary (no top-level package exports). The shared
 * `runFullAnalysis` orchestrator is documented as the library entry point
 * and explicitly never calls process.exit().
 *
 * NOTE: gitnexus is licensed PolyForm Noncommercial 1.0.0. Yummy may use it
 * for internal evaluation; commercial deployment requires a paid license
 * from akonlabs.com.
 */
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { env } from '../../config/env.js';

export interface RepoLocator {
  /** "owner/repo" — also serves as repoId for the embeddings store. */
  repoId: string;
  /** Absolute path to the cloned repo on disk. */
  repoPath: string;
  /** Absolute path to the repo's `.gitnexus/` graph dir. */
  graphDir: string;
}

export function resolveRepo(owner: string, repo: string): RepoLocator {
  // Allow letters, digits, underscore, hyphen, dot — but reject any
  // segment that is empty, "." / ".." (path-traversal), starts with a
  // dot (hidden / dotfile-style), or contains a slash.
  const safe = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/;
  const reject = (s: string) => !s || s === '.' || s === '..' || s.includes('/') || !safe.test(s);
  if (reject(owner) || reject(repo)) {
    throw new Error(`Invalid repo identifier: owner="${owner}" repo="${repo}"`);
  }
  const root = resolve(env.GITNEXUS_REPO_ROOT);
  const repoPath = join(root, owner, repo);
  return {
    repoId: `${owner}/${repo}`,
    repoPath,
    graphDir: join(repoPath, '.gitnexus'),
  };
}

/**
 * Ensures gitnexus's HOME-based config lives at env.GITNEXUS_HOME
 * regardless of where the backend was launched from. Idempotent.
 */
export function ensureGitnexusHome(): void {
  const home = resolve(env.GITNEXUS_HOME);
  mkdirSync(home, { recursive: true });
  process.env.HOME = home;
}

export interface AnalyzeProgress {
  phase: string;
  percent: number;
  message: string;
}

export interface AnalyzeOptions {
  force?: boolean;
  embeddings?: boolean;
  skipGit?: boolean;
  /** Defaults to true — keep AGENTS.md changes out of customer repos. */
  skipAgentsMd?: boolean;
  /** Defaults to true — counts are volatile. */
  noStats?: boolean;
  onProgress?: (p: AnalyzeProgress) => void;
  onLog?: (msg: string) => void;
}

export interface AnalyzeResult {
  ok: boolean;
  repoId: string;
  graphDir: string;
  repoName: string;
  alreadyUpToDate: boolean;
  stats: {
    files?: number;
    nodes?: number;
    edges?: number;
    communities?: number;
    processes?: number;
    embeddings?: number;
  };
  warning?: string;
}

/**
 * Lazy import — keeps the rest of the backend bootable even when gitnexus
 * isn't installed (e.g. CI matrix without native deps).
 */
async function loadAnalyzer(): Promise<
  | ((
      repoPath: string,
      options: Record<string, unknown>,
      callbacks: {
        onProgress: (phase: string, percent: number, message: string) => void;
        onLog?: (message: string) => void;
      },
    ) => Promise<{
      repoName: string;
      stats: AnalyzeResult['stats'];
      alreadyUpToDate?: boolean;
    }>)
  | null
> {
  try {
    // Deep import — gitnexus 1.6 has no top-level package export for the
    // analyzer. Cast through `unknown` because there is no .d.ts at this
    // path (the .d.ts ships under the same dist tree but isn't re-exported).
    const mod = (await import('gitnexus/dist/core/run-analyze.js' as string)) as {
      runFullAnalysis: unknown;
    };
    return mod.runFullAnalysis as never;
  } catch {
    return null;
  }
}

/**
 * Run a full gitnexus analysis on the given repo. The graph is written
 * to `${repoPath}/.gitnexus/` (gitnexus default).
 *
 * MVP: this is a thin facade. Concurrency control + atomic .gitnexus.tmp
 * swap live in the scan service (next PR).
 */
export async function runFullAnalysis(
  loc: RepoLocator,
  options: AnalyzeOptions = {},
): Promise<AnalyzeResult> {
  ensureGitnexusHome();
  mkdirSync(loc.repoPath, { recursive: true });

  const analyze = await loadAnalyzer();
  if (!analyze) {
    return {
      ok: false,
      repoId: loc.repoId,
      graphDir: loc.graphDir,
      repoName: loc.repoId,
      alreadyUpToDate: false,
      stats: {},
      warning: 'gitnexus package not installed — run `pnpm install` in backend-ts/',
    };
  }

  // Build the callbacks object so we don't pass `onLog: undefined` —
  // gitnexus' types use `exactOptionalPropertyTypes`-incompatible signatures.
  const callbacks: {
    onProgress: (phase: string, percent: number, message: string) => void;
    onLog?: (message: string) => void;
  } = {
    onProgress: (phase, percent, message) => options.onProgress?.({ phase, percent, message }),
  };
  if (options.onLog) callbacks.onLog = options.onLog;

  const r = await analyze(
    loc.repoPath,
    {
      force: options.force ?? false,
      embeddings: options.embeddings ?? false,
      skipGit: options.skipGit ?? false,
      // Defaults differ from gitnexus CLI: we don't want to mutate the
      // customer's repo with AGENTS.md edits during a scan.
      skipAgentsMd: options.skipAgentsMd ?? true,
      noStats: options.noStats ?? true,
    },
    callbacks,
  );

  return {
    ok: true,
    repoId: loc.repoId,
    graphDir: loc.graphDir,
    repoName: r.repoName,
    alreadyUpToDate: r.alreadyUpToDate ?? false,
    stats: r.stats ?? {},
  };
}
