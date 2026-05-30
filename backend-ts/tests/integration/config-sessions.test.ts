import './_setup.js';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { runtimeConfig } from '../../src/config/runtime.js';
import { createDb } from '../../src/db/client.js';

const db = createDb();

import { providerConfig } from '../../src/db/schema.js';

const app = createApp();

describe('config + sessions integration', () => {
  it('GET /health returns ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', db: 'ok' });
  });

  it('GET / returns API info', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.message).toContain('YUMMY');
    expect(body.docs).toBe('/docs');
  });

  it('POST /config/api-key sets gemini key', async () => {
    const res = await app.request('/config/api-key', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: 'test-key', model: 'gemini-2.0-flash' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('POST /config/provider switches to openai', async () => {
    const res = await app.request('/config/provider', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'openai' }),
    });
    expect(res.status).toBe(200);
  });

  it('hydrates saved provider config from DB for a new app instance', async () => {
    await db.delete(providerConfig);

    const saveOpenAI = await app.request('/config/openai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: 'persisted-openai-key',
        model: 'gpt-5.1',
        base_url: 'https://example.test/v1',
      }),
    });
    expect(saveOpenAI.status).toBe(200);

    const switchProvider = await app.request('/config/provider', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'openai' }),
    });
    expect(switchProvider.status).toBe(200);

    runtimeConfig.provider = 'gemini';
    runtimeConfig.openai_key = '';
    runtimeConfig.openai_model = '';
    runtimeConfig.openai_base_url = '';

    const restartedApp = createApp();
    const status = await restartedApp.request('/config/status');

    expect(status.status).toBe(200);
    const body = (await status.json()) as Record<string, unknown>;
    expect(body.ai_provider).toBe('openai');
    expect(body.has_openai_key).toBe(true);
    expect(body.openai_key_source).toBe('ui');
    expect(body.openai_model).toBe('gpt-5.1');
    expect(body.openai_base_url).toBe('https://example.test/v1');
    expect(JSON.stringify(body)).not.toContain('persisted-openai-key');
  });

  it('POST /config/provider rejects unknown provider', async () => {
    const res = await app.request('/config/provider', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'nonsense' }),
    });
    // Zod rejection -> 400 from validator
    expect(res.status).toBe(400);
  });

  it('GET /config/status returns flags without raw keys', async () => {
    const res = await app.request('/config/status');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('has_gemini_key');
    expect(body).toHaveProperty('gemini_key_source');
    // Must not leak any raw key
    expect(JSON.stringify(body)).not.toContain('test-key');
  });

  it('POST /config/setup creates repo info', async () => {
    const res = await app.request('/config/setup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        github_url: 'https://github.com/mock-owner/mock-repo',
        token: 'gh_test',
        max_scan_limit: 100,
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe('ok');
  });

  it('POST /config/setup rejects bad URL', async () => {
    const res = await app.request('/config/setup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ github_url: 'not-a-github-url' }),
    });
    expect(res.status).toBe(400);
  });

  it('full sessions CRUD', async () => {
    // Create
    const create = await app.request('/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Workspace A' }),
    });
    expect(create.status).toBe(200);
    const created = (await create.json()) as { id: string; name: string };
    expect(created.id).toBeTruthy();
    expect(created.name).toBe('Workspace A');

    const createSecond = await app.request('/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Workspace B' }),
    });
    expect(createSecond.status).toBe(200);

    // List
    const list = await app.request('/sessions');
    expect(list.status).toBe(200);
    const sessions = (await list.json()) as unknown[];
    expect(sessions).toHaveLength(2);

    // Get
    const get = await app.request(`/sessions/${created.id}`);
    expect(get.status).toBe(200);

    // Reset
    const reset = await app.request(`/sessions/${created.id}/reset`, {
      method: 'POST',
    });
    expect(reset.status).toBe(200);

    // Delete
    const del = await app.request(`/sessions/${created.id}`, {
      method: 'DELETE',
    });
    expect(del.status).toBe(200);

    // Get after delete -> 404
    const gone = await app.request(`/sessions/${created.id}`);
    expect(gone.status).toBe(404);
  });

  it('prevents deleting the last remaining session', async () => {
    const create = await app.request('/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Solo Workspace' }),
    });
    expect(create.status).toBe(200);

    const created = (await create.json()) as { id: string };
    const del = await app.request(`/sessions/${created.id}`, {
      method: 'DELETE',
    });

    expect(del.status).toBe(409);
    expect(await del.json()).toEqual({ detail: 'Cannot delete the last workspace.' });

    const get = await app.request(`/sessions/${created.id}`);
    expect(get.status).toBe(200);
  });
});
