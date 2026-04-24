/**
 * Environment loader — read once at boot, validated via Zod.
 * Runtime-mutable provider config lives in src/config/runtime.ts.
 */
import 'dotenv/config';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

const defaultYummyHome = join(homedir(), '.yummy');

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().default('./data/yummy.db'),

  // ── Postgres + pgvector (code-intelligence embeddings store) ──
  POSTGRES_URL: z.string().default('postgres://yummy:yummy@localhost:5432/yummy'),

  // ── GitNexus library integration ──
  // Where cloned repos + per-repo .gitnexus/lbug graphs live.
  GITNEXUS_REPO_ROOT: z.string().default(join(defaultYummyHome, 'repos')),
  // HOME passed to gitnexus so its registry.json lives in a stable place
  // regardless of where the backend process is launched from.
  GITNEXUS_HOME: z.string().default(join(defaultYummyHome, 'gitnexus-home')),

  // ── Embeddings ──
  EMBEDDINGS_PROVIDER: z.enum(['openai']).default('openai'),
  EMBEDDINGS_MODEL: z.string().default('text-embedding-3-small'),
  EMBEDDINGS_DIM: z.coerce.number().int().positive().default(1536),
  EMBEDDINGS_BATCH_SIZE: z.coerce.number().int().positive().default(64),

  AI_PROVIDER: z.enum(['gemini', 'openai', 'ollama', 'copilot', 'bedrock']).default('gemini'),

  // ── OpenAI rate-limiter (TPM throttle for chat + embeddings) ──
  // Org-level OpenAI TPM limits trigger HTTP 429 on a single oversized
  // request *or* on cumulative bursts. The limiter sits in front of every
  // OpenAI call (chat + embeddings) and enforces both.
  //
  //   OPENAI_TPM_LIMIT       — sliding 60s ceiling (default 180k = 90% of
  //                            the Tier 1 200k cap, leaving headroom for
  //                            shared-org bursts and counter drift).
  //   OPENAI_PER_REQUEST_MAX — hard cap on a single request (default 150k
  //                            = 75% of 200k; reserves output tokens for
  //                            chat replies and prevents instant 429s).
  //   OPENAI_RETRY_MAX       — number of 429 retries before giving up.
  //   OPENAI_OUTPUT_RESERVE  — tokens reserved up-front for the assistant's
  //                            reply on chat calls (refunded post-call from
  //                            usage.total_tokens).
  OPENAI_TPM_LIMIT: z.coerce.number().int().positive().default(180_000),
  OPENAI_PER_REQUEST_MAX: z.coerce.number().int().positive().default(150_000),
  OPENAI_RETRY_MAX: z.coerce.number().int().nonnegative().default(5),
  OPENAI_OUTPUT_RESERVE: z.coerce.number().int().nonnegative().default(4_096),

  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),

  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-5.4-nano-2026-03-17'),

  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('llama3'),

  COPILOT_GITHUB_TOKEN: z.string().default(''),
  GH_TOKEN: z.string().default(''),
  COPILOT_MODEL: z.string().default('gpt-4o'),

  AWS_ACCESS_KEY_ID: z.string().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().default(''),
  AWS_REGION: z.string().default('us-east-1'),
  BEDROCK_MODEL: z.string().default('anthropic.claude-3-5-sonnet-20241022-v2:0'),

  GITHUB_TOKEN: z.string().default(''),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(z.treeifyError(parsed.error));
  process.exit(1);
}

export const env: Env = parsed.data;
