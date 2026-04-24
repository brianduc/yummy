-- 0000_init.sql — code-intelligence embeddings store
-- Idempotent: safe to apply multiple times during MVP iteration.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS chunks (
  id           text PRIMARY KEY,
  repo_id      text NOT NULL,
  source       text NOT NULL,
  symbol_uid   text,
  file_path    text NOT NULL,
  start_line   integer NOT NULL DEFAULT 0,
  end_line     integer NOT NULL DEFAULT 0,
  content_sha  text NOT NULL,
  content      text NOT NULL,
  token_count  integer NOT NULL DEFAULT 0,
  embedding    vector(1536) NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chunks_repo_idx ON chunks (repo_id);

-- (repo_id, symbol_uid, content_sha) — incrementality dedupe key.
-- symbol_uid can be NULL (docs); a partial unique index covers the NULL case.
CREATE UNIQUE INDEX IF NOT EXISTS chunks_repo_symbol_sha_idx
  ON chunks (repo_id, symbol_uid, content_sha)
  WHERE symbol_uid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS chunks_repo_path_sha_idx
  ON chunks (repo_id, file_path, content_sha)
  WHERE symbol_uid IS NULL;

-- HNSW vector index for cosine similarity. Tuned for ~100k chunks/repo.
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx
  ON chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
