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
 *   embedAndStore → push chunks to Postgres+pgvector
 *
 * NOTE: runFullAnalysis writes straight into `${repoPath}/.gitnexus/`
 * because gitnexus 1.6 doesn't take an output-dir override. The atomic
 * `.gitnexus.tmp` swap ships unused for now but is exported so a future
 * PR can wire it once we have the override.
 */
import { chunkSymbol } from './chunker.js';
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
    for (const sym of symRead.symbols) {
      const chunk = chunkSymbol(loc.repoId, sym);
      if (chunk) prepared.push(chunk);
    }

    input.onProgress?.(
      'embed',
      `Embedding ${prepared.length} chunks (${symRead.symbols.length} symbols)...`,
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
      symbolStats: {
        totalSymbols: symRead.symbols.length,
        skipped: symRead.skipped,
        countsByLabel: symRead.counts,
      },
    };
  });
}
