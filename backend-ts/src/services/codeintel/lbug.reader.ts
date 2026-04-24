/**
 * LbugReader — read code symbols from the LadybugDB graph that gitnexus
 * just wrote to `${repoPath}/.gitnexus/`.
 *
 * Why read from the on-disk DB instead of `pipelineResult` from
 * `runFullAnalysis`?
 *
 *   1. `pipelineResult` is typed `any` in gitnexus 1.6 — using it would
 *      hard-couple us to private internals.
 *   2. We re-read on every retrieve in dev anyway, so a typed Cypher
 *      reader pays for itself the first time we change the chunking
 *      strategy.
 *   3. The MCP tools that ship with gitnexus all go through Cypher —
 *      this keeps us on the supported integration surface.
 *
 * We pull from the four primary symbol tables (Function, Class, Method,
 * Interface). Files / Folders are skipped here — we keep symbol-level
 * granularity to match the chunker's contract.
 *
 * Concurrency: this module assumes the caller is already holding the
 * per-repo lock (lock.ts.runWithLock). The underlying `withLbugDb`
 * helper does its own retry-on-busy but cannot prevent a concurrent
 * writer from corrupting reads mid-flight.
 */
import { resolve } from 'node:path';

import type { SymbolInput } from './types.js';

/** Cypher row shape — must match the projection in `LIST_SYMBOLS_QUERY`. */
interface SymbolRow {
  uid: string;
  label: string;
  name: string;
  filePath: string;
  startLine: number | bigint;
  endLine: number | bigint;
  content: string | null;
  description: string | null;
}

/**
 * UNION across the four primary symbol tables. We deliberately avoid
 * `MATCH (n) WHERE label(n) IN [...]` because LadybugDB rejects mixed-
 * label projections in a single MATCH.
 *
 * Empty `content` (some language extractors don't capture source for
 * every node kind) is filtered out at read time, not in Cypher — that
 * way we can surface the count of skipped symbols in the result for
 * debugging.
 */
const LIST_SYMBOLS_QUERY = `
  MATCH (n:Function)
  RETURN n.id AS uid, "Function" AS label, n.name AS name,
         n.filePath AS filePath, n.startLine AS startLine,
         n.endLine AS endLine, n.content AS content,
         n.description AS description
  UNION ALL
  MATCH (n:Class)
  RETURN n.id AS uid, "Class" AS label, n.name AS name,
         n.filePath AS filePath, n.startLine AS startLine,
         n.endLine AS endLine, n.content AS content,
         n.description AS description
  UNION ALL
  MATCH (n:Method)
  RETURN n.id AS uid, "Method" AS label, n.name AS name,
         n.filePath AS filePath, n.startLine AS startLine,
         n.endLine AS endLine, n.content AS content,
         n.description AS description
  UNION ALL
  MATCH (n:Interface)
  RETURN n.id AS uid, "Interface" AS label, n.name AS name,
         n.filePath AS filePath, n.startLine AS startLine,
         n.endLine AS endLine, n.content AS content,
         n.description AS description
`;

export interface ReadSymbolsResult {
  symbols: SymbolInput[];
  /** Counts by label for observability. */
  counts: Record<string, number>;
  /** Symbols dropped because content was missing/empty. */
  skipped: number;
}

/**
 * DI seam for the gitnexus lbug-adapter. Tests pass a fake; production
 * lazy-loads the real module. Lazy because `@ladybugdb/core` does
 * native loading on import and we don't want that on processes that
 * never index code.
 */
export interface LbugAdapter {
  withLbugDb<T>(dbPath: string, fn: () => Promise<T>): Promise<T>;
  executeQuery(cypher: string): Promise<unknown[]>;
}

let cachedAdapter: LbugAdapter | null = null;

async function loadDefaultAdapter(): Promise<LbugAdapter | null> {
  if (cachedAdapter) return cachedAdapter;
  try {
    // Deep import — gitnexus has no top-level export.
    const mod = (await import('gitnexus/dist/core/lbug/lbug-adapter.js')) as unknown as LbugAdapter;
    cachedAdapter = {
      withLbugDb: mod.withLbugDb.bind(mod),
      executeQuery: mod.executeQuery.bind(mod),
    };
    return cachedAdapter;
  } catch {
    return null;
  }
}

async function loadStorageHelper(): Promise<((repoPath: string) => { lbugPath: string }) | null> {
  try {
    const mod = (await import('gitnexus/dist/storage/repo-manager.js')) as unknown as {
      getStoragePaths: (repoPath: string) => {
        storagePath: string;
        lbugPath: string;
        metaPath: string;
      };
    };
    return (repoPath) => ({ lbugPath: mod.getStoragePaths(repoPath).lbugPath });
  } catch {
    return null;
  }
}

/** Coerce LadybugDB BigInt line numbers to regular numbers. */
function toNumber(v: number | bigint): number {
  return typeof v === 'bigint' ? Number(v) : v;
}

/** Compose a stable UID matching the gitnexus convention `<Label>:<filePath>:<name>`. */
function symbolUid(row: SymbolRow): string {
  // Prefer the DB-stored id when present; falls back to the canonical
  // label-path-name form for older databases that don't populate `n.id`.
  if (row.uid && row.uid.length > 0) return row.uid;
  return `${row.label}:${row.filePath}:${row.name}`;
}

export interface ReadSymbolsOptions {
  /** Inject a fake adapter in tests. */
  adapter?: LbugAdapter;
  /** Inject a fake path resolver in tests. */
  resolveLbugPath?: (repoPath: string) => string;
}

/**
 * Read every Function/Class/Method/Interface symbol from the repo's
 * LadybugDB and return them as `SymbolInput[]` ready for the chunker.
 *
 * Returns an empty result (NOT throws) when the lbug adapter or storage
 * helper aren't loadable — this lets the orchestrator fail soft when
 * gitnexus isn't installed or the DB hasn't been built yet.
 */
export async function readRepoSymbols(
  repoPath: string,
  options: ReadSymbolsOptions = {},
): Promise<ReadSymbolsResult> {
  const adapter = options.adapter ?? (await loadDefaultAdapter());
  if (!adapter) {
    return { symbols: [], counts: {}, skipped: 0 };
  }

  let lbugPath: string;
  if (options.resolveLbugPath) {
    lbugPath = options.resolveLbugPath(repoPath);
  } else {
    const helper = await loadStorageHelper();
    if (!helper) return { symbols: [], counts: {}, skipped: 0 };
    lbugPath = helper(resolve(repoPath)).lbugPath;
  }

  const rows = (await adapter.withLbugDb(lbugPath, () =>
    adapter.executeQuery(LIST_SYMBOLS_QUERY),
  )) as SymbolRow[];

  const counts: Record<string, number> = {};
  const symbols: SymbolInput[] = [];
  let skipped = 0;

  for (const row of rows) {
    const content = (row.content ?? '').trim();
    if (!content) {
      skipped += 1;
      continue;
    }
    counts[row.label] = (counts[row.label] ?? 0) + 1;
    const sym: SymbolInput = {
      uid: symbolUid(row),
      name: row.name,
      filePath: row.filePath,
      startLine: toNumber(row.startLine),
      endLine: toNumber(row.endLine),
      content,
    };
    if (row.description) sym.docstring = row.description;
    symbols.push(sym);
  }

  return { symbols, counts, skipped };
}

/** Test-only: drop the cached adapter so a fake can be re-injected. */
export function _resetAdapter(): void {
  cachedAdapter = null;
}
