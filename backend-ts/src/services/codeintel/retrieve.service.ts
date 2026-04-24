/**
 * RetrievalService — hybrid search over the code knowledge base.
 *
 * Three retrieval legs run in parallel and are fused via Reciprocal Rank
 * Fusion (RRF, K=60):
 *
 *   1. **Vector leg** — pgvector kNN over `chunks.embedding` using
 *      cosine distance (`<=>`). One round-trip per query, scoped by
 *      `repo_id`. HNSW index handles the top-k probe; we set
 *      `hnsw.ef_search` per-statement to trade recall vs. latency.
 *
 *   2. **Lexical leg** — LadybugDB FTS over Function/Class/Method/
 *      Interface nodes via `CALL QUERY_FTS_INDEX(...)`. Returns
 *      symbol-level hits with `(filePath, startLine, endLine)` so we
 *      can join back to chunks deterministically (NOT by symbol_uid —
 *      our chunker UID format may diverge slightly from the gitnexus
 *      `id` field across versions; line ranges are version-stable).
 *
 *   3. **Path/literal leg** — direct `ILIKE` match against `file_path`
 *      and `content` for each non-stopword token in the query. Catches
 *      queries that contain route literals (`/sdlc/start`), filenames
 *      (`SdlcPanel.tsx`), exact identifiers (`runSdlcStream`) — cases
 *      where vector embeddings are weak (rare/synthetic tokens) AND the
 *      LadybugDB FTS isn't available (frontend, configs, doc files).
 *      Token-match count drives the rank, so a chunk hitting two query
 *      tokens beats one hitting just one.
 *
 * RRF formula (Cormack et al. 2009):
 *
 *     score(d) = Σ_leg  1 / (K + rank_leg(d))      with K = 60
 *
 *   - K=60 is the de-facto default; small enough that top ranks
 *     dominate, large enough that mid-rank agreement still matters.
 *   - Ties broken by raw vector distance (smaller = better).
 *
 * Failure model: each leg is independently try/caught. If FTS is
 * unavailable (no LadybugDB at scan-time, or gitnexus not installed)
 * we degrade gracefully to vector + path. If Postgres is down we
 * surface that error from all three legs (vector + path) — the trace
 * records which legs actually contributed.
 *
 * Caller contract:
 *   - Empty result set is a *valid* answer ("we found nothing relevant").
 *     The router decides whether to fall back to `kb.insights`.
 *   - We do NOT touch the ai/dispatcher here — retrieval is offline-
 *     capable and must remain testable without an OpenAI key. The
 *     embedder is injected.
 */
import { sql } from 'drizzle-orm';

import { pg } from '../../db/pg/client.js';
import { type Embedder, openaiEmbedder } from './embedding.service.js';
import type { LbugAdapter } from './lbug.reader.js';

/** RRF constant. Lucene/Vespa/Pinecone all default to 60. */
export const RRF_K = 60;

/** Per-leg recall budget. Higher = more candidates considered for fusion. */
const VECTOR_TOP_K = 50;
const LEXICAL_TOP_K = 50;
const PATH_TOP_K = 50;

/** HNSW probe width. 40 is a safe default for 1k-100k vectors. */
const HNSW_EF_SEARCH = 40;

/**
 * Tokens we never bother matching as path/literal hints — they're either
 * too generic (would match nearly every chunk) or are pure English
 * scaffolding around the actual identifier the user cares about. Anything
 * shorter than PATH_MIN_TOKEN_LEN is also dropped.
 */
const PATH_MIN_TOKEN_LEN = 4;
const PATH_STOPWORDS = new Set([
  'show',
  'find',
  'tell',
  'give',
  'list',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'how',
  'this',
  'that',
  'with',
  'from',
  'into',
  'about',
  'function',
  'functions',
  'class',
  'classes',
  'method',
  'methods',
  'call',
  'calls',
  'code',
  'file',
  'files',
  'flow',
  'chain',
  'please',
  'explain',
  'using',
  'used',
  'have',
  'does',
  'do',
  'is',
  'in',
  'on',
  'of',
  'to',
  'for',
  'and',
  'or',
  'a',
  'an',
  'the',
  'me',
  'my',
  'i',
]);

/** Tables LadybugDB exposes FTS indexes on. Must match gitnexus' indexer. */
const FTS_TABLES: ReadonlyArray<{ table: string; index: string }> = [
  { table: 'Function', index: 'function_fts' },
  { table: 'Class', index: 'class_fts' },
  { table: 'Method', index: 'method_fts' },
  { table: 'Interface', index: 'interface_fts' },
];

