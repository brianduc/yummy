/**
 * Environment loader for Cloudflare Workers.
 * Reads from Worker env bindings (c.env) instead of process.env.
 */
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  DATABASE_URL: z.string().default(''),

  AI_PROVIDER: z.enum(['gemini', 'openai', 'ollama', 'copilot', 'bedrock']).default('gemini'),

  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),

  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-5.4-nano-2026-03-17'),
  OPENAI_BASE_URL: z.string().default(''),

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

export function loadEnv(raw: Record<string, string | undefined>): Env {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${JSON.stringify(z.treeifyError(parsed.error))}`);
  }

  return parsed.data;
}

// Backwards-compatible default for modules initialized outside a Worker request.
export const env: Env = loadEnv(typeof process === 'undefined' ? {} : process.env);
