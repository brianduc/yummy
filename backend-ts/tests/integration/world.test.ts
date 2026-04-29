import { describe, expect, it, vi } from 'vitest';
import './_setup.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createApp } from '../../src/app.js';
import { seedWorldServer } from './_setup.js';

const app = createApp();

describe('world API', () => {
  it('GET /world/servers returns empty list', async () => {
    const res = await app.request('/world/servers');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  it('POST /world/servers creates a stdio server', async () => {
    const res = await app.request('/world/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test-stdio', transport: 'stdio', command: 'echo', args: ['hello'] }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; name: string };
    expect(body.id).toBeTruthy();
    expect(body.name).toBe('test-stdio');
  });

  it('GET /world/servers/:id returns 404 for unknown', async () => {
    const res = await app.request('/world/servers/nonexistent');
    expect(res.status).toBe(404);
  });

  it('GET /world/servers/:id returns server', async () => {
    const srv = await seedWorldServer({ name: 'lookup-server', args: '["ping"]' });

    const res = await app.request(`/world/servers/${srv.id}`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(srv.id);
    expect(body.name).toBe('lookup-server');
    expect(body.transport).toBe('stdio');
    expect(body.command).toBe('echo');
    expect(body.args).toEqual(['ping']);
    expect(body.enabled).toBe(true);
    expect(body.last_status).toBe('unknown');
  });

  it('PUT /world/servers/:id updates server', async () => {
    const srv = await seedWorldServer({ name: 'old-name' });

    const res = await app.request(`/world/servers/${srv.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'new-name', args: ['updated'], enabled: false }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(srv.id);
    expect(body.name).toBe('new-name');
    expect(body.args).toEqual(['updated']);
    expect(body.enabled).toBe(false);
  });

  it('PUT /world/servers/:id returns 404 for unknown', async () => {
    const res = await app.request('/world/servers/nonexistent', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'missing' }),
    });

    expect(res.status).toBe(404);
  });

  it('DELETE /world/servers/:id deletes server', async () => {
    const srv = await seedWorldServer({ name: 'to-delete' });
    const res = await app.request(`/world/servers/${srv.id}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    const check = await app.request(`/world/servers/${srv.id}`);
    expect(check.status).toBe(404);
  });

  it('DELETE /world/servers/:id returns 404 for unknown', async () => {
    const res = await app.request('/world/servers/nonexistent', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it('GET /world/config returns config', async () => {
    const res = await app.request('/world/config');

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      mcp_server_enabled: false,
      mcp_server_token_set: false,
      mcp_server_port: '',
    });
  });

  it('PUT /world/config updates config', async () => {
    const res = await app.request('/world/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mcp_server_enabled: false, mcp_server_token: 'secret', mcp_server_port: '8001' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.mcp_server_enabled).toBe(false);
    expect(body.mcp_server_token_set).toBe(true);
    expect(body.mcp_server_port).toBe('8001');
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('POST /world/servers/:id/connect returns 502 for stdio without command', async () => {
    const srv = await seedWorldServer({ name: 'bad-stdio', command: '' });
    vi.mocked(StdioClientTransport).mockImplementationOnce(() => {
      throw new Error('command is required');
    });

    const res = await app.request(`/world/servers/${srv.id}/connect`, { method: 'POST' });

    expect(res.status).toBe(502);
  });

  it('POST /world/servers/:id/disconnect returns 200', async () => {
    const srv = await seedWorldServer({ name: 'not-connected' });

    const res = await app.request(`/world/servers/${srv.id}/disconnect`, { method: 'POST' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ detail: 'disconnected' });
  });

  it('GET /world/servers/:id/tools returns 503 when not connected', async () => {
    const srv = await seedWorldServer({ name: 'no-tools' });

    const res = await app.request(`/world/servers/${srv.id}/tools`);

    expect(res.status).toBe(503);
  });

  it('POST /world/invoke returns 404 for unknown server', async () => {
    const res = await app.request('/world/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server_id: 'nonexistent', tool_name: 'echo', arguments: {} }),
    });
    expect(res.status).toBe(404);
  });

  it('POST /world/invoke returns 503 when server is not connected and auto-connect fails', async () => {
    const srv = await seedWorldServer({ name: 'invoke-disconnected', command: '' });
    vi.mocked(StdioClientTransport).mockImplementationOnce(() => {
      throw new Error('command is required');
    });

    const res = await app.request('/world/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server_id: srv.id, tool_name: 'echo', arguments: { msg: 'hi' } }),
    });

    expect(res.status).toBe(503);
  });
});
