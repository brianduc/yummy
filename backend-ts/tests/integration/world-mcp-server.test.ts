import { beforeEach, describe, expect, it } from 'vitest';
import './_setup.js';
import { createApp } from '../../src/app.js';
import { resetWorldData } from './_setup.js';

const MCP_TOKEN = 'test-mcp-token';

type App = ReturnType<typeof createApp>;
type JsonRpcResponse = {
  jsonrpc: string;
  id: number;
  result?: unknown;
  error?: unknown;
};
type TextContentResult = {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
};

function mcpRequest(method: string, params?: unknown, id = 1) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params });
}

async function postMcp(app: App, body: string, token?: string) {
  const headers: Record<string, string> = { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return app.request('/world/mcp', { method: 'POST', headers, body });
}

async function readJsonRpc(res: Response): Promise<JsonRpcResponse> {
  return (await res.json()) as JsonRpcResponse;
}

function expectTextResult(result: unknown): TextContentResult {
  const textResult = result as TextContentResult;
  expect(textResult.content).toBeDefined();
  expect(textResult.content[0]?.type).toBe('text');
  return textResult;
}

describe('POST /world/mcp — MCP server endpoint', () => {
  let app: App;

  beforeEach(async () => {
    resetWorldData();
    app = createApp();
    await app.request('/world/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mcp_server_enabled: true, mcp_server_token: MCP_TOKEN }),
    });
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await postMcp(app, mcpRequest('initialize'));

    expect(res.status).toBe(401);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toBe('Unauthorized');
  });

  it('returns 401 when bearer token is wrong', async () => {
    const res = await postMcp(app, mcpRequest('initialize'), 'wrong-token');

    expect(res.status).toBe(401);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toBe('Unauthorized');
  });

  it('returns 401 when Authorization header is not bearer', async () => {
    const res = await app.request('/world/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: MCP_TOKEN },
      body: mcpRequest('initialize'),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toBe('Unauthorized');
  });

  it('returns 503 when MCP server is disabled', async () => {
    await app.request('/world/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mcp_server_enabled: false }),
    });

    const res = await postMcp(app, mcpRequest('initialize'), MCP_TOKEN);

    expect(res.status).toBe(503);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toBe('MCP server is disabled');
  });

  it('responds to initialize request', async () => {
    const res = await postMcp(
      app,
      mcpRequest('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'vitest', version: '1.0.0' } }),
      MCP_TOKEN,
    );

    expect(res.status).toBe(200);
    const body = await readJsonRpc(res);
    expect(body.jsonrpc).toBe('2.0');
    expect(body.id).toBe(1);
    expect((body.result as { serverInfo: { name: string } }).serverInfo.name).toBe('yummy-world');
  });

  it('tools/list returns all Yummy tool definitions', async () => {
    const res = await postMcp(app, mcpRequest('tools/list', {}), MCP_TOKEN);

    expect(res.status).toBe(200);
    const body = await readJsonRpc(res);
    const tools = (body.result as { tools: Array<{ name: string; description?: string; inputSchema?: unknown }> }).tools;
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThanOrEqual(8);
    expect(tools.every((tool) => tool.name.startsWith('yummy.'))).toBe(true);
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'yummy.rag_ask',
        'yummy.rag_ask_free',
        'yummy.get_kb_insights',
        'yummy.get_kb_summary',
        'yummy.session_create',
        'yummy.session_list',
        'yummy.sdlc_start',
        'yummy.sdlc_status',
      ]),
    );
  });

  it('tools/call yummy.session_list returns session list', async () => {
    const res = await postMcp(app, mcpRequest('tools/call', { name: 'yummy.session_list', arguments: {} }), MCP_TOKEN);

    expect(res.status).toBe(200);
    const body = await readJsonRpc(res);
    const result = expectTextResult(body.result);
    expect(JSON.parse(result.content[0]?.text ?? 'not-json')).toEqual([]);
  });

  it('tools/call yummy.get_kb_summary returns text result', async () => {
    const res = await postMcp(app, mcpRequest('tools/call', { name: 'yummy.get_kb_summary', arguments: {} }), MCP_TOKEN);

    expect(res.status).toBe(200);
    const body = await readJsonRpc(res);
    const result = expectTextResult(body.result);
    expect(result.content[0]?.text).toBe('No project summary available.');
  });

  it('tools/call unknown tool returns isError result', async () => {
    const res = await postMcp(app, mcpRequest('tools/call', { name: 'yummy.nope', arguments: {} }), MCP_TOKEN);

    expect(res.status).toBe(200);
    const body = await readJsonRpc(res);
    const result = expectTextResult(body.result);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('Unknown tool: yummy.nope');
  });

  it('tools/call yummy.session_create creates a session', async () => {
    const res = await postMcp(app, mcpRequest('tools/call', { name: 'yummy.session_create', arguments: { name: 'MCP Session' } }), MCP_TOKEN);

    expect(res.status).toBe(200);
    const body = await readJsonRpc(res);
    const result = expectTextResult(body.result);
    const session = JSON.parse(result.content[0]?.text ?? '{}') as { id: string; name: string };
    expect(session.id).toBeTruthy();
    expect(session.name).toBe('MCP Session');
  });

  it('tools/call yummy.get_kb_insights returns fallback text result', async () => {
    const res = await postMcp(app, mcpRequest('tools/call', { name: 'yummy.get_kb_insights', arguments: {} }), MCP_TOKEN);

    expect(res.status).toBe(200);
    const body = await readJsonRpc(res);
    const result = expectTextResult(body.result);
    expect(result.content[0]?.text).toBe('No insights available.');
  });

  it('tools/call yummy.rag_ask_free uses mocked AI and returns text result', async () => {
    const res = await postMcp(app, mcpRequest('tools/call', { name: 'yummy.rag_ask_free', arguments: { question: 'hello' } }), MCP_TOKEN);

    expect(res.status).toBe(200);
    const body = await readJsonRpc(res);
    const result = expectTextResult(body.result);
    expect(result.content[0]?.text).toBe('mock-ai-response');
  });

  it('tools/call yummy.sdlc_status returns an error text result for unknown session', async () => {
    const res = await postMcp(app, mcpRequest('tools/call', { name: 'yummy.sdlc_status', arguments: { session_id: 'missing' } }), MCP_TOKEN);

    expect(res.status).toBe(200);
    const body = await readJsonRpc(res);
    const result = expectTextResult(body.result);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('Session missing not found.');
  });
});
