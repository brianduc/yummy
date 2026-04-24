/**
 * Chunker — produces embedding-ready chunks from gitnexus symbols and docs.
 *
 * Strategy (MVP):
 *   - Symbol chunks (preferred): one chunk per function/class/method.
 *     Header: `{filePath}:{startLine}-{endLine} {signature?}` + optional
 *     docstring + body. Truncated to MAX_CHARS (~32k chars ≈ ~8k tokens for
 *     code-heavy text, well under the 8191-token limit of
 *     text-embedding-3-small).
 *   - Doc chunks (fallback for .md / .mdx / .txt): sliding window of
 *     ~6000 chars with 600-char overlap, split on paragraph boundaries
 *     when possible. Symbol UID is null.
 *
 * `contentSha` is SHA-256 of the FINAL chunk text. Incrementality and
 * dedupe live entirely on this hash → the embedding service can skip
 * any chunk whose (repo_id, symbol_uid, content_sha) tuple already exists.
 */
import { createHash } from 'node:crypto';

import type { DocInput, PreparedChunk, SymbolInput } from './types.js';

const MAX_CHARS = 32_000; // ~8k tokens for code; safely under 8191 limit
const DOC_WINDOW = 6_000;
const DOC_OVERLAP = 600;
const MIN_CHUNK_CHARS = 16; // skip near-empty chunks (whitespace-only files)

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function estimateTokens(s: string): number {
  // Cheap heuristic: ~4 chars per token for code/English. Real count
  // comes back from the OpenAI API in the response usage payload.
  return Math.ceil(s.length / 4);
}

function clamp(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  // Truncate at a line boundary if possible to avoid splitting a token.
  const cut = s.lastIndexOf('\n', maxChars);
  return s.slice(0, cut > maxChars * 0.8 ? cut : maxChars);
}

export function chunkSymbol(repoId: string, sym: SymbolInput): PreparedChunk | null {
  const body = sym.content?.trim() ?? '';
  if (body.length < MIN_CHUNK_CHARS) return null;

  const headerParts = [`// ${sym.filePath}:${sym.startLine}-${sym.endLine}`];
  if (sym.signature) headerParts.push(`// ${sym.signature}`);
  if (sym.docstring) headerParts.push(`/* ${sym.docstring.trim()} */`);
  const header = headerParts.join('\n');

  const text = clamp(`${header}\n${body}`, MAX_CHARS);

  return {
    source: 'symbol',
    repoId,
    symbolUid: sym.uid,
    filePath: sym.filePath,
    startLine: sym.startLine,
    endLine: sym.endLine,
    contentSha: sha256(text),
    content: text,
    tokenCountEstimate: estimateTokens(text),
  };
}

/**
 * Sliding-window split on paragraph boundaries when possible.
 * For a doc shorter than DOC_WINDOW, returns a single chunk.
 */
export function chunkDoc(repoId: string, doc: DocInput): PreparedChunk[] {
  const text = doc.content.replace(/\r\n/g, '\n').trim();
  if (text.length < MIN_CHUNK_CHARS) return [];

  const chunks: PreparedChunk[] = [];
  let cursor = 0;
  let lineCursor = 1;

  while (cursor < text.length) {
    const windowEnd = Math.min(cursor + DOC_WINDOW, text.length);
    let cut = windowEnd;
    if (windowEnd < text.length) {
      // Prefer paragraph break, then line break, near the window edge.
      const para = text.lastIndexOf('\n\n', windowEnd);
      const line = text.lastIndexOf('\n', windowEnd);
      if (para > cursor + DOC_WINDOW * 0.5) cut = para;
      else if (line > cursor + DOC_WINDOW * 0.5) cut = line;
    }

    const slice = text.slice(cursor, cut).trim();
    if (slice.length >= MIN_CHUNK_CHARS) {
      const linesInSlice = (slice.match(/\n/g)?.length ?? 0) + 1;
      const startLine = lineCursor;
      const endLine = lineCursor + linesInSlice - 1;
      chunks.push({
        source: 'doc',
        repoId,
        symbolUid: null,
        filePath: doc.filePath,
        startLine,
        endLine,
        contentSha: sha256(slice),
        content: slice,
        tokenCountEstimate: estimateTokens(slice),
      });
      lineCursor = endLine + 1;
    }

    if (cut >= text.length) break;
    cursor = Math.max(cut - DOC_OVERLAP, cursor + 1);
  }

  return chunks;
}

export const _internal = { sha256, estimateTokens, MAX_CHARS, DOC_WINDOW };
