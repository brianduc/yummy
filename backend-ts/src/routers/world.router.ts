import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { randomUUID } from 'node:crypto';
import { HttpError, McpConnectionError, McpToolError } from '../lib/errors.js';
import { requireMcpServer } from '../lib/guards.js';
import {
  createWorldServer,
  deleteWorldServer,
  getWorldConfig,
  listWorldServers,
  updateWorldConfig,
  updateWorldServer,
} from '../db/repositories/world.repo.js';
import { logsRepo } from '../db/repositories/logs.repo.js';
import { callTool, listTools } from '../services/world/client.js';
import { handleMcpRequest } from '../services/world/server.js';
import {
  connectServer,
  disconnectServer,
  getClient,
  isConnected,
} from '../services/world/registry.js';
import {
  ToolInvokeRequestSchema,
  ToolInvokeResponseSchema,
  ToolListResponseSchema,
  type ToolInvokeResponse,
  type ToolListResponse,
  WorldConfigSchema,
  WorldConfigUpdateSchema,
  WorldServerCreateSchema,
  WorldServerSchema,
  type WorldServer,
  WorldServerUpdateSchema,
} from '../schemas/world.schema.js';
import type { WorldServerRow } from '../db/schema.js';
import { ErrorSchema } from '../schemas/common.schema.js';

export const worldRouter = new OpenAPIHono();

const json = <T extends z.ZodTypeAny>(schema: T) => ({ 'application/json': { schema } });

function mapServerRow(row: WorldServerRow): WorldServer {
  return {
    id: row.id,
    name: row.name,
    transport: row.transport as 'stdio' | 'http',
    command: row.command ?? null,
    args: row.args ? (JSON.parse(row.args) as string[]) : null,
    url: row.url ?? null,
    headers_json: row.headersJson ?? null,
    enabled: row.enabled,
    created_at: row.createdAt,
    last_status: row.lastStatus as 'connected' | 'disconnected' | 'error' | 'unknown',
  };
}

function mapConfigRow(row: { mcpServerToken: string; mcpServerEnabled: boolean; mcpServerPort: string }) {
  return {
    mcp_server_enabled: row.mcpServerEnabled,
    mcp_server_token_set: row.mcpServerToken !== '',
    mcp_server_port: row.mcpServerPort,
  };
}

worldRouter.openapi(
  createRoute({
    method: 'get',
    path: '/world/config',
    tags: ['World'],
    responses: { 200: { content: json(WorldConfigSchema), description: 'OK' } },
  }),
  async (c) => {
    const config = await getWorldConfig();
    return c.json(mapConfigRow(config));
  },
);

worldRouter.openapi(
  createRoute({
    method: 'put',
    path: '/world/config',
    tags: ['World'],
    request: { body: { content: json(WorldConfigUpdateSchema) } },
    responses: { 200: { content: json(WorldConfigSchema), description: 'OK' } },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const updated = await updateWorldConfig({
      ...(body.mcp_server_token !== undefined && { mcpServerToken: body.mcp_server_token }),
      ...(body.mcp_server_enabled !== undefined && { mcpServerEnabled: body.mcp_server_enabled }),
      ...(body.mcp_server_port !== undefined && { mcpServerPort: body.mcp_server_port }),
    });
    return c.json(mapConfigRow(updated));
  },
);

worldRouter.openapi(
  createRoute({
    method: 'get',
    path: '/world/servers',
    tags: ['World'],
    responses: { 200: { content: json(z.array(WorldServerSchema)), description: 'OK' } },
  }),
  async (c) => {
    const servers = await listWorldServers();
    return c.json(servers.map(mapServerRow));
  },
);

worldRouter.openapi(
  createRoute({
    method: 'get',
    path: '/world/servers/:id',
    tags: ['World'],
    responses: {
      200: { content: json(WorldServerSchema), description: 'OK' },
      404: { content: json(ErrorSchema), description: 'Not found' },
    },
  }),
  async (c) => {
    const server = await requireMcpServer(c.req.param('id'));
    return c.json(mapServerRow(server), 200);
  },
);

worldRouter.openapi(
  createRoute({
    method: 'post',
    path: '/world/servers',
    tags: ['World'],
    request: { body: { content: json(WorldServerCreateSchema) } },
    responses: {
      201: { content: json(WorldServerSchema), description: 'Created' },
      400: { content: json(ErrorSchema), description: 'Validation error' },
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const created = await createWorldServer({
      id: randomUUID(),
      name: body.name,
      transport: body.transport,
      command: body.command ?? null,
      args: body.args ? JSON.stringify(body.args) : null,
      url: body.url ?? null,
      headersJson: body.headers_json ?? null,
      enabled: body.enabled ?? true,
      createdAt: new Date().toISOString(),
      lastStatus: 'unknown',
    });
    return c.json(mapServerRow(created), 201);
  },
);

worldRouter.openapi(
  createRoute({
    method: 'put',
    path: '/world/servers/:id',
    tags: ['World'],
    request: { body: { content: json(WorldServerUpdateSchema) } },
    responses: {
      200: { content: json(WorldServerSchema), description: 'OK' },
      404: { content: json(ErrorSchema), description: 'Not found' },
    },
  }),
  async (c) => {
    const id = c.req.param('id');
    await requireMcpServer(id);
    const body = c.req.valid('json');
    const updated = await updateWorldServer(id, {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.transport !== undefined && { transport: body.transport }),
      ...(body.command !== undefined && { command: body.command }),
      ...(body.args !== undefined && { args: JSON.stringify(body.args) }),
      ...(body.url !== undefined && { url: body.url }),
      ...(body.headers_json !== undefined && { headersJson: body.headers_json }),
      ...(body.enabled !== undefined && { enabled: body.enabled }),
    });
    if (!updated) throw new HttpError(404, `MCP server not found: ${id}`);
    return c.json(mapServerRow(updated), 200);
  },
);

worldRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/world/servers/:id',
    tags: ['World'],
    responses: {
      200: { content: json(z.object({ detail: z.string() })), description: 'OK' },
      404: { content: json(ErrorSchema), description: 'Not found' },
    },
  }),
  async (c) => {
    const id = c.req.param('id');
    await requireMcpServer(id);
    if (isConnected(id)) await disconnectServer(id);
    await deleteWorldServer(id);
    return c.json({ detail: 'deleted' });
  },
);

