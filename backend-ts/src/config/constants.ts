/**
 * Constants ported from Python config.py.
 */
export const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go',
  '.rb', '.php', '.cs', '.html', '.css', '.json', '.md',
]);

export const DEFAULT_MAX_SCAN_LIMIT = 10_000;

/**
 * Token-based chunking thresholds for the scan pipeline.
 *
 * SCAN_CHUNK_TOKENS     — max input tokens accumulated before flushing a
 *                         chunk to the INDEXER agent. Keeps each INDEXER
 *                         call well within the 150k per-request cap after
 *                         adding the system instruction + output reserve.
 *
 * ARCHITECT_BATCH_TOKENS — max tokens per intermediate ARCHITECT batch in
 *                          the hierarchical summarization pass (Pass 1).
 *                          Leaves ~70k headroom for instruction + output.
 *
 * ARCHITECT_FINAL_TOKENS — safety ceiling for the combined meta-summaries
 *                          fed into the final ARCHITECT synthesis (Pass 2).
 *                          If exceeded, an extra reduction pass is triggered.
 */
export const SCAN_CHUNK_TOKENS = 60_000;
export const ARCHITECT_BATCH_TOKENS = 80_000;
export const ARCHITECT_FINAL_TOKENS = 100_000;
