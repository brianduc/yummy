/**
 * Guard helpers — TypeScript port of backend/dependencies.py.
 * Each throws an HttpError that the global error handler converts to {detail}.
 */

import type { Db } from '../db/client.js';
import { kbRepo } from '../db/repositories/kb.repo.js';
import { type RepoInfo, repoRepo } from '../db/repositories/repo.repo.js';
import { type Session, sessionsRepo } from '../db/repositories/sessions.repo.js';
import { getWorldConfig, getWorldServer } from '../db/repositories/world.repo.js';
import type { WorldConfigRow, WorldServerRow } from '../db/schema.js';
import { badRequest, HttpError, notFound } from './errors.js';

/** Fetch a session or 404. Mirrors get_session(session_id). */
export async function requireSession(db: Db, sessionId: string): Promise<Session> {
  const s = await sessionsRepo.get(db, sessionId);
  if (!s) {
    throw notFound(`Session '${sessionId}' not found. Create one via POST /sessions.`);
  }
  return s;
}

/** Throw 400 if no GitHub repo configured. Mirrors require_repo(). */
export async function requireRepo(db: Db): Promise<RepoInfo> {
  const r = await repoRepo.get(db);
  if (!r) {
    throw badRequest('GitHub repo not configured. Call POST /config/setup first.');
  }
  return r;
}

/** Throw 400 if KB has no insights yet. Mirrors require_knowledge_base(). */
export async function requireKnowledgeBase(db: Db) {
  if (await kbRepo.isEmpty(db)) {
    throw badRequest('Knowledge base is empty. Call POST /kb/scan and wait for it to complete.');
  }
  return await kbRepo.snapshot(db);
}

/** Throw 500 if world config is missing. Mirrors require_world_config(). */
export async function requireWorldConfig(db: Db): Promise<WorldConfigRow> {
  const config = await getWorldConfig(db);
  if (!config) {
    throw new HttpError(500, 'World config not found');
  }
  return config;
}

/** Throw 404 if MCP server is missing. Mirrors require_mcp_server(). */
export async function requireMcpServer(db: Db, serverId: string): Promise<WorldServerRow> {
  const server = await getWorldServer(db, serverId);
  if (!server) {
    throw new HttpError(404, `MCP server not found: ${serverId}`);
  }
  return server;
}

/** Throw 400 if session.workflowState !== expected. Mirrors require_workflow_state(). */
export function requireWorkflowState(session: Session, expected: string): void {
  if (session.workflowState !== expected) {
    throw badRequest(
      `Current workflow state is '${session.workflowState}', ` +
        `but '${expected}' is required to perform this step.`,
    );
  }
}