/** Public retrieval result. `score` is the fused RRF score. */
export interface RetrievedChunk {
  id: string;
  repoId: string;
  source: string;
  symbolUid: string | null;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  /** Fused RRF score (higher = better). */
  score: number;
  /** Per-leg ranks for trace/debugging. -1 if leg did not surface this chunk. */
  ranks: { vector: number; lexical: number; path: number };
}

export interface RetrieveOptions {
  /** Final result count after fusion. */
  topK?: number;
  /** Override default ef_search (e.g. lower for latency-critical paths). */
  efSearch?: number;
  /** DI seam for tests. */
  embedder?: Embedder;
  /** DI seam for tests; if omitted, lazy-loads gitnexus' lbug adapter. */
  lbug?: { adapter: LbugAdapter; lbugPath: string };
  /** Skip the lexical leg explicitly (vector-only mode). */
  vectorOnly?: boolean;
  /** Skip the path/literal leg (e.g. test isolation). */
  skipPathLeg?: boolean;
}

export interface RetrieveTrace {
  /** Number of unique chunks considered before fusion. */
  candidateCount: number;
  /** Hits returned by each leg before fusion. */
  vectorHits: number;
  lexicalHits: number;
  pathHits: number;
  /** Whether each leg actually ran (false = skipped or errored). */
  vectorOk: boolean;
  lexicalOk: boolean;
  pathOk: boolean;
  /** First error from each leg (if any) — surfaced for debugging. */
  vectorError?: string;
  lexicalError?: string;
  pathError?: string;
  /** Final result count after fusion + topK clamp. */
  returned: number;
}

export interface RetrieveResult {
  chunks: RetrievedChunk[];
  trace: RetrieveTrace;
}

// ─── Vector leg ──────────────────────────────────────────

interface VectorRow {
  id: string;
  repo_id: string;
  source: string;
  symbol_uid: string | null;
  file_path: string;
  start_line: number;
  end_line: number;
  content: string;
  /** pgvector cosine distance (0 = identical, 2 = opposite). */
  distance: number;
}

/** Format a JS number[] as the pgvector literal `[a,b,c,...]`. */
function toPgVector(v: number[]): string {
  // No trailing whitespace — pgvector accepts the compact form.
  return `[${v.join(',')}]`;
}

async function vectorLeg(
  repoId: string,
  queryVec: number[],
  topK: number,
  efSearch: number,
): Promise<{ rows: VectorRow[]; error?: string }> {
  const vecLit = toPgVector(queryVec);
  try {
    // SET LOCAL is scoped to this transaction; no leak to neighbouring queries.
    // We wrap in a single `transaction` so the SET applies to the SELECT.
    const rows = (await pg.transaction(async (tx) => {
      await tx.execute(sql.raw(`SET LOCAL hnsw.ef_search = ${efSearch}`));
      const out = (await tx.execute(sql`
        SELECT id, repo_id, source, symbol_uid, file_path,
               start_line, end_line, content,
               (embedding <=> ${vecLit}::vector) AS distance
        FROM chunks
        WHERE repo_id = ${repoId}
        ORDER BY embedding <=> ${vecLit}::vector
        LIMIT ${topK}
      `)) as unknown as VectorRow[];
      return out;
    })) as VectorRow[];
    return { rows };
  } catch (e) {
    return { rows: [], error: (e as Error).message };
  }
}

// ─── Lexical leg ─────────────────────────────────────────

interface FtsRow {
  filePath: string;
  startLine: number;
  endLine: number;
  score: number;
}

/**
 * Escape single quotes / backslashes in user input before string-
 * interpolating into Cypher. We can't use parameterised CALL — the
 * LadybugDB FTS procedure takes a string literal.
 */
function escapeCypherString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "''");
}

