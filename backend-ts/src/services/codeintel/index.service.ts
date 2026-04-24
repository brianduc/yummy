/**
 * CodeIntelService — orchestrates the gitnexus + embeddings phase of a scan.
 *
 * Composition:
 *
 *   resolveRepo  → directory layout under ~/.yummy
 *   cloneOrUpdate → materialize the repo on disk
 *   runWithLock  → in-proc mutex + proper-lockfile
 *   runFullAnalysis → gitnexus pipeline → ${repoPath}/.gitnexus
 *   readRepoSymbols → pull Function/Class/Method/Interface from LadybugDB
 *   chunkSymbol → embedding-ready chunks
 *   walkFilesForFallback (opt) → chunkFileFallback for files NOT covered
 *     by any symbol chunk — gated by env.EMBED_FILE_FALLBACK
 *   embedAndStore → push chunks to Postgres+pgvector
 *
 * NOTE: runFullAnalysis writes straight into `${repoPath}/.gitnexus/`
 * because gitnexus 1.6 doesn't take an output-dir override. The atomic
 * `.gitnexus.tmp` swap ships unused for now but is exported so a future
 * PR can wire it once we have the override.
 */
import { promises as fs } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { env } from '../../config/env.js';
import { chunkFileFallback, chunkSymbol } from './chunker.js';
import { embedAndStore } from './embedding.service.js';
import { ensureGitnexusHome, resolveRepo, runFullAnalysis } from './graph.client.js';
import { readRepoSymbols } from './lbug.reader.js';
import { runWithLock } from './lock.js';
import { cloneOrUpdate } from './repo.source.js';
import type { PreparedChunk } from './types.js';

export interface IndexRepoInput {
  /** GitHub owner — combined with repo to form the on-disk path. */
  owner: string;
  /** GitHub repo name. */
  repo: string;
  url: string;
  branch?: string | undefined;
  token?: string | undefined;
  /** Force a full re-analysis even if gitnexus thinks nothing changed. */
  force?: boolean;
  /** Optional progress callback — phase strings are stable. */
  onProgress?: (phase: IndexPhase, message: string) => void;
}

export type IndexPhase = 'clone' | 'analyze' | 'embed' | 'done';

export interface IndexRepoResult {
  ok: true;
  repoId: string;
  repoPath: string;
  graphDir: string;
  branch: string;
  head: string;
  cloned: boolean;
  alreadyUpToDate: boolean;
  /** From gitnexus pipeline — files/nodes/edges/communities/processes/embeddings. */
  graphStats: {
    files?: number;
    nodes?: number;
    edges?: number;
    communities?: number;
    processes?: number;
    embeddings?: number;
  };
  embedStats: {
    prepared: number;
    reused: number;
    embedded: number;
    inserted: number;
  };
  /**
   * Count of chunks produced by the file-fallback chunker (Fix C). 0 when
   * the fallback is disabled (env.EMBED_FILE_FALLBACK=false) or when every
   * file was already covered by a Function/Class/Method/Interface symbol.
   */
  fileFallbackChunks?: number;
  /** Symbol-extraction observability — surfaced in scan status. */
  symbolStats: {
    totalSymbols: number;
    skipped: number;
    countsByLabel: Record<string, number>;
  };
}

/**
 * Run a full index pass: clone-or-update → gitnexus → embed.
 * Concurrency-safe: serializes per-repo via in-process mutex + lockfile.
 */
export async function indexRepo(input: IndexRepoInput): Promise<IndexRepoResult> {
  const loc = resolveRepo(input.owner, input.repo);
  ensureGitnexusHome();

  // Phase 1: clone-or-update — does not need the graph lock.
  input.onProgress?.('clone', `Cloning ${loc.repoId}...`);
  const src = await cloneOrUpdate({
    repoPath: loc.repoPath,
    url: input.url,
    branch: input.branch,
    token: input.token,
  });

  // Phases 2 & 3: serialized per-repo via lockfile + in-proc mutex.
  return await runWithLock({ graphDir: loc.graphDir, key: loc.repoId }, async () => {
    input.onProgress?.('analyze', 'Analyzing code graph...');
    const analyze = await runFullAnalysis(loc, {
      force: input.force ?? false,
      // We embed via our own pipeline; gitnexus' built-in embeddings
      // would target a different store and waste OpenAI calls.
      embeddings: false,
      onProgress: (p) => input.onProgress?.('analyze', p.message),
    });

    // Phase 3: read symbols from the freshly-written graph and embed.
    input.onProgress?.('embed', 'Reading symbols from graph...');
    const symRead = await readRepoSymbols(loc.repoPath);

    const prepared: PreparedChunk[] = [];
    const symbolPaths = new Set<string>();
    for (const sym of symRead.symbols) {
      const chunk = chunkSymbol(loc.repoId, sym);
      if (chunk) {
        prepared.push(chunk);
        symbolPaths.add(sym.filePath);
      }
    }

    // ── File-fallback (Fix C) ──
    // For every source file NOT already represented by a Function/Class/
    // Method/Interface chunk, emit `chunkFileFallback` slices. Off by
    // default — see env.EMBED_FILE_FALLBACK for the rationale (cost vs
    // recall tradeoff). When ON, the partial-unique index on
    // (repo_id, file_path, content_sha) WHERE symbol_uid IS NULL keeps
    // re-runs idempotent.
    let fileFallbackChunks = 0;
    if (env.EMBED_FILE_FALLBACK) {
      input.onProgress?.('embed', 'Walking files for fallback chunks...');
      const filesToWalk = await listFallbackFiles(loc.repoPath, symbolPaths);
      for (const relPath of filesToWalk) {
        let raw: string;
        try {
          raw = await fs.readFile(join(loc.repoPath, relPath), 'utf8');
        } catch {
          // Symlink dangling, perms issue, file deleted between walk and
          // read — skip rather than abort the whole scan.
          continue;
        }
        const slices = chunkFileFallback(loc.repoId, relPath, raw, {
          maxBytes: env.EMBED_FILE_MAX_BYTES,
          sliceLines: env.EMBED_FILE_SLICE_LINES,
        });
        prepared.push(...slices);
        fileFallbackChunks += slices.length;
      }
    }

    input.onProgress?.(
      'embed',
      `Embedding ${prepared.length} chunks (${symRead.symbols.length} symbols` +
        (fileFallbackChunks > 0 ? `, ${fileFallbackChunks} file-fallback` : '') +
        `)...`,
    );
    const embed = await embedAndStore(prepared);

    input.onProgress?.('done', 'Done.');
    return {
      ok: true as const,
      repoId: loc.repoId,
      repoPath: loc.repoPath,
      graphDir: loc.graphDir,
      branch: src.branch,
      head: src.head,
      cloned: src.cloned,
      alreadyUpToDate: analyze.alreadyUpToDate,
      graphStats: analyze.stats,
      embedStats: embed,
      fileFallbackChunks,
      symbolStats: {
        totalSymbols: symRead.symbols.length,
        skipped: symRead.skipped,
        countsByLabel: symRead.counts,
      },
    };
  });
}