worldRouter.openapi(
  createRoute({
    method: 'post',
    path: '/world/servers/:id/connect',
    tags: ['World'],
    responses: {
      200: { content: json(z.object({ detail: z.string() })), description: 'OK' },
      404: { content: json(ErrorSchema), description: 'Not found' },
      502: { content: json(ErrorSchema), description: 'Connection failed' },
    },
  }),
  async (c) => {
    const id = c.req.param('id');
    const server = await requireMcpServer(id);
    try {
      await connectServer(server);
      return c.json({ detail: 'connected' });
    } catch (err) {
      throw new HttpError(502, err instanceof Error ? err.message : String(err));
    }
  },
);

worldRouter.openapi(
  createRoute({
    method: 'post',
    path: '/world/servers/:id/disconnect',
    tags: ['World'],
    responses: {
      200: { content: json(z.object({ detail: z.string() })), description: 'OK' },
      404: { content: json(ErrorSchema), description: 'Not found' },
    },
  }),
  async (c) => {
    const id = c.req.param('id');
    await requireMcpServer(id);
    await disconnectServer(id);
    return c.json({ detail: 'disconnected' });
  },
);

worldRouter.openapi(
  createRoute({
    method: 'get',
    path: '/world/servers/:id/tools',
    tags: ['World'],
    responses: {
      200: { content: json(ToolListResponseSchema), description: 'OK' },
      404: { content: json(ErrorSchema), description: 'Not found' },
      503: { content: json(ErrorSchema), description: 'Not connected' },
    },
  }),
  async (c) => {
    const id = c.req.param('id');
    await requireMcpServer(id);
    const client = getClient(id);
    if (!client) throw new HttpError(503, 'MCP server not connected');
    const tools = await listTools(client);
    const response: ToolListResponse = {
      server_id: id,
      tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema })),
    };
    return c.json(response, 200);
  },
);

worldRouter.openapi(
  createRoute({
    method: 'post',
    path: '/world/invoke',
    tags: ['World'],
    request: { body: { content: json(ToolInvokeRequestSchema) } },
    responses: {
      200: { content: json(ToolInvokeResponseSchema), description: 'OK' },
      404: { content: json(ErrorSchema), description: 'Server not found' },
      503: { content: json(ErrorSchema), description: 'Not connected' },
      502: { content: json(ErrorSchema), description: 'Tool error' },
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const server = await requireMcpServer(body.server_id);

    let client = getClient(body.server_id);
    if (!client) {
      try {
        await connectServer(server);
      } catch {
        throw new HttpError(503, 'MCP server not connected');
      }
      client = getClient(body.server_id);
      if (!client) throw new HttpError(503, 'MCP server not connected');
    }

    try {
      const result = await callTool(client, body.server_id, body.tool_name, body.arguments);
      logsRepo.add({
        id: Date.now(),
        time: new Date().toTimeString().slice(0, 8),
        agent: 'mcp_client',
        provider: 'mcp',
        model: body.tool_name,
        inTokens: 0,
        outTokens: 0,
        latency: 0,
        cost: 0,
      });
      const response: ToolInvokeResponse = {
        content: result.content as Array<{ type: string; text?: string }>,
        is_error: result.isError ?? false,
      };
      return c.json(response, 200);
    } catch (err) {
       if (err instanceof McpToolError) throw new HttpError(502, err.message);
       if (err instanceof McpConnectionError) throw new HttpError(503, err.message);
       throw new HttpError(502, err instanceof Error ? err.message : String(err));
     }
   },
 );

// ─── POST /world/mcp — MCP JSON-RPC endpoint (bearer token auth) ─────────────
worldRouter.post('/world/mcp', async (c) => {
  const config = await getWorldConfig();
  if (!config?.mcpServerEnabled) {
    return c.json({ detail: 'MCP server is disabled' }, 503);
  }
  const authHeader = c.req.header('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token || token !== config.mcpServerToken) {
    logsRepo.add({
      id: Date.now(),
      time: new Date().toTimeString().slice(0, 8),
      agent: 'mcp_server',
      provider: 'mcp',
      model: 'mcp-server',
      inTokens: 0,
      outTokens: 0,
      latency: 0,
      cost: 0,
    });
    return c.json({ detail: 'Unauthorized' }, 401);
  }
  const start = Date.now();
  const response = await handleMcpRequest(c);
  const latency = (Date.now() - start) / 1000;
  logsRepo.add({
    id: Date.now(),
    time: new Date().toTimeString().slice(0, 8),
    agent: 'mcp_server',
    provider: 'mcp',
    model: 'mcp-server',
    inTokens: 0,
    outTokens: 0,
    latency,
    cost: 0,
  });
  return response;
});
