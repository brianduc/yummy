/**
 * Token counter — exact (not heuristic) token counts via js-tiktoken.
 *
 * Why exact: OpenAI enforces TPM at the request level using their own
 * tokenizer. A char/4 heuristic over-estimates code (lots of punctuation)
 * and under-estimates natural language. To stay safely under the 200k TPM
 * cap we need a count that matches OpenAI's accounting within a token or
 * two; js-tiktoken's WASM-free pure-JS implementation does that.
 *
 * Encoder selection follows OpenAI's published model→encoding map:
 *   - gpt-4o*, gpt-4.1*, gpt-5*, o1*, o3*, o4* → o200k_base
 *   - text-embedding-3-* / text-embedding-ada-002 / gpt-3.5* / gpt-4* → cl100k_base
 *   - everything else → cl100k_base (safe default; over-counts gpt-2 family
 *     by a few percent which is fine for a budgeting limiter).
 *
 * Encoders are cached per encoding name (not per model) since loading the
 * BPE table is the expensive part (~2 MB JSON parse for o200k_base).
 */
import { getEncoding, type Tiktoken } from 'js-tiktoken';

export type TiktokenEncodingName = 'cl100k_base' | 'o200k_base';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
}

const encoderCache = new Map<TiktokenEncodingName, Tiktoken>();

function getEncoder(name: TiktokenEncodingName): Tiktoken {
  let enc = encoderCache.get(name);
  if (!enc) {
    enc = getEncoding(name);
    encoderCache.set(name, enc);
  }
  return enc;
}

/**
 * Map a model name to the encoding it uses on the OpenAI server side.
 * Pattern-based so brand-new model variants (e.g. gpt-5.4-nano-2026-03-17)
 * don't fall off a hard-coded allowlist.
 */
export function encodingForModel(model: string): TiktokenEncodingName {
  const m = model.toLowerCase();
  // o200k_base family: gpt-4o, gpt-4.1, gpt-5*, reasoning models (o1/o3/o4)
  if (
    m.startsWith('gpt-4o') ||
    m.startsWith('gpt-4.1') ||
    m.startsWith('gpt-5') ||
    /^o[134](?:[-_].*)?$/.test(m)
  ) {
    return 'o200k_base';
  }
  // Everything else (incl. text-embedding-3-*, gpt-3.5*, gpt-4 legacy) is cl100k.
  return 'cl100k_base';
}

/** Count tokens in a single string (or sum across an array). */
export function countTokens(model: string, input: string | string[]): number {
  const enc = getEncoder(encodingForModel(model));
  if (typeof input === 'string') return enc.encode(input).length;
  let total = 0;
  for (const s of input) total += enc.encode(s).length;
  return total;
}

/**
 * Count tokens for a chat completion request.
 *
 * Mirrors OpenAI's published `num_tokens_from_messages` formula:
 *   - 3 priming tokens for the assistant reply
 *   - per message: 3 tokens of role/format scaffolding
 *   - +1 token if a `name` field is present
 *   - sum of encoded role + content (+ name)
 *
 * Verified against the cookbook fixtures within ±2 tokens for gpt-4o /
 * gpt-3.5; ±0 for plain user/system messages with no `name`.
 */
export function countMessageTokens(model: string, messages: ChatMessage[]): number {
  const enc = getEncoder(encodingForModel(model));
  let total = 3; // every reply is primed with <|start|>assistant<|message|>
  for (const msg of messages) {
    total += 3; // <|start|>role<|message|>...<|end|>
    total += enc.encode(msg.role).length;
    total += enc.encode(msg.content).length;
    if (msg.name) {
      total += 1;
      total += enc.encode(msg.name).length;
    }
  }
  return total;
}

/** Test seam — clear the encoder cache between unit tests. */
export const _internal = { encoderCache, getEncoder };
