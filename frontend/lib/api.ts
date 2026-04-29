// YUMMY Frontend — API Client
// Connects to yummy-core/yummy-backend (FastAPI on port 8000)

import type {
  ToolListResponse,
  ToolInvokeResponse,
  WorldConfig,
  WorldServer,
  WorldServerCreate,
} from './types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `API Error ${res.status}`)
  }
  return res.json()
}

// ── SDLC SSE event types ───────────────────────────────────
export type SdlcEvent =
  | { t: 'start'; agent: string }
  | { t: 'c'; text: string }
  | { t: 'agent_done'; agent: string }
  | { t: 'done'; state: string; agent_outputs: Record<string, unknown>; jira_backlog: unknown[] }
  | { t: 'stopped' }
  | { t: 'error'; message: string }
  | { t: 'tool_call'; server: string; tool: string; args: Record<string, unknown> }
  | { t: 'tool_result'; server: string; tool: string; content: unknown; is_error: boolean }

/**
 * Private helper: opens an SSE connection to an SDLC endpoint and yields
 * SdlcEvent objects as they arrive (one JSON object per `data:` line).
 */
async function* sdlcStream(
  path: string,
  body: Record<string, unknown>,
): AsyncGenerator<SdlcEvent> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `API Error ${res.status}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try { yield JSON.parse(line.slice(6)) as SdlcEvent } catch { /* skip malformed */ }
      }
    }
  }
}

// ── Config ─────────────────────────────────────────────────
export const api = {
  config: {
    setGeminiKey: (api_key: string, model?: string) =>
      request('/config/api-key', { method: 'POST', body: JSON.stringify({ api_key, model }) }),

    setOllama: (base_url: string, model: string) =>
      request('/config/ollama', { method: 'POST', body: JSON.stringify({ base_url, model }) }),

    setProvider: (provider: 'gemini' | 'ollama' | 'copilot' | 'openai' | 'bedrock') =>
      request('/config/provider', { method: 'POST', body: JSON.stringify({ provider }) }),

    setup: (github_url: string, token: string, max_scan_limit: number) =>
      request('/config/setup', {
        method: 'POST',
        body: JSON.stringify({ github_url, token, max_scan_limit }),
      }),

    setCopilot: (token: string, model?: string) =>
      request('/config/copilot', { method: 'POST', body: JSON.stringify({ token, model }) }),

    setOpenAI: (api_key: string, model?: string) =>
      request('/config/openai', { method: 'POST', body: JSON.stringify({ api_key, model }) }),

    setBedrock: (access_key: string, secret_key: string, region?: string, model?: string) =>
      request('/config/bedrock', { method: 'POST', body: JSON.stringify({ access_key, secret_key, region, model }) }),

    status: () => request('/config/status'),
  },

  // ── Sessions ──────────────────────────────────────────────
  sessions: {
    list: () => request('/sessions'),
    create: (name?: string) =>
      request('/sessions', { method: 'POST', body: JSON.stringify({ name }) }),
    get: (id: string) => request(`/sessions/${id}`),
    delete: (id: string) => request(`/sessions/${id}`, { method: 'DELETE' }),
    reset: (id: string) => request(`/sessions/${id}/reset`, { method: 'POST' }),
  },

  // ── Knowledge Base ────────────────────────────────────────
  kb: {
    get: () => request('/kb'),
    scan: () => request('/kb/scan', { method: 'POST' }),
    scanStatus: () => request('/kb/scan/status'),
    file: (path: string) => request(`/kb/file?path=${encodeURIComponent(path)}`),
    clear: () => request('/kb', { method: 'DELETE' }),
  },

  // ── RAG Chat ──────────────────────────────────────────────
  /**
   * Streaming ask — returns an async generator that yields text chunks.
   * Emits special tokens: '[DONE]' and '[TRACE] {...}' at the end.
   */
  askStream: async function* (
    session_id: string,
    question: string,
    ide_file?: string,
    ide_content?: string,
    free?: boolean,   // true = /btw (no KB required)
  ): AsyncGenerator<string> {
    const endpoint = free ? '/ask/free' : '/ask'
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ session_id, question, ide_file, ide_content }),
    })
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || `API Error ${res.status}`)
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6)
          yield payload.replace(/\\n/g, '\n')
        }
      }
    }
  },

  /** Non-streaming fallback */
  ask: (session_id: string, question: string, ide_file?: string, ide_content?: string) =>
    request('/ask/sync', {
      method: 'POST',
      body: JSON.stringify({ session_id, question, ide_file, ide_content }),
    }),

  // ── SDLC ──────────────────────────────────────────────────
  sdlc: {
    /**
     * Start SDLC pipeline (BA agent) — SSE stream.
     * Yields SdlcEvent objects as they arrive from the server.
     */
    startStream: (session_id: string, requirement: string) =>
      sdlcStream('/sdlc/start', { session_id, requirement }),

    /**
     * Approve BA output and run SA agent — SSE stream.
     */
    approveBaStream: (session_id: string, edited_content?: string) =>
      sdlcStream('/sdlc/approve-ba', { session_id, edited_content }),

    /**
     * Approve SA output and run Dev Lead agent — SSE stream.
     */
    approveSaStream: (session_id: string, edited_content?: string) =>
      sdlcStream('/sdlc/approve-sa', { session_id, edited_content }),

    /**
     * Approve Dev Lead output and run DEV/SEC/QA/SRE agents — SSE stream.
     */
    approveDevLeadStream: (session_id: string, edited_content?: string) =>
      sdlcStream('/sdlc/approve-dev-lead', { session_id, edited_content }),

    state: (session_id: string) => request(`/sdlc/${session_id}/state`),

    stop: (session_id: string) =>
      request(`/sdlc/${session_id}/stop`, { method: 'POST' }),

    restore: (session_id: string, checkpoint: 'ba' | 'sa' | 'dev_lead') =>
      request(`/sdlc/${session_id}/restore`, {
        method: 'POST',
        body: JSON.stringify({ session_id, checkpoint }),
      }),

    /**
     * AI-distills the completed SDLC pipeline outputs into a concise
     * implementation prompt for pasting into a coding assistant.
     * Blocking JSON call (non-streaming). Requires at least dev_lead output.
     */
    exportPrompt: (session_id: string, format: 'chat' = 'chat') =>
      request<{ session_id: string; format: string; prompt: string }>(
        `/sdlc/${session_id}/export-prompt`,
        {
          method: 'POST',
          body: JSON.stringify({ session_id, format }),
        },
      ),
  },

  // ── Metrics ───────────────────────────────────────────────
  metrics: () => request('/metrics'),

  // ── World / MCP ───────────────────────────────────────────
  world: {
    listServers: () => request<WorldServer[]>('/world/servers'),
    getServer: (id: string) => request<WorldServer>(`/world/servers/${id}`),
    createServer: (data: WorldServerCreate) =>
      request<WorldServer>('/world/servers', { method: 'POST', body: JSON.stringify(data) }),
    updateServer: (id: string, data: Partial<WorldServerCreate>) =>
      request<WorldServer>(`/world/servers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteServer: (id: string) =>
      request<void>(`/world/servers/${id}`, { method: 'DELETE' }),
    connectServer: (id: string) =>
      request<{ detail: string }>(`/world/servers/${id}/connect`, { method: 'POST' }),
    disconnectServer: (id: string) =>
      request<{ detail: string }>(`/world/servers/${id}/disconnect`, { method: 'POST' }),
    listTools: (serverId: string) => request<ToolListResponse>(`/world/servers/${serverId}/tools`),
    invoke: (server_id: string, tool_name: string, arguments_: Record<string, unknown>) =>
      request<ToolInvokeResponse>('/world/invoke', {
        method: 'POST',
        body: JSON.stringify({ server_id, tool_name, arguments: arguments_ }),
      }),
    getConfig: () => request<WorldConfig>('/world/config'),
    updateConfig: (data: Partial<{ mcp_server_token: string; mcp_server_enabled: boolean; mcp_server_port: string }>) =>
      request<WorldConfig>('/world/config', { method: 'PUT', body: JSON.stringify(data) }),
  },

  // ── Health ────────────────────────────────────────────────
  health: {
    model: () => request('/health/model'),
  },
}
