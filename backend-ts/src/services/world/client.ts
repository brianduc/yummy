import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import type { WorldServerRow } from '../../db/schema.js';
import { McpConnectionError, McpToolError } from '../../lib/errors.js';

const CONNECT_TIMEOUT_MS = 30_000;
const TOOL_CALL_TIMEOUT_MS = 60_000;
const HTTP_CONNECT_BACKOFF_MS = [1_000, 2_000, 4_000] as const;

function timeout(ms: number, message = `Operation timed out after ${ms}ms`): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseJsonArray(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.map(String) : undefined;
}

function parseHeaders(value: string | null): Record<string, string> | undefined {
  if (!value) return undefined;
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
  return Object.fromEntries(Object.entries(parsed).map(([key, headerValue]) => [key, String(headerValue)]));
}

function createClient(): Client {
  return new Client({ name: 'yummy-world', version: '1.0.0' }, { capabilities: {} });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createStdioClient(config: WorldServerRow): Promise<Client> {
  const client = createClient();

  try {
    const args = parseJsonArray(config.args) ?? [];
    const transport = new StdioClientTransport({ command: config.command!, args });
    await Promise.race([client.connect(transport), timeout(CONNECT_TIMEOUT_MS)]);
    return client;
  } catch (error) {
    throw new McpConnectionError(config.id, getErrorMessage(error));
  }
}

export async function createHttpClient(config: WorldServerRow): Promise<Client> {
  let lastError: unknown;

  for (let attempt = 0; attempt < HTTP_CONNECT_BACKOFF_MS.length; attempt += 1) {
    const client = createClient();

    try {
      const url = new URL(config.url!);
      const headers = parseHeaders(config.headersJson);
      const transport = new SSEClientTransport(url, headers ? { requestInit: { headers } } : undefined);
      await Promise.race([client.connect(transport), timeout(CONNECT_TIMEOUT_MS)]);
      return client;
    } catch (error) {
      lastError = error;
      await disconnectClient(client);

      const backoffMs = HTTP_CONNECT_BACKOFF_MS[attempt];
      if (attempt < HTTP_CONNECT_BACKOFF_MS.length - 1 && backoffMs !== undefined) {
        await delay(backoffMs);
      }
    }
  }

  throw new McpConnectionError(config.id, getErrorMessage(lastError));
}

export async function listTools(client: Client): Promise<Tool[]> {
  const tools: Tool[] = [];
  let cursor: string | undefined;

  try {
    do {
      const result = await client.listTools({ cursor });
      tools.push(...result.tools);
      cursor = result.nextCursor;
    } while (cursor);

    return tools;
  } catch (error) {
    throw new McpToolError('', '*', getErrorMessage(error));
  }
}

export async function callTool(
  client: Client,
  serverId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  try {
    return await Promise.race([
      client.callTool({ name, arguments: args }) as Promise<CallToolResult>,
      timeout(TOOL_CALL_TIMEOUT_MS, 'Tool call timed out after 60s'),
    ]);
  } catch (error) {
    throw new McpToolError(serverId, name, getErrorMessage(error));
  }
}

export async function disconnectClient(client: Client): Promise<void> {
  try {
    await client.close();
  } catch (error) {
    console.warn('Failed to close MCP client', error);
  }
}
