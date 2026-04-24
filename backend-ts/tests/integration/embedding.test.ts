/**
 * Integration test for EmbeddingService against a real Postgres+pgvector.
 *
 * SKIPS if POSTGRES_URL points to an unreachable server, so CI without
 * docker still goes green. To run locally:
 *   POSTGRES_PORT=55432 docker compose up -d postgres
 *   POSTGRES_URL=postgres://yummy:yummy@127.0.0.1:55432/yummy pnpm db:pg:migrate
 *   POSTGRES_URL=... pnpm vitest run tests/integration/embedding.test.ts
 *
 * Uses a dependency-injected fake Embedder to avoid hitting OpenAI.
 */
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.OPENAI_API_KEY ||= 'sk-test-fake';
process.env.DATABASE_URL = ':memory:';

const POSTGRES_URL = process.env.POSTGRES_URL ?? 'postgres://yummy:yummy@localhost:5432/yummy';

let pgReachable = false;
let pg: typeof import('../../src/db/pg/client.js').pg;
let chunksTable: typeof import('../../src/db/pg/schema.js').chunks;
let embeddingMod: typeof import('../../src/services/codeintel/embedding.service.js');
let chunkerMod: typeof import('../../src/services/codeintel/chunker.js');

function fakeVector(s: string): number[] {
  let seed = 0;
  for (let i = 0; i < s.length; i++) seed = (seed * 31 + s.charCodeAt(i)) >>> 0;
  const v = new Array<number>(1536);
  for (let i = 0; i < 1536; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    v[i] = ((seed % 2000) - 1000) / 1000;
  }
  return v;
}

const fakeEmbedder = {
  async embed(inputs: string[]) {
    return {
      vectors: inputs.map(fakeVector),
      totalTokens: Math.round(inputs.reduce((n, s) => n + s.length, 0) / 4),
    };
  },
};

// chunkSymbol returns null only when content is below MIN_CHUNK_CHARS — never
// the case in these fixtures. Wrap to throw so we never need `!` at call sites.
function mustChunk<T>(c: T | null): T {
  if (c === null) throw new Error('expected chunkSymbol to return a chunk');
  return c;
}

beforeAll(async () => {
  process.env.POSTGRES_URL = POSTGRES_URL;
  try {
    const { default: postgres } = await import('postgres');
    const probe = postgres(POSTGRES_URL, {
      max: 1,
      idle_timeout: 1,
      connect_timeout: 2,
    });
    await probe`SELECT 1`;
    await probe.end({ timeout: 1 });
    pgReachable = true;
  } catch {
    pgReachable = false;
    return;
  }

  ({ pg } = await import('../../src/db/pg/client.js'));
  ({ chunks: chunksTable } = await import('../../src/db/pg/schema.js'));
  embeddingMod = await import('../../src/services/codeintel/embedding.service.js');
  chunkerMod = await import('../../src/services/codeintel/chunker.js');

  // Apply schema (idempotent SQL from migration).
  await pg.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
  await pg.execute(sql`
    CREATE TABLE IF NOT EXISTS chunks (
      id text PRIMARY KEY,
      repo_id text NOT NULL,
      source text NOT NULL,
      symbol_uid text,
      file_path text NOT NULL,
      start_line integer NOT NULL DEFAULT 0,
      end_line integer NOT NULL DEFAULT 0,
      content_sha text NOT NULL,
      content text NOT NULL,
      token_count integer NOT NULL DEFAULT 0,
      embedding vector(1536) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
  await pg.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS chunks_repo_symbol_sha_idx
      ON chunks (repo_id, symbol_uid, content_sha) WHERE symbol_uid IS NOT NULL`);
  await pg.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS chunks_repo_path_sha_idx
      ON chunks (repo_id, file_path, content_sha) WHERE symbol_uid IS NULL`);

  await pg.execute(sql`DELETE FROM chunks WHERE repo_id = 'test/embed'`);
});

afterAll(async () => {
  if (pgReachable) {
    const { rawPg } = await import('../../src/db/pg/client.js');
    await rawPg.end({ timeout: 2 });
  }
});

describe('EmbeddingService (integration)', () => {
  it('embeds, stores, and dedupes on second pass', async (ctx) => {
    if (!pgReachable) return ctx.skip();
    const sym = mustChunk(
      chunkerMod.chunkSymbol('test/embed', {
        uid: 'Function:src/foo.ts:bar',
        name: 'bar',
        filePath: 'src/foo.ts',
        startLine: 1,
        endLine: 5,
        content: 'function bar() { return 1; }',
      }),
    );
    const docs = chunkerMod.chunkDoc('test/embed', {
      filePath: 'README.md',
      content: '# Title\n\nSome documentation paragraph.\n',
    });
    const prepared = [sym, ...docs];

    const first = await embeddingMod.embedAndStore(prepared, fakeEmbedder);
    expect(first.prepared).toBe(prepared.length);
    expect(first.reused).toBe(0);
    expect(first.embedded).toBe(prepared.length);
    expect(first.inserted).toBe(prepared.length);

    const second = await embeddingMod.embedAndStore(prepared, fakeEmbedder);
    expect(second.prepared).toBe(prepared.length);
    expect(second.reused).toBe(prepared.length);
    expect(second.embedded).toBe(0);
    expect(second.inserted).toBe(0);

    const rows = await pg.select().from(chunksTable).where(sql`repo_id = 'test/embed'`);
    expect(rows.length).toBe(prepared.length);
  });

  it('re-embeds when content changes (new contentSha)', async (ctx) => {
    if (!pgReachable) return ctx.skip();
    const v1 = mustChunk(
      chunkerMod.chunkSymbol('test/embed', {
        uid: 'Function:src/changes.ts:foo',
        name: 'foo',
        filePath: 'src/changes.ts',
        startLine: 1,
        endLine: 1,
        content: 'function foo() { return 1; }',
      }),
    );
    const v2 = mustChunk(
      chunkerMod.chunkSymbol('test/embed', {
        uid: 'Function:src/changes.ts:foo',
        name: 'foo',
        filePath: 'src/changes.ts',
        startLine: 1,
        endLine: 1,
        content: 'function foo() { return 2; }',
      }),
    );
    expect(v1.contentSha).not.toBe(v2.contentSha);

    const r1 = await embeddingMod.embedAndStore([v1], fakeEmbedder);
    expect(r1.embedded).toBe(1);

    const r2 = await embeddingMod.embedAndStore([v2], fakeEmbedder);
    expect(r2.reused).toBe(0);
    expect(r2.embedded).toBe(1);
  });
});
