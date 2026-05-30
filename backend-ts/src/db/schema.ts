/**
 * Drizzle schema — Postgres.
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
import { bigint, boolean, doublePrecision, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// ─── Sessions ────────────────────────────────────────────
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),

  // JSON arrays / objects
  logs: jsonb('logs')
    .notNull()
    .$type<Array<{ role: string; text: string }>>()
    .default(sql`'[]'::jsonb`),
  chatHistory: jsonb('chat_history')
    .notNull()
    .$type<Array<{ role: string; text: string; timestamp?: string; trace?: unknown }>>()
    .default(sql`'[]'::jsonb`),
  agentOutputs: jsonb('agent_outputs')
    .notNull()
    .$type<Record<string, unknown>>()
    .default(sql`'{}'::jsonb`),
  jiraBacklog: jsonb('jira_backlog')
    .notNull()
    .$type<unknown[]>()
    .default(sql`'[]'::jsonb`),
  metrics: jsonb('metrics')
    .notNull()
    .$type<{ tokens: number }>()
    .default(sql`'{"tokens":0}'::jsonb`),

  workflowState: text('workflow_state').notNull().default('idle'),
});

// ─── Knowledge base — tree (one row per file) ────────────
export const kbTree = pgTable('kb_tree', {
  path: text('path').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull().default('pending'), // pending | processing | done
});

// ─── Knowledge base — insights (one row per chunk) ───────
export const kbInsights = pgTable('kb_insights', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  files: jsonb('files').notNull().$type<string[]>(),
  summary: text('summary').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(), // ms epoch (sort order)
});

// ─── Knowledge base — singleton meta row (project summary) ─
export const kbMeta = pgTable('kb_meta', {
  id: integer('id').primaryKey().default(1),
  projectSummary: text('project_summary').notNull().default(''),
});

// ─── Repo info — singleton row id=1 ──────────────────────
export const repoInfo = pgTable('repo_info', {
  id: integer('id').primaryKey().default(1),
  owner: text('owner').notNull(),
  repo: text('repo').notNull(),
  branch: text('branch'),
  url: text('url').notNull(),
  githubToken: text('github_token').notNull().default(''),
  maxScanLimit: integer('max_scan_limit').notNull().default(10000),
});

// ─── World servers ───────────────────────────────────────
export const worldServers = pgTable('world_servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  transport: text('transport').notNull(),
  command: text('command'),
  args: jsonb('args').$type<string[]>(),
  url: text('url'),
  headersJson: jsonb('headers_json').$type<Record<string, unknown>>(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  lastStatus: text('last_status').notNull().default('unknown'),
});

// ─── Scan status — singleton row id=1 (nullable when no scan yet) ─
export const scanStatus = pgTable('scan_status', {
  id: integer('id').primaryKey().default(1),
  running: boolean('running').notNull().default(false),
  text: text('text').notNull().default(''),
  progress: integer('progress').notNull().default(0),
  error: boolean('error').notNull().default(false),
  // Track whether a status row has been initialized — Python uses None as "no scan".
  initialized: boolean('initialized').notNull().default(false),
});

// ─── Request logs (newest-first via id DESC) ─────────────
export const requestLogs = pgTable('request_logs', {
  id: bigint('id', { mode: 'number' }).primaryKey(), // ms epoch (matches Python int(time.time()*1000))
  time: text('time').notNull(), // HH:MM:SS
  agent: text('agent').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  inTokens: integer('in_tokens').notNull(),
  outTokens: integer('out_tokens').notNull(),
  latency: doublePrecision('latency').notNull(),
  cost: doublePrecision('cost').notNull(),
});

// ─── Provider config — singleton row id=1 ────────────────
export const providerConfig = pgTable('provider_config', {
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
  openaiBaseUrl: text('openai_base_url').notNull().default(''),
  bedrockAccessKey: text('bedrock_access_key').notNull().default(''),
  bedrockSecretKey: text('bedrock_secret_key').notNull().default(''),
  bedrockRegion: text('bedrock_region').notNull().default(''),
  bedrockModel: text('bedrock_model').notNull().default(''),
});

export const worldConfig = pgTable('world_config', {
  id: integer('id').primaryKey().default(1),
  mcpServerToken: text('mcp_server_token').notNull().default(''),
  mcpServerEnabled: boolean('mcp_server_enabled').notNull().default(false),
  mcpServerPort: text('mcp_server_port').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

// ─── Inferred row types ──────────────────────────────────
export type SessionRow = typeof sessions.$inferSelect;
export type SessionInsert = typeof sessions.$inferInsert;
export type KbTreeRow = typeof kbTree.$inferSelect;
export type KbInsightRow = typeof kbInsights.$inferSelect;
export type RepoInfoRow = typeof repoInfo.$inferSelect;
export type WorldServerRow = typeof worldServers.$inferSelect;
export type WorldServerInsert = typeof worldServers.$inferInsert;
export type ScanStatusRow = typeof scanStatus.$inferSelect;
export type RequestLogRow = typeof requestLogs.$inferSelect;
export type RequestLogInsert = typeof requestLogs.$inferInsert;
export type ProviderConfigRow = typeof providerConfig.$inferSelect;
export type WorldConfigRow = typeof worldConfig.$inferSelect;
export type WorldConfigInsert = typeof worldConfig.$inferInsert;
