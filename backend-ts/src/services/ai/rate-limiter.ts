/**
 * Per-model OpenAI rate limiter — keeps token traffic under the org's TPM cap.
 *
 * Why this exists: OpenAI enforces TPM per (org, model) using a sliding 60s
 * window. Exceeding it returns HTTP 429 with a `Retry-After` header. Without
 * client-side throttling, a single fat request (e.g. ~290k tokens of code
 * fed into a single chat call) triggers an instant 429 even on an idle org,
 * because OpenAI evaluates the *single request size* against the TPM cap.
 *
 * Behaviours per limiter instance (one per model name):
 *
 *   1. PER-REQUEST CEILING — `acquire(estimate)` rejects with
 *      `HttpError(413)` if the caller's pre-counted token estimate exceeds
 *      `cfg.perRequestMax`. Embedding callers should split-then-acquire;
 *      chat callers must shrink their prompt (we deliberately don't truncate
 *      chat prompts because that silently changes meaning).
 *
 *   2. SLIDING WINDOW — `acquire` records `(timestamp, tokens)` pairs.
 *      Before admitting a new request it evicts entries older than 60s,
 *      sums the rest, and if `used + estimate > cfg.tpm` it sleeps until
 *      the oldest in-window entry expires (or longer if needed).
 *      Acquisition is serialised by an internal promise queue so multiple
 *      concurrent acquirers can't race past the cap.
 *
 *   3. RECONCILIATION — `lease.commit(actual)` replaces the reservation
 *      with the real `usage.total_tokens` from OpenAI's response, so we
 *      don't permanently over-account when our estimate was high.
 *
 *   4. RETRY — `withRetryOn429` wraps the actual SDK call and retries up
 *      to `cfg.retryMax` times on HTTP 429, honouring the `Retry-After`
 *      header (seconds) when present, otherwise exponential backoff with
 *      jitter. This catches the case where another process/tenant is
 *      concurrently consuming the same org's TPM.
 *
 * Per-model isolation: `limiters.forChat(model)` and `limiters.forEmbedding(model)`
 * each return a unique limiter, so embedding traffic never blocks chat
 * traffic and vice-versa. OpenAI enforces TPM independently per model, so
 * mirroring that here gives the most throughput for the same safety.
 */
import { HttpError } from '../../lib/errors.js';

export interface RateLimitConfig {
  /** Sliding-window cap: max tokens consumed in any rolling 60s. */
  tpm: number;
  /** Hard ceiling per single request. Caller must split or shrink. */
  perRequestMax: number;
  /** Max retries on HTTP 429 before giving up. */
  retryMax: number;
  /** Base backoff in ms when no Retry-After header is present (2^n * base). */
  retryBaseMs: number;
}

export interface Lease {
  /** Tokens reserved at acquire time. */
  readonly estimated: number;
  /** Reconcile reservation with the real usage.total_tokens. */
  commit(actualTokens: number): void;
  /** Release with no commit (e.g. on caller error). Refunds the estimate. */
  release(): void;
}

interface WindowEntry {
  ts: number;
  tokens: number;
  /** Mutable so commit() can update without re-walking the array. */
  committed: boolean;
}

const WINDOW_MS = 60_000;

/** Test seam — replace with a fake clock in unit tests. */
export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

export class TpmLimiter {
  readonly cfg: RateLimitConfig;
  private readonly window: WindowEntry[] = [];
  /** Serialises acquire() so concurrent callers see a consistent window. */
  private acquireChain: Promise<void> = Promise.resolve();

  constructor(
    readonly model: string,
    cfg: Partial<RateLimitConfig> = {},
    private readonly clock: Clock = realClock,
  ) {
    this.cfg = {
      tpm: cfg.tpm ?? 180_000,
      perRequestMax: cfg.perRequestMax ?? 150_000,
      retryMax: cfg.retryMax ?? 5,
      retryBaseMs: cfg.retryBaseMs ?? 1_000,
    };
    if (this.cfg.perRequestMax > this.cfg.tpm) {
      // perRequestMax > tpm would be unenforceable: a single request would
      // already exceed the window cap. Clamp to tpm with a warning.
      this.cfg.perRequestMax = this.cfg.tpm;
    }
  }

  /**
   * Reserve `estimatedTokens` of capacity, sleeping until they fit.
   * Throws HttpError(413) if a single request exceeds perRequestMax.
   */
  async acquire(estimatedTokens: number): Promise<Lease> {
    if (estimatedTokens <= 0) {
      // Trivial: nothing to count, but still return a no-op lease so callers
      // can use the same try/finally shape.
      return this.makeLease(0);
    }
    if (estimatedTokens > this.cfg.perRequestMax) {
      throw new HttpError(
        413,
        `Request exceeds per-request token cap for model ${this.model}: ${estimatedTokens} > ${this.cfg.perRequestMax}. Shrink the prompt or split the batch.`,
      );
    }
    // Chain-await to serialise; this is cheap (microtask) and avoids races.
    const prev = this.acquireChain;
    let release!: () => void;
    this.acquireChain = new Promise<void>((r) => {
      release = r;
    });
    try {
      await prev;
      await this.waitForCapacity(estimatedTokens);
      return this.makeLease(estimatedTokens);
    } finally {
      release();
    }
  }

