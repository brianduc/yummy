/**
 * Shared integration test setup:
 *   - in-memory SQLite
 *   - migrate before all
 *   - reset all tables before each test
 *   - mock AI dispatcher (callAI/streamAI)
 *   - mock github service (no real network)
 *
 * Import this file FIRST in every integration test (before importing app.ts
 * or any router) so DATABASE_URL is set before db/client.ts is evaluated.
 */
process.env.DATABASE_URL = ':memory:';

import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { beforeAll, beforeEach, vi } from 'vitest';

import { db } from '../../src/db/client.js';
import { createWorldServer, updateWorldConfig } from '../../src/db/repositories/world.repo.js';
import { kbRepo } from '../../src/db/repositories/kb.repo.js';
import { logsRepo } from '../../src/db/repositories/logs.repo.js';
import { repoRepo } from '../../src/db/repositories/repo.repo.js';
import { scanStatusRepo } from '../../src/db/repositories/scan-status.repo.js';
import { sessionsRepo } from '../../src/db/repositories/sessions.repo.js';
import {
  worldConfig,
  worldServers,
  type WorldConfigInsert,
  type WorldServerInsert,
  type WorldServerRow,
} from '../../src/db/schema.js';

// ─── AI dispatcher mock ───────────────────────────────
const aiResponses = new Map<string, string>();
let defaultResponse = 'mock-ai-response';

export function setAIResponse(agentRole: string, text: string): void {
  aiResponses.set(agentRole, text);
}
export function setDefaultAIResponse(text: string): void {
  defaultResponse = text;
}
export function clearAIResponses(): void {
  aiResponses.clear();
  defaultResponse = 'mock-ai-response';
}

vi.mock('../../src/services/ai/dispatcher.js', () => ({
  callAI: vi.fn(async (agentRole: string) => {
    return aiResponses.get(agentRole) ?? defaultResponse;
  }),
  streamAI: vi.fn(async function* () {
    yield 'mock ';
    yield 'streamed ';
    yield 'response';
  }),
}));

// ─── Mock GitHub service — avoids real network ────────
vi.mock('../../src/services/github/github.service.js', () => ({
  githubFetch: vi.fn(),
  githubRaw: vi.fn(async () => 'mock file contents'),
  getRepoInfo: vi.fn(async () => ({
    default_branch: 'main',
    name: 'mock-repo',
    full_name: 'mock-owner/mock-repo',
  })),
  getRepoTree: vi.fn(async () => [
    { path: 'README.md', type: 'blob' as const, size: 12 },
    { path: 'src/index.ts', type: 'blob' as const, size: 100 },
  ]),
}));

// ─── MCP transport mocks ──────────────────────────────────
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  const mockClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({
      tools: [{ name: 'mock.echo', description: 'Echo tool', inputSchema: { type: 'object', properties: {} } }],
      nextCursor: undefined,
    }),
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'mock-tool-result' }],
      isError: false,
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return { Client: vi.fn(() => mockClient) };
});

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn(() => ({})),
}));

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: vi.fn(() => ({})),
}));

export async function seedWorldServer(overrides: Partial<WorldServerInsert> = {}): Promise<WorldServerRow> {
  const insert: WorldServerInsert = {
    id: overrides.id ?? `test-srv-${Date.now()}`,
    name: overrides.name ?? 'Test Server',
    transport: overrides.transport ?? 'stdio',
    command: overrides.command ?? 'echo',
    args: overrides.args ?? '["hello"]',
    url: overrides.url ?? null,
    headersJson: overrides.headersJson ?? null,
    enabled: overrides.enabled ?? true,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    lastStatus: overrides.lastStatus ?? 'unknown',
  };
  return createWorldServer(insert);
}

export async function seedWorldConfig(overrides: Partial<WorldConfigInsert> = {}): Promise<void> {
  await updateWorldConfig(overrides);
}

export function resetWorldData(): void {
  db.delete(worldServers).run();
  // world_config singleton stays (reset to defaults)
  db.update(worldConfig).set({ mcpServerToken: '', mcpServerEnabled: false, mcpServerPort: '' }).run();
}

beforeAll(() => {
  migrate(db, {
    migrationsFolder: resolve(__dirname, '../../src/db/migrations'),
  });
});

beforeEach(() => {
  for (const s of sessionsRepo.list()) sessionsRepo.delete(s.id);
  kbRepo.resetAll();
  repoRepo.clear();
  scanStatusRepo.clear();
  logsRepo.clear();
  clearAIResponses();
  resetWorldData();
});