async function lexicalLeg(
  query: string,
  topK: number,
  lbug: { adapter: LbugAdapter; lbugPath: string } | null,
): Promise<{ rows: FtsRow[]; error?: string }> {
  if (!lbug) return { rows: [], error: 'lbug-adapter not available' };
  const escaped = escapeCypherString(query);
  try {
    const all = await lbug.adapter.withLbugDb(lbug.lbugPath, async () => {
      const merged = new Map<string, FtsRow>();
      for (const { table, index } of FTS_TABLES) {
        const cypher = `
          CALL QUERY_FTS_INDEX('${table}', '${index}', '${escaped}', conjunctive := false)
          RETURN node, score
          ORDER BY score DESC
          LIMIT ${topK}
        `;
        let rows: unknown[];
        try {
          rows = await lbug.adapter.executeQuery(cypher);
        } catch {
          // Per-table failure (missing index, etc.) — skip but keep going.
          continue;
        }
        for (const r of rows as Array<{
          node?: { filePath?: string; startLine?: number | bigint; endLine?: number | bigint };
          score?: number;
        }>) {
          const node = r.node ?? {};
          const filePath = node.filePath ?? '';
          if (!filePath) continue;
          const startLine = Number(node.startLine ?? 0);
          const endLine = Number(node.endLine ?? 0);
          const score = typeof r.score === 'number' ? r.score : 0;
          // Composite key — same symbol may appear in multiple tables
          // (e.g. a Method that also indexes under its declaring Class).
          const key = `${filePath}:${startLine}-${endLine}`;
          const existing = merged.get(key);
          if (existing) {
            existing.score += score;
          } else {
            merged.set(key, { filePath, startLine, endLine, score });
          }
        }
      }
      return Array.from(merged.values()).sort((a, b) => b.score - a.score);
    });
    return { rows: all.slice(0, topK) };
  } catch (e) {
    return { rows: [], error: (e as Error).message };
  }
}

/**
 * Resolve FTS hits → concrete chunks by joining on `(repo_id, file_path,
 * start_line, end_line)`. Returns rows in *the same order as `hits`* so
 * we preserve the lexical rank.
 *
 * We intentionally match on line ranges rather than `symbol_uid` because
 * the chunker's UID is constructed from gitnexus' `id` which has not
 * been stable across versions; line ranges have been.
 */
async function resolveLexicalHits(repoId: string, hits: FtsRow[]): Promise<VectorRow[]> {
  if (hits.length === 0) return [];
  // Build a (start,end,path) tuple list for a single round-trip.
  // Using a CTE with VALUES keeps the planner from doing N seq scans.
  const values = hits
    .map(
      (h, i) => `(${i}::int, ${h.startLine}::int, ${h.endLine}::int, ${pgQuote(h.filePath)}::text)`,
    )
    .join(',');

  const cte = `
    WITH wanted (rk, sl, el, fp) AS (VALUES ${values})
    SELECT c.id, c.repo_id, c.source, c.symbol_uid, c.file_path,
           c.start_line, c.end_line, c.content, w.rk
    FROM wanted w
    JOIN chunks c
      ON c.repo_id = ${pgQuote(repoId)}
     AND c.file_path = w.fp
     AND c.start_line = w.sl
     AND c.end_line = w.el
    ORDER BY w.rk
  `;
  const out = (await pg.execute(sql.raw(cte))) as unknown as Array<VectorRow & { rk: number }>;
  // distance is unknown here — FTS doesn't give us a comparable metric.
  // We synthesise +Infinity so vector tiebreak prefers true vector hits.
  return out.map((r) => ({
    id: r.id,
    repo_id: r.repo_id,
    source: r.source,
    symbol_uid: r.symbol_uid,
    file_path: r.file_path,
    start_line: r.start_line,
    end_line: r.end_line,
    content: r.content,
    distance: Number.POSITIVE_INFINITY,
  }));
}

/** Quote a string for safe SQL literal interpolation (single quotes only). */
function pgQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

// ─── Path / literal leg ──────────────────────────────────

/**
 * Tokenize the user query for the path leg. Strategy:
 *   - Split on whitespace AND on common code separators (`/`, `.`, `:`, `(`,
 *     `)`, `,`, `;`) so a route literal like `/sdlc/start` yields the
 *     useful tokens `sdlc` and `start`. The *original* spaces-only split
 *     terms are also kept so multi-word identifiers (rare, but possible)
 *     still produce ILIKE candidates.
 *   - Drop tokens shorter than PATH_MIN_TOKEN_LEN.
 *   - Drop English stopwords (PATH_STOPWORDS).
 *   - Lowercase and dedupe.
 *
 * We intentionally keep tokens that contain digits or mixed case in the
 * raw query — the ILIKE in pathLeg() is case-insensitive so casing
 * doesn't matter, but identifiers like `runSdlcStream` benefit from also
 * being looked up as the substring `sdlcstream`.
 */