  private async waitForCapacity(want: number): Promise<void> {
    // Up to ~10 iterations of sleep-and-recheck; each iteration sleeps until
    // the next entry expires. This bounds runaway sleeps if the clock jumps.
    for (let guard = 0; guard < 60; guard++) {
      this.evictExpired();
      const used = this.usedTokens();
      if (used + want <= this.cfg.tpm) return;
      // Sleep until the oldest entry falls out of the window.
      const oldest = this.window[0];
      const waitMs = oldest ? oldest.ts + WINDOW_MS - this.clock.now() : 100;
      await this.clock.sleep(Math.max(waitMs, 50));
    }
    // Pathological — shouldn't happen with sane configs. Allow request through
    // rather than deadlock; OpenAI will 429 us and the retry loop handles it.
  }

  private evictExpired(): void {
    const cutoff = this.clock.now() - WINDOW_MS;
    while (this.window.length > 0 && this.window[0]!.ts < cutoff) {
      this.window.shift();
    }
  }

  private usedTokens(): number {
    let n = 0;
    for (const e of this.window) n += e.tokens;
    return n;
  }

  private makeLease(estimated: number): Lease {
    const entry: WindowEntry | null =
      estimated > 0 ? { ts: this.clock.now(), tokens: estimated, committed: false } : null;
    if (entry) this.window.push(entry);
    return {
      estimated,
      commit: (actual: number) => {
        if (entry && !entry.committed) {
          entry.tokens = Math.max(0, actual);
          entry.committed = true;
        }
      },
      release: () => {
        if (entry && !entry.committed) {
          entry.tokens = 0;
          entry.committed = true;
        }
      },
    };
  }

  /** Snapshot for diagnostics / tests. */
  stats(): { model: string; usedTokens: number; entries: number } {
    this.evictExpired();
    return { model: this.model, usedTokens: this.usedTokens(), entries: this.window.length };
  }
}

/**
 * Retry an OpenAI SDK call when it throws HTTP 429.
 * Honours the `Retry-After` header (seconds, integer) when present;
 * otherwise uses exponential backoff with jitter.
 *
 * Re-throws non-429 errors immediately. Re-throws the last 429 if all
 * retries are exhausted so the caller surfaces a real error rather than
 * looping forever.
 */
export async function withRetryOn429<T>(
  fn: () => Promise<T>,
  cfg: { retryMax: number; retryBaseMs: number },
  clock: Clock = realClock,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= cfg.retryMax; attempt++) {
    try {
      return await fn();
    } catch (e: unknown) {
      lastErr = e;
      if (!is429(e) || attempt === cfg.retryMax) throw e;
      const retryAfterMs = parseRetryAfterMs(e) ?? 2 ** attempt * cfg.retryBaseMs;
      const jitter = Math.floor(Math.random() * 250);
      await clock.sleep(retryAfterMs + jitter);
    }
  }
  // Unreachable — the loop either returns or throws.
  throw lastErr;
}

function is429(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const status = (e as { status?: unknown }).status;
  if (status === 429) return true;
  // OpenAI SDK sometimes wraps the status in `response.status` or message.
  const msg = (e as Error).message ?? '';
  return /\b429\b/.test(msg);
}

function parseRetryAfterMs(e: unknown): number | null {
  if (!e || typeof e !== 'object') return null;
  const headers = (e as { headers?: Record<string, string | string[]> }).headers;
  if (!headers) return null;
  const raw = headers['retry-after'] ?? headers['Retry-After'];
  if (!raw) return null;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  const seconds = Number(v);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  // HTTP date variant — rare for OpenAI; fall back to backoff.
  const date = Date.parse(v);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

// ─── Per-model registry ───────────────────────────────────────────────

const chatLimiters = new Map<string, TpmLimiter>();
const embedLimiters = new Map<string, TpmLimiter>();

/** Lazily-bound config — read once on first access via getDefaultConfig(). */
let defaultCfgFactory: (() => Partial<RateLimitConfig>) | null = null;

export function configureDefaults(factory: () => Partial<RateLimitConfig>): void {
  defaultCfgFactory = factory;
  // Reset registries so existing limiters pick up new defaults next call.
  chatLimiters.clear();
  embedLimiters.clear();
}

function getDefaultConfig(): Partial<RateLimitConfig> {
  return defaultCfgFactory ? defaultCfgFactory() : {};
}

export const limiters = {
  forChat(model: string): TpmLimiter {
    let l = chatLimiters.get(model);
    if (!l) {
      l = new TpmLimiter(`chat:${model}`, getDefaultConfig());
      chatLimiters.set(model, l);
    }
    return l;
  },
  forEmbedding(model: string): TpmLimiter {
    let l = embedLimiters.get(model);
    if (!l) {
      l = new TpmLimiter(`embed:${model}`, getDefaultConfig());
      embedLimiters.set(model, l);
    }
    return l;
  },
  /** Test-only: drop all cached limiters. */
  _resetAll(): void {
    chatLimiters.clear();
    embedLimiters.clear();
  },
};
