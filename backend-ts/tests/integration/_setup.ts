import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { afterAll, beforeAll, beforeEach, vi } from 'vitest';

import { closePostgresClient, createDb, getMigratorDb } from '../../src/db/client.js';
import { createWorldServer, updateWorldConfig } from '../../src/db/repositories/world.repo.js';
import type {
  WorldConfigInsert,
  WorldServerInsert,
  WorldServerRow,
} from '../../src/db/schema.js';

const db = createDb();

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

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  const mockClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({
      tools: [
        {
          name: 'mock.echo',
          description: 'Echo tool',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
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

export async function seedWorldServer(
  overrides: Partial<WorldServerInsert> = {},
): Promise<WorldServerRow> {
  const insert: WorldServerInsert = {
    id: overrides.id ?? `test-srv-${Date.now()}`,
    name: overrides.name ?? 'Test Server',
    transport: overrides.transport ?? 'stdio',
    command: overrides.command ?? 'echo',
    args: overrides.args ?? ['hello'],
    url: overrides.url ?? null,
    headersJson: overrides.headersJson ?? null,
    enabled: overrides.enabled ?? true,
    lastStatus: overrides.lastStatus ?? 'unknown',
  };
  return await createWorldServer(db, insert);
}

export async function seedWorldConfig(overrides: Partial<WorldConfigInsert> = {}): Promise<void> {
  await updateWorldConfig(db, overrides);
}

export async function resetWorldData(): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE world_servers RESTART IDENTITY CASCADE`);
}

beforeAll(async () => {
  const migratorDb = getMigratorDb();
  await migrate(migratorDb, {
    migrationsFolder: resolve(import.meta.dirname, '../../src/db/migrations'),
  });
  await migratorDb.$client.end({ timeout: 5 });
}, 30_000);

beforeEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE
      sessions,
      kb_tree,
      kb_insights,
      kb_meta,
      repo_info,
      scan_status,
      request_logs,
      world_servers,
      world_config,
      provider_config
    RESTART IDENTITY CASCADE
  `);
  clearAIResponses();
});

afterAll(async () => {
  await closePostgresClient();
});
