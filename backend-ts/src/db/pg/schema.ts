/**
 * Postgres schema for code-intelligence embeddings.
 *
 * `chunks` stores symbol-aware code chunks with their OpenAI embeddings.
 * Incrementality keyed on (repo_id, symbol_uid, content_sha) — re-indexing
 * a repo only re-embeds chunks whose source has changed.
 *
 * Vector column dimension MUST match env.EMBEDDINGS_DIM (1536 for
 * text-embedding-3-small). Changing models requires a new migration that
 * drops the column / table.
 */
import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uniqueIndex, vector } from 'drizzle-orm/pg-core';

export const chunks = pgTable(
  'chunks',
  {
    id: text('id').primaryKey(), // ULID
    repoId: text('repo_id').notNull(), // e.g. "owner/repo"
    source: text('source').notNull(), // 'code' | 'doc' | 'symbol'
    symbolUid: text('symbol_uid'), // gitnexus symbol UID (nullable for docs)
    filePath: text('file_path').notNull(),
    startLine: integer('start_line').notNull().default(0),
    endLine: integer('end_line').notNull().default(0),
    contentSha: text('content_sha').notNull(),
    content: text('content').notNull(),
    tokenCount: integer('token_count').notNull().default(0),
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    repoIdx: index('chunks_repo_idx').on(t.repoId),
    repoSymbolShaIdx: uniqueIndex('chunks_repo_symbol_sha_idx').on(
      t.repoId,
      t.symbolUid,
      t.contentSha,
    ),
    // HNSW vector index — created in migration SQL because drizzle-kit
    // doesn't yet emit the `USING hnsw (... vector_cosine_ops)` clause
    // with custom params (m, ef_construction).
  }),
);

export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;

// Re-export for migration scripts that need raw SQL access.
export { sql };
