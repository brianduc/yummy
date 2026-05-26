/**
 * Provider config repository — singleton row id=1.
 * Persists runtime-mutable AI provider settings to SQLite so they survive restarts.
 * Returns undefined if not yet saved (pre-migration or first boot).
 */
import { eq } from 'drizzle-orm';
import type { RuntimeConfig } from '../../config/runtime.js';
import type { Db } from '../client.js';
import { type ProviderConfigRow, providerConfig } from '../schema.js';

type DB = Db;
export type ProviderConfig = ProviderConfigRow;

export const providerConfigRepo = {
  /**
   * Load the persisted config row.
   * Returns undefined when:
   *   - table does not exist yet (migration not run)
   *   - no row has been saved yet (first boot before any /config/* call)
   */
  async get(db: DB): Promise<ProviderConfig | undefined> {
    try {
      return await db.select().from(providerConfig).where(eq(providerConfig.id, 1)).get();
    } catch {
      // Table not yet created (pre-migration state) — fall back to env gracefully.
      return undefined;
    }
  },

  /**
   * Persist the full runtimeConfig snapshot to the singleton row.
   * Inserts on first call, updates on subsequent calls.
   */
  async upsert(db: DB, cfg: RuntimeConfig): Promise<void> {
    const row = {
      id: 1 as const,
      provider: cfg.provider,
      geminiKey: cfg.gemini_key,
      geminiModel: cfg.gemini_model,
      ollamaBaseUrl: cfg.ollama_base_url,
      ollamaModel: cfg.ollama_model,
      copilotToken: cfg.copilot_token,
      copilotModel: cfg.copilot_model,
      openaiKey: cfg.openai_key,
      openaiModel: cfg.openai_model,
      bedrockAccessKey: cfg.bedrock_access_key,
      bedrockSecretKey: cfg.bedrock_secret_key,
      bedrockRegion: cfg.bedrock_region,
      bedrockModel: cfg.bedrock_model,
    };

    try {
      const existing = await db.select().from(providerConfig).where(eq(providerConfig.id, 1)).get();
      if (existing) {
        await db.update(providerConfig).set(row).where(eq(providerConfig.id, 1)).run();
      } else {
        await db.insert(providerConfig).values(row).run();
      }
    } catch {
      // Table not yet created — silently skip (migration pending).
    }
  },
};
