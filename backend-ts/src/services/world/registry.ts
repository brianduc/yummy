import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { WorldServerRow } from '../../db/schema.js';
import { listWorldServers, updateWorldServerStatus } from '../../db/repositories/world.repo.js';
import { createHttpClient, createStdioClient, disconnectClient, listTools } from './client.js';

const registry = new Map<string, Client>();

export async function connectServer(serverRow: WorldServerRow): Promise<void> {
  if (registry.has(serverRow.id)) {
    await disconnectServer(serverRow.id);
  }

  try {
    const client = serverRow.transport === 'stdio' ? await createStdioClient(serverRow) : await createHttpClient(serverRow);
    registry.set(serverRow.id, client);
    await updateWorldServerStatus(serverRow.id, 'connected');
  } catch (error) {
    await updateWorldServerStatus(serverRow.id, 'error');
    throw error;
  }
}

export async function disconnectServer(serverId: string): Promise<void> {
  const client = registry.get(serverId);

  if (client) {
    await disconnectClient(client);
    registry.delete(serverId);
  }

  await updateWorldServerStatus(serverId, 'disconnected');
}

export function getClient(serverId: string): Client | undefined {
  return registry.get(serverId);
}

export function isConnected(serverId: string): boolean {
  return registry.has(serverId);
}

export function listConnected(): string[] {
  return Array.from(registry.keys());
}

export async function healthCheck(serverId: string): Promise<boolean> {
  const client = registry.get(serverId);
  if (!client) return false;

  try {
    await listTools(client);
    return true;
  } catch {
    await updateWorldServerStatus(serverId, 'error');
    return false;
  }
}

export async function connectAllEnabled(): Promise<void> {
  const servers = await listWorldServers();
  const enabledServers = servers.filter((server) => server.enabled === true);

  await Promise.all(
    enabledServers.map(async (server) => {
      try {
        await connectServer(server);
      } catch (error) {
        console.warn(`Failed to connect MCP server ${server.id}`, error);
      }
    }),
  );
}
