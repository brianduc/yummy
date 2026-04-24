/**
 * EmbeddingService — converts PreparedChunks into row inserts on `chunks`.
 *
 * Pipeline per call:
 *   1. Filter out chunks whose (repo_id, symbol_uid|file_path, content_sha)
 *      already exists → "incremental embed". Saves API spend on re-scans
 *      where most code is unchanged.
 *   2. Batch the remainder into groups of env.EMBEDDINGS_BATCH_SIZE.
 *   3. Call OpenAI embeddings API per batch (one HTTP round-trip each).
 *   4. UPSERT into `chunks` so a partial failure mid-batch doesn't block
 *      later retries.
 *
 * The service is stateless; callers (scan service / tests) pass their own
 * chunks. Postgres connection comes from src/db/pg/client.ts.
 */
import { inArray } from 'drizzle-orm';
import OpenAI from 'openai';

import { env } from '../../config/env.js';
import { pg } from '../../db/pg/client.js';
import { chunks as chunksTable } from '../../db/pg/schema.js';
import { limiters, withRetryOn429 } from '../ai/rate-limiter.js';
import { countTokens } from '../ai/token-counter.js';
import type { EmbeddedChunk, PreparedChunk } from './types.js';

export interface EmbedStats {
  prepared: number;
  reused: number;
  embedded: number;
  inserted: number;
  tokensBilled: number;
}

/** Pluggable embedder — production uses OpenAI; tests inject a stub. */
export interface Embedder {
  embed(inputs: string[]): Promise<{
    vectors: number[][];
    totalTokens: number;
  }>;
}

let _client: OpenAI | null = null;
function openaiClient(): OpenAI {
  if (_client) return _client;
  if (!env.OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY is required for the embedding service (EMBEDDINGS_PROVIDER=openai)',
    );
  }
  _client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return _client;
}

export const openaiEmbedder: Embedder = {
  async embed(inputs) {
    if (inputs.length === 0) return { vectors: [], totalTokens: 0 };
    const modelName = env.EMBEDDINGS_MODEL;
    const limiter = limiters.forEmbedding(modelName);
    // Sync limiter cfg with current env (env-driven defaults; same pattern as
    // providers/openai.ts so a tier upgrade just needs an env var change).
    limiter.cfg.tpm = env.OPENAI_TPM_LIMIT;
    limiter.cfg.perRequestMax = env.OPENAI_PER_REQUEST_MAX;
    limiter.cfg.retryMax = env.OPENAI_RETRY_MAX;
    if (limiter.cfg.perRequestMax > limiter.cfg.tpm) {
      limiter.cfg.perRequestMax = limiter.cfg.tpm;
    }

    // Pre-count each input so we can bin-pack into sub-batches that each
    // stay under perRequestMax. Splitting is essential because the caller
    // (embedAndStore) batches by *count* (EMBEDDINGS_BATCH_SIZE=64) not by
    // tokens — a dense batch of large symbols can easily exceed 200k tokens
    // in one request.
    const tokenCounts = inputs.map((s) => countTokens(modelName, s));
    const subBatches = packByTokenBudget(inputs, tokenCounts, limiter.cfg.perRequestMax);

    const allVectors: number[][] = [];
    let totalTokens = 0;
    for (const sub of subBatches) {
      const subTokens = sub.tokens;
      const lease = await limiter.acquire(subTokens);
      try {
        const resp = await withRetryOn429(
          () =>
            openaiClient().embeddings.create({
              model: modelName,
              input: sub.inputs,
            }),
          { retryMax: limiter.cfg.retryMax, retryBaseMs: limiter.cfg.retryBaseMs },
        );
        const actual = resp.usage?.total_tokens ?? subTokens;
        lease.commit(actual);
        totalTokens += actual;
        for (const d of resp.data) allVectors.push(d.embedding);
      } catch (e) {
        lease.release();
        throw e;
      }
    }
    return { vectors: allVectors, totalTokens };
  },
};

/**
 * Bin-pack `inputs` (with their pre-counted `tokens`) into sub-batches that
 * each stay <= `maxTokens`. Greedy first-fit by index — preserves caller
 * ordering so the returned vectors line up with the input array after
 * concatenation.
 *
 * Single inputs that exceed `maxTokens` get a sub-batch of their own and
 * will be rejected by the limiter's per-request guard at `acquire()` time
 * with HttpError(413). That's the correct behaviour: one chunk shouldn't
 * blow past the cap, and silently truncating it would corrupt the embedding.
 */
function packByTokenBudget(
  inputs: string[],
  tokens: number[],
  maxTokens: number,
): Array<{ inputs: string[]; tokens: number }> {
  const out: Array<{ inputs: string[]; tokens: number }> = [];
  let cur: { inputs: string[]; tokens: number } = { inputs: [], tokens: 0 };
  for (let i = 0; i < inputs.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: i is in range by construction
    const inp = inputs[i]!;
    // biome-ignore lint/style/noNonNullAssertion: i is in range by construction
    const tk = tokens[i]!;
    if (cur.inputs.length > 0 && cur.tokens + tk > maxTokens) {
      out.push(cur);
      cur = { inputs: [], tokens: 0 };
    }
    cur.inputs.push(inp);
    cur.tokens += tk;
  }
  if (cur.inputs.length > 0) out.push(cur);
  return out;
}

