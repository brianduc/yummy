/**
 * Runtime-mutable provider configuration.
 * Mirrors Python's API_CONFIG dict — routers can mutate this at runtime
 * via /config/* endpoints. Initialized from env at boot, then overridden
 * by any values previously persisted to SQLite (DB wins over env).
 */
import { env } from './env.js';
import { providerConfigRepo } from '../db/repositories/provider-config.repo.js';

export type Provider = 'gemini' | 'openai' | 'ollama' | 'copilot' | 'bedrock';

export interface RuntimeConfig {
  gemini_key: string;
  gemini_model: string;
  ollama_base_url: string;
  ollama_model: string;
  copilot_token: string;
  copilot_model: string;
  openai_key: string;
  openai_model: string;
  bedrock_access_key: string;
  bedrock_secret_key: string;
  bedrock_region: string;
  bedrock_model: string;
  provider: Provider;
  openai_base_url: string;
}

// Step 1: seed from env (same as before — provides defaults / fallback)
export const runtimeConfig: RuntimeConfig = {
  gemini_key: env.GEMINI_API_KEY,
  gemini_model: env.GEMINI_MODEL,
  ollama_base_url: env.OLLAMA_BASE_URL,
  ollama_model: env.OLLAMA_MODEL,
  copilot_token: env.COPILOT_GITHUB_TOKEN || env.GH_TOKEN || env.GITHUB_TOKEN,
  copilot_model: env.COPILOT_MODEL,
  openai_key: env.OPENAI_API_KEY,
  openai_model: env.OPENAI_MODEL,
  openai_base_url: env.OPENAI_BASE_URL,
  bedrock_access_key: env.AWS_ACCESS_KEY_ID,
  bedrock_secret_key: env.AWS_SECRET_ACCESS_KEY,
  bedrock_region: env.AWS_REGION,
  bedrock_model: env.BEDROCK_MODEL,
  provider: env.AI_PROVIDER,
};

// Step 2: overwrite with DB-persisted values where non-empty (DB wins over env).
// Non-empty check ensures env fallback still works when a field was never set via UI.
const _saved = providerConfigRepo.get();
if (_saved) {
  if (_saved.provider) runtimeConfig.provider = _saved.provider as Provider;
  if (_saved.geminiKey) runtimeConfig.gemini_key = _saved.geminiKey;
  if (_saved.geminiModel) runtimeConfig.gemini_model = _saved.geminiModel;
  if (_saved.ollamaBaseUrl) runtimeConfig.ollama_base_url = _saved.ollamaBaseUrl;
  if (_saved.ollamaModel) runtimeConfig.ollama_model = _saved.ollamaModel;
  if (_saved.copilotToken) runtimeConfig.copilot_token = _saved.copilotToken;
  if (_saved.copilotModel) runtimeConfig.copilot_model = _saved.copilotModel;
  if (_saved.openaiKey) runtimeConfig.openai_key = _saved.openaiKey;
  if (_saved.openaiModel) runtimeConfig.openai_model = _saved.openaiModel;
  if (_saved.bedrockAccessKey) runtimeConfig.bedrock_access_key = _saved.bedrockAccessKey;
  if (_saved.bedrockSecretKey) runtimeConfig.bedrock_secret_key = _saved.bedrockSecretKey;
  if (_saved.bedrockRegion) runtimeConfig.bedrock_region = _saved.bedrockRegion;
  if (_saved.bedrockModel) runtimeConfig.bedrock_model = _saved.bedrockModel;
}

/** Snapshot of env-time defaults — used by /config/status `_key_source` detection. */
export const envDefaults: Readonly<RuntimeConfig> = Object.freeze({
  ...runtimeConfig,
});
