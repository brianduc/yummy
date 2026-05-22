import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Db } from '../../db/client.js';
import { listWorldServers, updateWorldServerStatus } from '../../db/repositories/world.repo.js';
import type { WorldServerRow } from '../../db/schema.js';
import { createHttpClient, createStdioClient, disconnectClient, listTools } from './client.js';

const registry = new Map<string, Client>();

export async function connectServer(db: Db, serverRow: WorldServerRow): Promise<void> {
  if (registry.has(serverRow.id)) {
    await disconnectServer(db, serverRow.id);
  }

  try {
    const client =
      serverRow.transport === 'stdio'
        ? await createStdioClient(serverRow)
        : await createHttpClient(serverRow);
    registry.set(serverRow.id, client);
    await updateWorldServerStatus(db, serverRow.id, 'connected');
  } catch (error) {
    await updateWorldServerStatus(db, serverRow.id, 'error');
    throw error;
  }
}

export async function disconnectServer(db: Db, serverId: string): Promise<void> {
  const client = registry.get(serverId);

  if (client) {
    await disconnectClient(client);
    registry.delete(serverId);
  }

  await updateWorldServerStatus(db, serverId, 'disconnected');
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

export async function healthCheck(db: Db, serverId: string): Promise<boolean> {
  const client = registry.get(serverId);
  if (!client) return false;

  try {
    await listTools(client);
    return true;
  } catch {
    await updateWorldServerStatus(db, serverId, 'error');
    return false;
  }
}

export async function connectAllEnabled(db: Db): Promise<void> {
  const servers = await listWorldServers(db);
  const enabledServers = servers.filter((server) => server.enabled === true);

  await Promise.all(
    enabledServers.map(async (server) => {
      try {
        await connectServer(db, server);
      } catch (error) {
        console.warn(`Failed to connect MCP server ${server.id}`, error);
      }
    }),
  );
}
