import './_setup.js';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { kbRepo } from '../../src/db/repositories/kb.repo.js';
import { repoRepo } from '../../src/db/repositories/repo.repo.js';
import { createApp } from '../../src/app.js';
import { setAIResponse, clearAIResponses } from './_setup.js';

import { streamAI } from '../../src/services/ai/dispatcher.js';

vi.mock('../../src/services/world/client.js', () => ({
  listTools: vi.fn().mockResolvedValue([
    { name: 'echo', description: 'Echo tool', inputSchema: { type: 'object', properties: {} } },
  ]),
  callTool: vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'mock-tool-result' }],
    isError: false,
  }),
}));

vi.mock('../../src/services/world/registry.js', async () => {
  const clients = new Map<string, unknown>();
  return {
    getClient: vi.fn((id: string) => clients.get(id) ?? undefined),
    listConnected: vi.fn(() => Array.from(clients.keys())),
    isConnected: vi.fn((id: string) => clients.has(id)),
    __connectMock: (id: string) => { clients.set(id, {}); },
    __disconnectMock: (id: string) => { clients.delete(id); },
    __resetMock: () => { clients.clear(); },
  };
});

import * as worldRegistry from '../../src/services/world/registry.js';
import * as worldClientMod from '../../src/services/world/client.js';

const mockRegistry = worldRegistry as unknown as {
  __connectMock: (id: string) => void;
  __disconnectMock: (id: string) => void;
  __resetMock: () => void;
};
const mockCallTool = worldClientMod.callTool as ReturnType<typeof vi.fn>;

const app = createApp();

function seedKb() {
  repoRepo.set({
    url: 'https://github.com/mock/mock', owner: 'mock', repo: 'mock',
    branch: 'main', githubToken: '', maxScanLimit: 100,
  });
  kbRepo.replaceTree([{ path: 'README.md', name: 'README.md', status: 'done' }]);
  kbRepo.addInsight({ id: 1, files: ['README.md'], summary: 'mock', createdAt: Date.now() });
  kbRepo.setProjectSummary('# Mock Project');
}

async function createSession(): Promise<string> {
  const r = await app.request('/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'ToolLoopTest' }),
  });
  return ((await r.json()) as { id: string }).id;
}

function parseSse(text: string): Record<string, unknown>[] {
  const events: Record<string, unknown>[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('data: ')) {
      try { events.push(JSON.parse(trimmed.slice(6))); } catch { /* skip */ }
    }
  }
  return events;
}

async function sse(res: Response): Promise<Record<string, unknown>[]> {
  return parseSse(await res.text());
}