// ─── File-fallback walker (Fix C) ────────────────────────

/**
 * Directories we never descend into. These either contain build artifacts
 * (no semantic value), VCS internals (binary blobs), or vendored deps
 * (already covered by their own indexed repos, if at all). Set lookups
 * are O(1) so this stays fast on large monorepos.
 *
 * Keep this list intentionally tight — adding more directories silently
 * shrinks coverage. A user who ASKS about something in `dist/` should at
 * worst get "I don't see it" rather than have it eaten by the walker.
 */
const SKIP_DIRS = new Set([
  '.git',
  '.gitnexus',
  'node_modules',
  '.next',
  '.turbo',
  '.cache',
  '.parcel-cache',
  'dist',
  'build',
  'out',
  'coverage',
  '.nyc_output',
  '.venv',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  'target', // rust / java
  'vendor', // go / php
]);

/**
 * File extensions worth chunking as fallback. We allow source code AND
 * structured config (.json/.yaml/.toml) AND docs (.md/.mdx/.txt) because
 * users routinely ask about config keys and README sections that no
 * symbol-extractor would surface. Lockfiles (.lock) and minified bundles
 * (.min.js, .map) are excluded — they're high-byte / low-signal.
 *
 * The whitelist is preferred over a blacklist because new languages
 * landing in the repo would otherwise silently get embedded with random
 * binary content and poison retrieval.
 */
const FALLBACK_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.swift',
  '.rb',
  '.php',
  '.cs',
  '.cpp',
  '.cc',
  '.c',
  '.h',
  '.hpp',
  '.sh',
  '.bash',
  '.zsh',
  '.sql',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.md',
  '.mdx',
  '.txt',
  '.env.example',
]);

/** Files whose names we always include even without a matching extension. */
const FALLBACK_BARE_FILES = new Set([
  'Dockerfile',
  'Makefile',
  'Procfile',
  'README',
  'LICENSE',
]);

/**
 * Walk `repoPath` and return relative file paths eligible for the file-
 * fallback chunker. Excludes:
 *   - directories in SKIP_DIRS;
 *   - files NOT in FALLBACK_EXTS / FALLBACK_BARE_FILES;
 *   - files already covered by a symbol chunk (`alreadyCovered`);
 *   - lockfiles & sourcemaps (low signal, high byte cost).
 *
 * Pure async/await + readdir(withFileTypes) — no third-party deps.
 */
async function listFallbackFiles(
  repoPath: string,
  alreadyCovered: Set<string>,
): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // perms / race — skip silently
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        if (e.name.startsWith('.')) {
          // Allow `.github`, `.claude`, etc. (often hold useful docs/configs)
          // but skip other dotdirs by default. The SKIP_DIRS set above
          // already lists the noisy ones explicitly.
          if (!['.github', '.claude', '.vscode'].includes(e.name)) continue;
        }
        await walk(join(dir, e.name));
        continue;
      }
      if (!e.isFile()) continue;
      const name = e.name;
      // Skip lockfiles + sourcemaps + minified bundles.
      if (
        name.endsWith('.lock') ||
        name.endsWith('.map') ||
        name.endsWith('.min.js') ||
        name.endsWith('.min.css') ||
        name === 'package-lock.json' ||
        name === 'pnpm-lock.yaml' ||
        name === 'yarn.lock' ||
        name === 'Cargo.lock' ||
        name === 'poetry.lock'
      ) {
        continue;
      }
      const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
      if (!FALLBACK_EXTS.has(ext) && !FALLBACK_BARE_FILES.has(name)) continue;

      // Path relative to repo root, normalized to forward slashes so it
      // matches gitnexus' `filePath` convention exactly (we use it as
      // a key against `alreadyCovered`).
      const rel = relative(repoPath, join(dir, name)).split(sep).join('/');
      if (alreadyCovered.has(rel)) continue;
      out.push(rel);
    }
  }

  await walk(repoPath);
  return out;
}

export const _internal = { listFallbackFiles, SKIP_DIRS, FALLBACK_EXTS };
