/**
 * Shared types for the code-intelligence pipeline.
 *
 * A "Symbol" is a code element discovered by gitnexus (function, class,
 * method, etc.) with an absolute file path and line range.
 *
 * A "Chunk" is the embedding-ready unit produced by the Chunker.
 */

export type ChunkSource = 'code' | 'doc' | 'symbol';

export interface SymbolInput {
  /** Stable gitnexus UID (e.g. "Function:src/foo.ts:bar"). */
  uid: string;
  name: string;
  /** File path RELATIVE to the repo root. */
  filePath: string;
  startLine: number;
  endLine: number;
  /** Source code of the symbol (already extracted by caller). */
  content: string;
  /** Optional: signature / docstring to prepend during chunk preparation. */
  signature?: string;
  docstring?: string;
}

export interface DocInput {
  /** File path RELATIVE to the repo root. */
  filePath: string;
  content: string;
}

export interface PreparedChunk {
  /** Source kind. */
  source: ChunkSource;
  /** repoId scope ("owner/repo"). */
  repoId: string;
  /** Null for `doc` chunks. */
  symbolUid: string | null;
  filePath: string;
  startLine: number;
  endLine: number;
  /** SHA-256 of `content` — used as incrementality key + dedupe. */
  contentSha: string;
  /** The text actually sent to the embedding model. */
  content: string;
  /** Conservative whitespace token estimate (real count comes from API). */
  tokenCountEstimate: number;
}

export interface EmbeddedChunk extends PreparedChunk {
  /** ULID assigned at insert time. */
  id: string;
  /** Final token count from the embedding API. */
  tokenCount: number;
  /** Embedding vector (length === env.EMBEDDINGS_DIM). */
  embedding: number[];
}
