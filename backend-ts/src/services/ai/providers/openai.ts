/**
 * OpenAI provider — blocking + streaming via the official `openai` SDK.
 *
 * All chat traffic flows through the per-model `TpmLimiter` to stay under
 * the org's OpenAI TPM cap. The limiter:
 *   - rejects oversize prompts pre-flight with HttpError(413)
 *   - serialises requests so cumulative bursts don't overflow the 60s window
 *   - retries on 429, honouring Retry-After headers
 * See backend-ts/src/services/ai/rate-limiter.ts for full semantics.
 */
import OpenAI from 'openai';
import { env } from '../../../config/env.js';
import { runtimeConfig } from '../../../config/runtime.js';
import { HttpError } from '../../../lib/errors.js';
import { limiters, withRetryOn429 } from '../rate-limiter.js';
import { countMessageTokens } from '../token-counter.js';
import type { CallResult, StreamChunks } from './types.js';

function client(): OpenAI {
  const key = runtimeConfig.openai_key;
  if (!key) {
    throw new HttpError(
      400,
      'OPENAI_API_KEY is not configured. Set it in Settings or via the OPENAI_API_KEY env var.',
    );
  }
  return new OpenAI({ apiKey: key, timeout: 300_000 });
}

function model(): string {
  return runtimeConfig.openai_model || 'gpt-4o';
}

function limiterFor(modelName: string) {
  // Apply env-driven defaults to the limiter on first use per model.
  // configureDefaults() is process-wide; calling it repeatedly with the same
  // factory is idempotent because the registry rebuilds on each call.
  const l = limiters.forChat(modelName);
  // Mutate cfg in place so subsequent acquires use the right values without
  // resetting the sliding window (which a full re-construct would do).
  l.cfg.tpm = env.OPENAI_TPM_LIMIT;
  l.cfg.perRequestMax = env.OPENAI_PER_REQUEST_MAX;
  l.cfg.retryMax = env.OPENAI_RETRY_MAX;
  if (l.cfg.perRequestMax > l.cfg.tpm) l.cfg.perRequestMax = l.cfg.tpm;
  return l;
}

export async function callOpenAI(
  _agentRole: string,
  prompt: string,
  instruction: string,
): Promise<CallResult> {
  const m = model();
  const limiter = limiterFor(m);
  const inputTokens = countMessageTokens(m, [
    { role: 'system', content: instruction },
    { role: 'user', content: prompt },
  ]);
  // Reserve input + a fixed output budget; refunded post-call from usage.
  const reserve = inputTokens + env.OPENAI_OUTPUT_RESERVE;
  const lease = await limiter.acquire(reserve);
  try {
    const resp = await withRetryOn429(
      () =>
        client().chat.completions.create({
          model: m,
          messages: [
            { role: 'system', content: instruction },
            { role: 'user', content: prompt },
          ],
        }),
      { retryMax: limiter.cfg.retryMax, retryBaseMs: limiter.cfg.retryBaseMs },
    );
    const text = resp.choices[0]?.message?.content ?? '';
    const usage = resp.usage;
    lease.commit(usage?.total_tokens ?? reserve);
    return {
      text,
      inTokens: usage?.prompt_tokens ?? null,
      outTokens: usage?.completion_tokens ?? null,
    };
  } catch (e) {
    lease.release();
    if (e instanceof HttpError) throw e;
    const status = (e as { status?: number }).status;
    throw new HttpError(502, `OpenAI error${status ? ` ${status}` : ''}: ${(e as Error).message}`);
  }
}

export async function* streamOpenAI(prompt: string, instruction: string): StreamChunks {
  const m = model();
  const limiter = limiterFor(m);
  const inputTokens = countMessageTokens(m, [
    { role: 'system', content: instruction },
    { role: 'user', content: prompt },
  ]);
  // For streaming we can't read usage until the stream closes; reserve the
  // same input + output budget and commit the same value on close (we have
  // no usage object). This errs on the side of over-accounting briefly.
  const reserve = inputTokens + env.OPENAI_OUTPUT_RESERVE;
  const lease = await limiter.acquire(reserve);

  let stream: AsyncIterable<{
    choices?: Array<{ delta?: { content?: string | null } }>;
  }>;
  try {
    stream = (await withRetryOn429(
      () =>
        client().chat.completions.create({
          model: m,
          stream: true,
          messages: [
            { role: 'system', content: instruction },
            { role: 'user', content: prompt },
          ],
        }),
      { retryMax: limiter.cfg.retryMax, retryBaseMs: limiter.cfg.retryBaseMs },
    )) as unknown as AsyncIterable<{
      choices?: Array<{ delta?: { content?: string | null } }>;
    }>;
  } catch (e) {
    lease.release();
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, `OpenAI stream error: ${(e as Error).message}`);
  }

  try {
    for await (const event of stream) {
      const token = event.choices?.[0]?.delta?.content;
      if (token) yield token;
    }
    // Stream completed cleanly — commit the reservation as-is. Without a
    // usage payload we don't know the exact output token count.
    lease.commit(reserve);
  } catch (e) {
    lease.release();
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, `OpenAI stream error: ${(e as Error).message}`);
  }
}