/**
 * Crockford-base32 ULID, 26 chars. Time component (10) + 80 bits randomness.
 * Tiny inline impl to avoid pulling another dep just for IDs.
 */
const CROCK = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function ulid(): string {
  let time = Date.now();
  const t: string[] = new Array(10);
  for (let i = 9; i >= 0; i--) {
    // CROCK.length === 32, so `time % 32` is always a valid index.
    // biome-ignore lint/style/noNonNullAssertion: bounded index, see above
    t[i] = CROCK[time % 32]!;
    time = Math.floor(time / 32);
  }
  let out = t.join('');
  for (let i = 0; i < 16; i++) {
    // Math.floor(Math.random() * 32) ∈ [0, 31] — always a valid CROCK index.
    // biome-ignore lint/style/noNonNullAssertion: bounded index, see above
    out += CROCK[Math.floor(Math.random() * 32)]!;
  }
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Returns the subset of input chunks whose `content_sha` is NOT already
 * present in `chunks` for the same `repo_id` (+ `symbol_uid` if any).
 */
async function filterAlreadyEmbedded(prepared: PreparedChunk[]): Promise<PreparedChunk[]> {
  if (prepared.length === 0) return [];
  const repoIds = [...new Set(prepared.map((p) => p.repoId))];
  const rows = await pg
    .select({
      repoId: chunksTable.repoId,
      symbolUid: chunksTable.symbolUid,
      filePath: chunksTable.filePath,
      contentSha: chunksTable.contentSha,
    })
    .from(chunksTable)
    .where(inArray(chunksTable.repoId, repoIds));

  const seen = new Set<string>();
  for (const r of rows) {
    seen.add(`${r.repoId}|${r.symbolUid ?? `doc:${r.filePath}`}|${r.contentSha}`);
  }
  return prepared.filter((p) => {
    const key = `${p.repoId}|${p.symbolUid ?? `doc:${p.filePath}`}|${p.contentSha}`;
    return !seen.has(key);
  });
}

async function embedBatch(batch: PreparedChunk[], embedder: Embedder): Promise<EmbeddedChunk[]> {
  if (batch.length === 0) return [];
  const { vectors, totalTokens } = await embedder.embed(batch.map((b) => b.content));
  if (vectors.length !== batch.length) {
    throw new Error(`Embedding count mismatch: requested ${batch.length}, got ${vectors.length}`);
  }
  // Distribute total tokens proportionally by character length.
  const totalChars = batch.reduce((n, b) => n + b.content.length, 0) || 1;
  const out: EmbeddedChunk[] = [];
  for (let i = 0; i < batch.length; i++) {
    // We just validated above that vectors.length === batch.length,
    // so both indices are in range.
    // biome-ignore lint/style/noNonNullAssertion: length-checked above
    const b = batch[i]!;
    // biome-ignore lint/style/noNonNullAssertion: length-checked above
    const vec = vectors[i]!;
    if (vec.length !== env.EMBEDDINGS_DIM) {
      throw new Error(
        `Embedding dim mismatch: expected ${env.EMBEDDINGS_DIM}, got ${vec.length} (model=${env.EMBEDDINGS_MODEL})`,
      );
    }
    out.push({
      ...b,
      id: ulid(),
      tokenCount: Math.round((b.content.length / totalChars) * totalTokens),
      embedding: vec,
    });
  }
  return out;
}

async function upsertChunks(rows: EmbeddedChunk[]): Promise<number> {
  if (rows.length === 0) return 0;
  // Drizzle's `vector` column accepts a number[] directly and serializes
  // it to the pgvector wire format. Do NOT pre-stringify — that produces
  // `"[...]"` and Postgres rejects it as invalid vector syntax.
  const values = rows.map((r) => ({
    id: r.id,
    repoId: r.repoId,
    source: r.source,
    symbolUid: r.symbolUid,
    filePath: r.filePath,
    startLine: r.startLine,
    endLine: r.endLine,
    contentSha: r.contentSha,
    content: r.content,
    tokenCount: r.tokenCount,
    embedding: r.embedding,
  }));
  // ON CONFLICT DO NOTHING — we already filtered duplicates upstream;
  // this guards against a race where the same repo is re-scanned twice.
  await pg.insert(chunksTable).values(values).onConflictDoNothing();
  return rows.length;
}

export async function embedAndStore(
  prepared: PreparedChunk[],
  embedder: Embedder = openaiEmbedder,
): Promise<EmbedStats> {
  const stats: EmbedStats = {
    prepared: prepared.length,
    reused: 0,
    embedded: 0,
    inserted: 0,
    tokensBilled: 0,
  };
  if (prepared.length === 0) return stats;

  const fresh = await filterAlreadyEmbedded(prepared);
  stats.reused = prepared.length - fresh.length;

  for (const batch of chunk(fresh, env.EMBEDDINGS_BATCH_SIZE)) {
    const embedded = await embedBatch(batch, embedder);
    stats.embedded += embedded.length;
    stats.tokensBilled += embedded.reduce((n, e) => n + e.tokenCount, 0);
    stats.inserted += await upsertChunks(embedded);
  }
  return stats;
}

export const _internal = { ulid, filterAlreadyEmbedded, embedBatch, packByTokenBudget };
