/**
 * World MCP schemas — config, servers, and tool invocation payloads.
 */
import { z } from '@hono/zod-openapi';

export const WorldConfigSchema = z
  .object({
    mcp_server_enabled: z.boolean(),
    mcp_server_token_set: z.boolean(),
    mcp_server_port: z.string(),
  })
  .openapi('WorldConfig');

export const WorldConfigUpdateSchema = z
  .object({
    mcp_server_token: z.string().optional(),
    mcp_server_enabled: z.boolean().optional(),
    mcp_server_port: z.string().optional(),
  })
  .openapi('WorldConfigUpdate');

export const WorldServerSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    transport: z.enum(['stdio', 'http']),
    command: z.string().nullable().optional(),
    args: z.array(z.string()).nullable().optional(),
    url: z.string().nullable().optional(),
    headers_json: z.string().nullable().optional(),
    enabled: z.boolean(),
    created_at: z.string(),
    last_status: z.enum(['connected', 'disconnected', 'error', 'unknown']),
  })
  .openapi('WorldServer');

const WorldServerCreateBaseSchema = z
  .object({
    name: z.string().min(1),
    transport: z.enum(['stdio', 'http']),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    url: z.string().url().optional(),
    headers_json: z.string().optional(),
    enabled: z.boolean().optional().default(true),
  })
  .openapi('WorldServerCreateBase');

export const WorldServerCreateSchema = WorldServerCreateBaseSchema.refine(
  (data) => data.transport !== 'stdio' || !!data.command,
  { message: 'command is required for stdio transport', path: ['command'] },
).refine((data) => data.transport !== 'http' || !!data.url, {
  message: 'url is required for http transport',
  path: ['url'],
}).openapi('WorldServerCreate');

const WorldServerUpdateBaseSchema = z
  .object({
    name: z.string().min(1).optional(),
    transport: z.enum(['stdio', 'http']).optional(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    url: z.string().url().optional(),
    headers_json: z.string().optional(),
    enabled: z.boolean().optional(),
  })
  .openapi('WorldServerUpdateBase');

export const WorldServerUpdateSchema = WorldServerUpdateBaseSchema.refine(
  (data) => data.transport !== 'stdio' || data.command !== undefined,
  { message: 'command is required for stdio transport', path: ['command'] },
).refine((data) => data.transport !== 'http' || data.url !== undefined, {
  message: 'url is required for http transport',
  path: ['url'],
}).openapi('WorldServerUpdate');

export const ToolInvokeRequestSchema = z
  .object({
    server_id: z.string(),
    tool_name: z.string(),
    arguments: z.record(z.string(), z.unknown()).default({}),
  })
  .openapi('ToolInvokeRequest');

export const ToolContentSchema = z
  .object({
    type: z.string(),
    text: z.string().optional(),
  })
  .openapi('ToolContent');

export const ToolInvokeResponseSchema = z
  .object({
    content: z.array(ToolContentSchema),
    is_error: z.boolean().optional(),
  })
  .openapi('ToolInvokeResponse');

export const ToolDefinitionSchema = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    input_schema: z.unknown(),
  })
  .openapi('ToolDefinition');

export const ToolListResponseSchema = z
  .object({
    server_id: z.string(),
    tools: z.array(ToolDefinitionSchema),
  })
  .openapi('ToolListResponse');

export type WorldConfig = z.infer<typeof WorldConfigSchema>;
export type WorldConfigUpdate = z.infer<typeof WorldConfigUpdateSchema>;
export type WorldServer = z.infer<typeof WorldServerSchema>;
export type WorldServerCreate = z.infer<typeof WorldServerCreateSchema>;
export type WorldServerUpdate = z.infer<typeof WorldServerUpdateSchema>;
export type ToolInvokeRequest = z.infer<typeof ToolInvokeRequestSchema>;
export type ToolInvokeResponse = z.infer<typeof ToolInvokeResponseSchema>;
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;
export type ToolListResponse = z.infer<typeof ToolListResponseSchema>;