function tokenizeForPathLeg(query: string): string[] {
  const sep = /[^A-Za-z0-9_]+/;
  const out = new Set<string>();
  for (const raw of query.split(sep)) {
    const t = raw.trim().toLowerCase();
    if (t.length < PATH_MIN_TOKEN_LEN) continue;
    if (PATH_STOPWORDS.has(t)) continue;
    out.add(t);
  }
  return Array.from(out);
}

interface PathRow extends VectorRow {
  /** Number of distinct query tokens this chunk contains. Drives rank. */
  tokenMatches: number;
}

/**
 * Run the path/literal leg. Each token contributes one ILIKE clause OR'd
 * together; we score chunks by *distinct token-match count* so a chunk
 * hitting two query tokens beats one hitting just one. Within ties, smaller
 * chunks win (a small focused match is more relevant than a giant blob).
 *
 * Implementation note: we issue ONE SQL statement that ORs every token
 * pattern, then count matches client-side from `content` + `file_path`.
 * This is N×M work but N is small (top-k after the SQL LIMIT) and M is
 * small (token count, capped). Avoids N round-trips OR a complex SQL
 * `EXISTS` per token.
 */
async function pathLeg(
  repoId: string,
  query: string,
  topK: number,
): Promise<{ rows: PathRow[]; error?: string; tokens: string[] }> {
  const tokens = tokenizeForPathLeg(query);
  if (tokens.length === 0) {
    // Nothing useful to look up — soft-fail (NOT an error).
    return { rows: [], tokens };
  }
  // Cap tokens at 8: more than that and the OR-list explodes the planner
  // without improving precision. We keep the longest (most specific) ones.
  const ranked = [...tokens].sort((a, b) => b.length - a.length).slice(0, 8);

  const orClauses = ranked
    .map((t) => `(c.content ILIKE ${pgQuote(`%${t}%`)} OR c.file_path ILIKE ${pgQuote(`%${t}%`)})`)
    .join(' OR ');

  const sqlText = `
    SELECT c.id, c.repo_id, c.source, c.symbol_uid, c.file_path,
           c.start_line, c.end_line, c.content
    FROM chunks c
    WHERE c.repo_id = ${pgQuote(repoId)}
      AND (${orClauses})
    LIMIT ${topK * 4}
  `;

  try {
    const rows = (await pg.execute(sql.raw(sqlText))) as unknown as VectorRow[];
    // Score client-side by distinct token-match count.
    const scored: PathRow[] = rows.map((r) => {
      const hay = `${r.file_path}\n${r.content}`.toLowerCase();
      let n = 0;
      for (const t of ranked) {
        if (hay.includes(t)) n++;
      }
      return {
        ...r,
        // We didn't compute distance here; mark unknown so RRF tiebreak
        // doesn't pretend a path-only hit has a perfect vector score.
        distance: Number.POSITIVE_INFINITY,
        tokenMatches: n,
      };
    });
    scored.sort((a, b) => {
      if (b.tokenMatches !== a.tokenMatches) return b.tokenMatches - a.tokenMatches;
      // Tiebreak: prefer shorter (more focused) chunks.
      return a.content.length - b.content.length;
    });
    return { rows: scored.slice(0, topK), tokens: ranked };
  } catch (e) {
    return { rows: [], error: (e as Error).message, tokens: ranked };
  }
}

// ─── Fusion ──────────────────────────────────────────────

interface Candidate {
  row: VectorRow;
  vectorRank: number;
  lexicalRank: number;
  pathRank: number;
  /** Best (lowest) cosine distance seen — for tiebreaker. */
  bestDistance: number;
}

type LegName = 'vector' | 'lexical' | 'path';

/**
 * Reciprocal Rank Fusion across all three legs. Returns sorted top-K with
 * attached per-leg ranks for trace/debug. Order of upserts doesn't matter:
 * scoring is purely positional, and tiebreaks fall through to vector
 * distance which is leg-independent.
 */
