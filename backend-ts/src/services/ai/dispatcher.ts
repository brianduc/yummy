/**
 * AI dispatcher — selects provider from runtimeConfig.provider and tracks usage.
 *
 * Mirrors backend/services/ai_service.py `call_ai` and `stream_ai`.
 */
import { runtimeConfig } from '../../config/runtime.js';
import { callBedrock, streamBedrock } from './providers/bedrock.js';
import { callCopilot, streamCopilot } from './providers/copilot.js';
import { callGemini, streamGemini } from './providers/gemini.js';
import { callOllama, streamOllama } from './providers/ollama.js';
import { callOpenAI, streamOpenAI } from './providers/openai.js';
import type { CallResult, StreamChunks } from './providers/types.js';
import { track } from './track.js';

/**
 * Returns a Promise that rejects with an AbortError when the given signal fires.
 * If no signal is provided, returns a promise that never resolves (no-op).
 */
function rejectOnAbort(signal?: AbortSignal): Promise<never> {
  if (!signal) return new Promise(() => {});
  return new Promise((_, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Pipeline stopped by user', 'AbortError'));
      return;
    }
    signal.addEventListener(
      'abort',
      () => reject(new DOMException('Pipeline stopped by user', 'AbortError')),
      { once: true },
    );
  });
}

/**
 * Blocking AI call. Selects provider from runtimeConfig.provider.
 * Tracks token usage and cost via logsRepo.
 *
 * Pass an AbortSignal (from an AbortController) to support mid-call cancellation.
 * When the signal fires, the call rejects immediately with a DOMException
 * (name === 'AbortError') — the underlying provider request may still be running
 * in the background but its result is discarded.
 */
export async function callAI(
  agentRole: string,
  prompt: string,
  instruction: string,
  signal?: AbortSignal,
): Promise<string> {
  const provider = runtimeConfig.provider;
  const start = Date.now();

  let result: CallResult;
  switch (provider) {
    case 'gemini':
      result = await Promise.race([callGemini(agentRole, prompt, instruction), rejectOnAbort(signal)]);
      break;
    case 'openai':
      result = await Promise.race([callOpenAI(agentRole, prompt, instruction), rejectOnAbort(signal)]);
      break;
    case 'ollama':
      result = await Promise.race([callOllama(agentRole, prompt, instruction), rejectOnAbort(signal)]);
      break;
    case 'copilot':
      result = await Promise.race([callCopilot(agentRole, prompt, instruction), rejectOnAbort(signal)]);
      break;
    case 'bedrock':
      result = await Promise.race([callBedrock(agentRole, prompt, instruction), rejectOnAbort(signal)]);
      break;
    default:
      result = await Promise.race([callGemini(agentRole, prompt, instruction), rejectOnAbort(signal)]);
  }

  track({
    agentRole,
    prompt,
    instruction,
    resultText: result.text,
    latencySeconds: (Date.now() - start) / 1000,
    inTokens: result.inTokens,
    outTokens: result.outTokens,
  });

  return result.text;
}

/**
 * Streaming AI call — yields text chunks as they arrive.
 * All providers support true token-by-token streaming.
 *
 * Pass an AbortSignal to support mid-stream cancellation. When the signal
 * fires, the generator stops yielding and returns silently. The caller is
 * responsible for checking signal.aborted after the loop to decide whether
 * to treat the early exit as a stop or an error.
 *
 * NOTE: Streaming does not currently call `track()` (matches Python parity —
 * `stream_ai` in Python also does not record metrics). Consumers wanting to
 * record usage from a streamed response must call `track()` themselves once
 * the stream is fully drained.
 */
export async function* streamAI(
  prompt: string,
  instruction: string,
  signal?: AbortSignal,
): StreamChunks {
  if (signal?.aborted) return;

  const provider = runtimeConfig.provider;
  const iterator =
    provider === 'gemini'
      ? streamGemini(prompt, instruction)
      : provider === 'openai'
        ? streamOpenAI(prompt, instruction)
        : provider === 'ollama'
          ? streamOllama(prompt, instruction)
          : provider === 'copilot'
            ? streamCopilot(prompt, instruction)
            : provider === 'bedrock'
              ? streamBedrock(prompt, instruction)
              : streamGemini(prompt, instruction);

  for await (const chunk of iterator) {
    if (signal?.aborted) return;
    yield chunk;
  }
}