async function post(path: string, body: Record<string, unknown>): Promise<Response> {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function runStage(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  return sse(await post(path, body));
}

function evDone(events: Record<string, unknown>[]) {
  return events.find((e) => e.t === 'done');
}
function evToolCalls(events: Record<string, unknown>[]) {
  return events.filter((e) => e.t === 'tool_call');
}
function evToolResults(events: Record<string, unknown>[]) {
  return events.filter((e) => e.t === 'tool_result');
}

describe('SDLC tool-call loop', () => {
  beforeEach(() => {
    vi.mocked(streamAI).mockImplementation(async function* () {
      yield 'mock ';
      yield 'streamed ';
      yield 'response';
    });
    mockCallTool.mockResolvedValue({
      content: [{ type: 'text', text: 'mock-tool-result' }],
      isError: false,
    });
    mockRegistry.__resetMock();
    clearAIResponses();
  });

  it('completes pipeline normally when no MCP servers are connected', async () => {
    seedKb();
    const sid = await createSession();
    setAIResponse('BA', 'brd-content');
    setAIResponse('SA', 'sa-content');
    setAIResponse('PM', '[]');
    setAIResponse('DEV_LEAD', 'dl-content');
    setAIResponse('DEV', 'dev-content');
    setAIResponse('SECURITY', 'sec-content');
    setAIResponse('QA', 'qa-content');
    setAIResponse('SRE', 'sre-content');

    await runStage('/sdlc/start', { session_id: sid, requirement: 'Build X' });
    await runStage('/sdlc/approve-ba', { session_id: sid });
    await runStage('/sdlc/approve-sa', { session_id: sid });
    const dlEvents = await runStage('/sdlc/approve-dev-lead', { session_id: sid });

    const done = evDone(dlEvents);
    expect(done).toBeDefined();
    expect(done!.state).toBe('done');
    const outputs = done!.agent_outputs as Record<string, string>;
    expect(outputs.ba).toBeTruthy();
    expect(outputs.sa).toBeTruthy();
    expect(outputs.dev_lead).toBeTruthy();
    expect(outputs.dev).toBeTruthy();
    expect(outputs.security).toBeTruthy();
    expect(outputs.qa).toBeTruthy();
    expect(outputs.sre).toBeTruthy();
  });

  it('completes pipeline with connected MCP servers', async () => {
    mockRegistry.__connectMock('test-srv');
    seedKb();
    const sid = await createSession();
    setAIResponse('BA', 'brd');
    setAIResponse('SA', 'sa');
    setAIResponse('PM', '[]');
    setAIResponse('DEV_LEAD', 'dl');
    setAIResponse('DEV', 'dev');
    setAIResponse('SECURITY', 'sec');
    setAIResponse('QA', 'qa');
    setAIResponse('SRE', 'sre');

    await runStage('/sdlc/start', { session_id: sid, requirement: 'Build X' });
    await runStage('/sdlc/approve-ba', { session_id: sid });
    await runStage('/sdlc/approve-sa', { session_id: sid });
    const dlEvents = await runStage('/sdlc/approve-dev-lead', { session_id: sid });

    const done = evDone(dlEvents);
    expect(done).toBeDefined();
    expect(done!.state).toBe('done');
    expect(worldClientMod.listTools).toHaveBeenCalled();
  });

  it('invokes tools when streamAI yields tool_call markers', async () => {
    mockRegistry.__connectMock('test-srv');
    vi.mocked(streamAI).mockImplementation(async function* () {
      yield 'Analysis: ';
      yield '<tool_call server="test-srv" tool="echo">{"msg":"hello"}</tool_call>';
      yield ' done.';
    });

    seedKb();
    const sid = await createSession();
    setAIResponse('BA', 'brd');

    const events = await runStage('/sdlc/start', { session_id: sid, requirement: 'Build X' });

    const tc = evToolCalls(events)[0];
    expect(tc).toBeDefined();
    expect(tc!.server).toBe('test-srv');
    expect(tc!.tool).toBe('echo');

    const tr = evToolResults(events)[0];
    expect(tr).toBeDefined();
    expect(tr!.is_error).toBe(false);

    expect(mockCallTool).toHaveBeenCalled();

    const done = evDone(events);
    expect(done).toBeDefined();
    expect(done!.state).toBe('waiting_ba_approval');
  });

  it('emits error tool_result when tool execution fails', async () => {
    mockRegistry.__connectMock('test-srv');
    mockCallTool.mockRejectedValue(new Error('Tool execution failed: connection refused'));

    vi.mocked(streamAI).mockImplementation(async function* () {
      yield '<tool_call server="test-srv" tool="echo">{"msg":"hello"}</tool_call>';
      yield ' continuing...';
    });

    seedKb();
    const sid = await createSession();
    setAIResponse('BA', 'brd');

    const events = await runStage('/sdlc/start', { session_id: sid, requirement: 'Build X' });

    const tc = evToolCalls(events)[0];
    expect(tc).toBeDefined();

    const tr = evToolResults(events)[0];
    expect(tr).toBeDefined();
    expect(tr!.is_error).toBe(true);
    const content = tr!.content as Array<{ text?: string }>;
    expect(content[0]?.text).toContain('Tool execution failed');

    const done = evDone(events);
    expect(done).toBeDefined();
  });

  it('handles malformed JSON args in tool_call gracefully', async () => {
    mockRegistry.__connectMock('test-srv');
    vi.mocked(streamAI).mockImplementation(async function* () {
      yield '<tool_call server="test-srv" tool="echo">{not valid json!!!}</tool_call>';
      yield ' after bad args.';
    });

    seedKb();
    const sid = await createSession();
    setAIResponse('BA', 'brd');

    const events = await runStage('/sdlc/start', { session_id: sid, requirement: 'Build X' });

    const tr = evToolResults(events)[0];
    expect(tr).toBeDefined();
    expect(tr!.is_error).toBe(true);

    const done = evDone(events);
    expect(done).toBeDefined();
    expect(done!.state).toBe('waiting_ba_approval');
  });

  it('stops calling tools after MAX_TOOL_CALL_ROUNDS (3)', async () => {
    mockRegistry.__connectMock('test-srv');
    vi.mocked(streamAI).mockImplementation(async function* () {
      yield '<tool_call server="test-srv" tool="echo">{"msg":"round"}</tool_call>';
    });

    seedKb();
    const sid = await createSession();
    setAIResponse('BA', 'brd');

    const events = await runStage('/sdlc/start', { session_id: sid, requirement: 'Build X' });

    const callCount = evToolCalls(events).length;
    expect(callCount).toBe(3);

    const done = evDone(events);
    expect(done).toBeDefined();
  });

  it('handles abort via /stop during tool execution', async () => {
    mockRegistry.__connectMock('test-srv');
    mockCallTool.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 100));
      return { content: [{ type: 'text', text: 'slow' }], isError: false };
    });

    vi.mocked(streamAI).mockImplementation(async function* () {
      yield '<tool_call server="test-srv" tool="echo">{"msg":"stop-me"}</tool_call>';
      yield ' after tool.';
    });

    seedKb();
    const sid = await createSession();
    setAIResponse('BA', 'brd');
    setAIResponse('SA', 'sa');
    setAIResponse('PM', '[]');

    await runStage('/sdlc/start', { session_id: sid, requirement: 'Build X' });

    const baPromise = post('/sdlc/approve-ba', { session_id: sid });

    await new Promise((r) => setTimeout(r, 20));

    const stopRes = await post(`/sdlc/${sid}/stop`, {});
    expect(stopRes.status).toBe(200);

    const sseText = await baPromise.then((r) => r.text());
    expect(sseText).toContain('data:');

    const stateRes = await app.request(`/sdlc/${sid}/state`);
    const stateBody = (await stateRes.json()) as { workflow_state: string };
    expect(stateBody.workflow_state).toBe('idle');
  });

  it('processes multiple tool_call markers in a single agent output', async () => {
    mockRegistry.__connectMock('srv-1');
    mockRegistry.__connectMock('srv-2');
    vi.mocked(streamAI).mockImplementation(async function* () {
      yield 'First ';
      yield '<tool_call server="srv-1" tool="echo">{"msg":"first"}</tool_call>';
      yield ' then ';
      yield '<tool_call server="srv-2" tool="echo">{"msg":"second"}</tool_call>';
      yield ' done.';
    });

    seedKb();
    const sid = await createSession();
    setAIResponse('BA', 'brd');

    const events = await runStage('/sdlc/start', { session_id: sid, requirement: 'Build X' });

    const calls = evToolCalls(events);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls[0]!.server).toBe('srv-1');
    expect(calls[1]!.server).toBe('srv-2');

    const results = evToolResults(events);
    expect(results.length).toBeGreaterThanOrEqual(2);

    const done = evDone(events);
    expect(done).toBeDefined();
  });

  it('handles tool_call with empty args object', async () => {
    mockRegistry.__connectMock('test-srv');
    vi.mocked(streamAI).mockImplementation(async function* () {
      yield '<tool_call server="test-srv" tool="list">{} </tool_call>';
      yield ' done.';
    });

    seedKb();
    const sid = await createSession();
    setAIResponse('BA', 'brd');

    const events = await runStage('/sdlc/start', { session_id: sid, requirement: 'Build X' });

    const tr = evToolResults(events)[0];
    expect(tr).toBeDefined();
    expect(tr!.is_error).toBe(false);

    expect(mockCallTool).toHaveBeenCalledWith(
      expect.anything(),
      'test-srv',
      'list',
      {},
    );

    const done = evDone(events);
    expect(done).toBeDefined();
  });

  it('emits error when tool_call references unknown server', async () => {
    vi.mocked(streamAI).mockImplementation(async function* () {
      yield '<tool_call server="unknown-srv" tool="echo">{"msg":"hi"}</tool_call>';
      yield ' after failed call.';
    });

    seedKb();
    const sid = await createSession();
    setAIResponse('BA', 'brd');

    const events = await runStage('/sdlc/start', { session_id: sid, requirement: 'Build X' });

    const tr = evToolResults(events)[0];
    expect(tr).toBeDefined();
    expect(tr!.is_error).toBe(true);
    expect(tr!.server).toBe('unknown-srv');

    const done = evDone(events);
    expect(done).toBeDefined();
  });

  it('can restore checkpoint after pipeline with tool calls', async () => {
    mockRegistry.__connectMock('test-srv');
    vi.mocked(streamAI).mockImplementation(async function* () {
      yield '<tool_call server="test-srv" tool="echo">{"msg":"hello"}</tool_call>';
      yield ' rest.';
    });

    seedKb();
    const sid = await createSession();
    setAIResponse('BA', 'brd');
    setAIResponse('SA', 'sa');
    setAIResponse('PM', '[]');

    await runStage('/sdlc/start', { session_id: sid, requirement: 'Build X' });
    const baEvents = await runStage('/sdlc/approve-ba', { session_id: sid });

    const baDone = evDone(baEvents);
    expect(baDone).toBeDefined();
    expect(baDone!.state).toBe('waiting_sa_approval');

    await post(`/sdlc/${sid}/stop`, {});

    const restoreRes = await post(`/sdlc/${sid}/restore`, { session_id: sid, checkpoint: 'ba' });
    expect(restoreRes.status).toBe(200);

    const restoreBody = (await restoreRes.json()) as {
      workflow_state: string;
      agent_outputs: Record<string, unknown>;
    };
    expect(restoreBody.workflow_state).toBe('waiting_ba_approval');
    expect(restoreBody.agent_outputs.ba).toBeTruthy();
    expect(restoreBody.agent_outputs.sa).toBeUndefined();
  });

  it('handles tool_call in Dev Lead agent stage', async () => {
    mockRegistry.__connectMock('test-srv');
    vi.mocked(streamAI).mockImplementation(async function* () {
      yield '<tool_call server="test-srv" tool="echo">{"msg":"dl-tool"}</tool_call>';
    });

    seedKb();
    const sid = await createSession();
    setAIResponse('BA', 'brd');
    setAIResponse('SA', 'sa');
    setAIResponse('PM', '[]');
    setAIResponse('DEV_LEAD', 'dl');

    await runStage('/sdlc/start', { session_id: sid, requirement: 'Build X' });
    await runStage('/sdlc/approve-ba', { session_id: sid });
    const saEvents = await runStage('/sdlc/approve-sa', { session_id: sid });

    const tc = evToolCalls(saEvents)[0];
    expect(tc).toBeDefined();
    expect(tc!.tool).toBe('echo');

    const done = evDone(saEvents);
    expect(done).toBeDefined();
    expect(done!.state).toBe('waiting_dev_lead_approval');
  });
});