function rrfFuse(
  vectorRows: VectorRow[],
  lexicalRows: VectorRow[],
  pathRows: VectorRow[],
  topK: number,
): RetrievedChunk[] {
  const byId = new Map<string, Candidate>();

  const upsert = (row: VectorRow, rank: number, leg: LegName) => {
    const existing = byId.get(row.id);
    if (existing) {
      if (leg === 'vector') existing.vectorRank = rank;
      else if (leg === 'lexical') existing.lexicalRank = rank;
      else existing.pathRank = rank;
      if (row.distance < existing.bestDistance) {
        existing.bestDistance = row.distance;
        existing.row = row; // prefer the row that has a real distance
      }
    } else {
      byId.set(row.id, {
        row,
        vectorRank: leg === 'vector' ? rank : -1,
        lexicalRank: leg === 'lexical' ? rank : -1,
        pathRank: leg === 'path' ? rank : -1,
        bestDistance: row.distance,
      });
    }
  };

  for (let i = 0; i < vectorRows.length; i++) upsert(vectorRows[i]!, i + 1, 'vector');
  for (let i = 0; i < lexicalRows.length; i++) upsert(lexicalRows[i]!, i + 1, 'lexical');
  for (let i = 0; i < pathRows.length; i++) upsert(pathRows[i]!, i + 1, 'path');

  const scored = Array.from(byId.values()).map((c) => {
    const vScore = c.vectorRank > 0 ? 1 / (RRF_K + c.vectorRank) : 0;
    const lScore = c.lexicalRank > 0 ? 1 / (RRF_K + c.lexicalRank) : 0;
    const pScore = c.pathRank > 0 ? 1 / (RRF_K + c.pathRank) : 0;
    return { c, score: vScore + lScore + pScore };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tiebreak: prefer smaller cosine distance (better vector match).
    return a.c.bestDistance - b.c.bestDistance;
  });

  return scored.slice(0, topK).map(({ c, score }) => ({
    id: c.row.id,
    repoId: c.row.repo_id,
    source: c.row.source,
    symbolUid: c.row.symbol_uid,
    filePath: c.row.file_path,
    startLine: c.row.start_line,
    endLine: c.row.end_line,
    content: c.row.content,
    score,
    ranks: { vector: c.vectorRank, lexical: c.lexicalRank, path: c.pathRank },
  }));
}

// ─── Public API ──────────────────────────────────────────

export async function retrieve(
  repoId: string,
  query: string,
  options: RetrieveOptions = {},
): Promise<RetrieveResult> {
  const topK = options.topK ?? 8;
  const efSearch = options.efSearch ?? HNSW_EF_SEARCH;
  const embedder = options.embedder ?? openaiEmbedder;

  // Embed the query (one OpenAI round-trip). Tests inject a stub.
  const { vectors } = await embedder.embed([query]);
  // biome-ignore lint/style/noNonNullAssertion: we asked for 1 vector
  const queryVec = vectors[0]!;

  const lexicalEnabled = !options.vectorOnly;
  const pathEnabled = !options.skipPathLeg;

  const [vec, lex, path] = await Promise.all([
    vectorLeg(repoId, queryVec, VECTOR_TOP_K, efSearch),
    lexicalEnabled
      ? lexicalLeg(query, LEXICAL_TOP_K, options.lbug ?? null)
      : Promise.resolve({ rows: [] as FtsRow[], error: 'vector-only mode' }),
    pathEnabled
      ? pathLeg(repoId, query, PATH_TOP_K)
      : Promise.resolve({ rows: [] as PathRow[], tokens: [] as string[], error: 'path leg disabled' }),
  ]);

  const lexicalChunks = lex.rows.length > 0 ? await resolveLexicalHits(repoId, lex.rows) : [];

  const fused = rrfFuse(vec.rows, lexicalChunks, path.rows, topK);

  return {
    chunks: fused,
    trace: {
      candidateCount: new Set([
        ...vec.rows.map((r) => r.id),
        ...lexicalChunks.map((r) => r.id),
        ...path.rows.map((r) => r.id),
      ]).size,
      vectorHits: vec.rows.length,
      lexicalHits: lexicalChunks.length,
      pathHits: path.rows.length,
      vectorOk: vec.error === undefined,
      lexicalOk: lex.error === undefined,
      pathOk: path.error === undefined,
      ...(vec.error ? { vectorError: vec.error } : {}),
      ...(lex.error ? { lexicalError: lex.error } : {}),
      ...(path.error ? { pathError: path.error } : {}),
      returned: fused.length,
    },
  };
}

/** Test hooks. */
export const _internal = {
  rrfFuse,
  toPgVector,
  escapeCypherString,
  pgQuote,
  tokenizeForPathLeg,
  pathLeg,
  RRF_K,
  VECTOR_TOP_K,
  LEXICAL_TOP_K,
  PATH_TOP_K,
};
