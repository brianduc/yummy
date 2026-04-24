/**
 * Drizzle schema — SQLite.
 *
 * Tables map 1:1 to the Python in-memory DB dict:
 *   sessions                   -> sessions
 *   knowledge_base.tree        -> kb_tree
 *   knowledge_base.insights    -> kb_insights
 *   knowledge_base.project_*   -> kb_meta (singleton row id=1)
 *   repo_info                  -> repo_info (singleton id=1)
 *   scan_status                -> scan_status (singleton id=1)
 *   request_logs               -> request_logs (newest first via id DESC)
 *
 * JSON columns store arrays/objects that are read/written wholesale
 * (chat_history, agent_outputs, jira_backlog, logs, files[]).
 */
import { sql } from 'drizzle-orm';
import {
  integer,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

// ─── Sessions ────────────────────────────────────────────
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),

  // JSON arrays / objects
  logs: text('logs', { mode: 'json' })
    .notNull()
    .$type<Array<{ role: string; text: string }>>()
    .default(sql`'[]'`),
  chatHistory: text('chat_history', { mode: 'json' })
    .notNull()
    .$type<Array<{ role: string; text: string; trace?: unknown }>>()
    .default(sql`'[]'`),
  agentOutputs: text('agent_outputs', { mode: 'json' })
    .notNull()
    .$type<Record<string, unknown>>()
    .default(sql`'{}'`),
  jiraBacklog: text('jira_backlog', { mode: 'json' })
    .notNull()
    .$type<unknown[]>()
    .default(sql`'[]'`),
  metrics: text('metrics', { mode: 'json' })
    .notNull()
    .$type<{ tokens: number }>()
    .default(sql`'{"tokens":0}'`),

  workflowState: text('workflow_state').notNull().default('idle'),
});

// ─── Knowledge base — tree (one row per file) ────────────
export const kbTree = sqliteTable('kb_tree', {
  path: text('path').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull().default('pending'), // pending | processing | done
});

// ─── Knowledge base — insights (one row per chunk) ───────
export const kbInsights = sqliteTable('kb_insights', {
  id: integer('id').primaryKey(),
  files: text('files', { mode: 'json' }).notNull().$type<string[]>(),
  summary: text('summary').notNull(),
  createdAt: integer('created_at').notNull(), // ms epoch (sort order)
});

// ─── Knowledge base — singleton meta row (project summary) ─
export const kbMeta = sqliteTable('kb_meta', {
  id: integer('id').primaryKey().default(1),
  projectSummary: text('project_summary').notNull().default(''),
});

// ─── Repo info — singleton row id=1 ──────────────────────
export const repoInfo = sqliteTable('repo_info', {
  id: integer('id').primaryKey().default(1),
  owner: text('owner').notNull(),
  repo: text('repo').notNull(),
  branch: text('branch'),
  url: text('url').notNull(),
  githubToken: text('github_token').notNull().default(''),
  maxScanLimit: integer('max_scan_limit').notNull().default(10000),
});

// ─── Scan status — singleton row id=1 (nullable when no scan yet) ─
export const scanStatus = sqliteTable('scan_status', {
  id: integer('id').primaryKey().default(1),
  running: integer('running', { mode: 'boolean' }).notNull().default(false),
  text: text('text').notNull().default(''),
  progress: integer('progress').notNull().default(0),
  error: integer('error', { mode: 'boolean' }).notNull().default(false),
  // Track whether a status row has been initialized — Python uses None as "no scan".
  initialized: integer('initialized', { mode: 'boolean' }).notNull().default(false),
  // Code-intel (gitnexus + embeddings) health — separate from the overall scan
  // error flag because legacy AI-insights can succeed even when RAG is down.
  // codeIntelOk = NULL means "scan never reached the code-intel phase".
  codeIntelOk: integer('code_intel_ok', { mode: 'boolean' }),
  codeIntelMessage: text('code_intel_message').notNull().default(''),
});

// ─── Request logs (newest-first via id DESC) ─────────────
export const requestLogs = sqliteTable('request_logs', {
  id: integer('id').primaryKey(), // ms epoch (matches Python int(time.time()*1000))
  time: text('time').notNull(),   // HH:MM:SS
  agent: text('agent').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  inTokens: integer('in_tokens').notNull(),
  outTokens: integer('out_tokens').notNull(),
  latency: real('latency').notNull(),
  cost: real('cost').notNull(),
});

// ─── Provider config — singleton row id=1 ────────────────
export const providerConfig = sqliteTable('provider_config', {
  id: integer('id').primaryKey().default(1),
  provider: text('provider').notNull().default('gemini'),
  geminiKey: text('gemini_key').notNull().default(''),
  geminiModel: text('gemini_model').notNull().default(''),
  ollamaBaseUrl: text('ollama_base_url').notNull().default(''),
  ollamaModel: text('ollama_model').notNull().default(''),
  copilotToken: text('copilot_token').notNull().default(''),
  copilotModel: text('copilot_model').notNull().default(''),
  openaiKey: text('openai_key').notNull().default(''),
  openaiModel: text('openai_model').notNull().default(''),
  bedrockAccessKey: text('bedrock_access_key').notNull().default(''),
  bedrockSecretKey: text('bedrock_secret_key').notNull().default(''),
  bedrockRegion: text('bedrock_region').notNull().default(''),
  bedrockModel: text('bedrock_model').notNull().default(''),
  // OpenAI rate-limiter overrides — settable at runtime via /config/rate-limits
  openaiPerRequestMax: integer('openai_per_request_max').notNull().default(150_000),
  openaiTpmLimit: integer('openai_tpm_limit').notNull().default(180_000),
});

// ─── Inferred row types ──────────────────────────────────
export type SessionRow = typeof sessions.$inferSelect;
export type SessionInsert = typeof sessions.$inferInsert;
export type KbTreeRow = typeof kbTree.$inferSelect;
export type KbInsightRow = typeof kbInsights.$inferSelect;
export type RepoInfoRow = typeof repoInfo.$inferSelect;
export type ScanStatusRow = typeof scanStatus.$inferSelect;
export type RequestLogRow = typeof requestLogs.$inferSelect;
export type RequestLogInsert = typeof requestLogs.$inferInsert;
export type ProviderConfigRow = typeof providerConfig.$inferSelect;
