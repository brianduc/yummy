'use client'

import React, { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { WorldServer, WorldServerCreate, McpTool, ToolInvokeResponse } from '@/lib/types'

type Transport = WorldServerCreate['transport']

interface ServerFormState {
  name: string
  transport: Transport
  command: string
  args: string
  url: string
  headers_json: string
  enabled: boolean
}

interface ToolTestState {
  open: boolean
  args: string
  error: string | null
  loading: boolean
  result: ToolInvokeResponse | null
}

const inputCls = 'bg-gray-800 border border-gray-600 text-gray-100 rounded px-2 py-1 text-sm w-full focus:outline-none focus:border-blue-500'
const buttonPrimary = 'bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed'
const buttonDanger = 'bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed'
const buttonSecondary = 'bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed'

const emptyForm: ServerFormState = {
  name: '',
  transport: 'stdio',
  command: '',
  args: '',
  url: '',
  headers_json: '',
  enabled: true,
}

function statusDotClass(status: WorldServer['last_status']) {
  const color = status === 'connected' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-gray-400'
  return `w-2 h-2 rounded-full inline-block mr-2 ${color}`
}

function serverToForm(server: WorldServer): ServerFormState {
  return {
    name: server.name,
    transport: server.transport,
    command: server.command ?? '',
    args: (server.args ?? []).join('\n'),
    url: server.url ?? '',
    headers_json: server.headers_json ?? '',
    enabled: server.enabled,
  }
}

function buildPayload(form: ServerFormState): WorldServerCreate {
  const payload: WorldServerCreate = {
    name: form.name.trim(),
    transport: form.transport,
    enabled: form.enabled,
  }

  if (form.transport === 'stdio') {
    payload.command = form.command.trim()
    payload.args = form.args.split('\n').map(arg => arg.trim()).filter(Boolean)
  } else {
    payload.url = form.url.trim()
    if (form.headers_json.trim()) payload.headers_json = form.headers_json.trim()
  }

  return payload
}

function ServerForm({
  form,
  setForm,
  submitLabel,
  saving,
  onSubmit,
  onCancel,
}: {
  form: ServerFormState
  setForm: React.Dispatch<React.SetStateAction<ServerFormState>>
  submitLabel: string
  saving: boolean
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3 flex flex-col gap-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-gray-400">Name</span>
          <input
            className={inputCls}
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="filesystem"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-gray-400">Transport</span>
          <select
            className={`${inputCls} cursor-pointer`}
            value={form.transport}
            onChange={e => setForm(prev => ({ ...prev, transport: e.target.value as Transport }))}
          >
            <option value="stdio">stdio</option>
            <option value="http">http</option>
          </select>
        </label>
      </div>

      {form.transport === 'stdio' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-gray-400">Command</span>
            <input
              className={inputCls}
              value={form.command}
              onChange={e => setForm(prev => ({ ...prev, command: e.target.value }))}
              placeholder="npx"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-gray-400">Args</span>
            <textarea
              className={`${inputCls} min-h-20 font-mono`}
              value={form.args}
              onChange={e => setForm(prev => ({ ...prev, args: e.target.value }))}
              placeholder="-y\n@modelcontextprotocol/server-filesystem"
            />
            <span className="text-xs text-gray-500">One arg per line.</span>
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-gray-400">URL</span>
            <input
              className={inputCls}
              value={form.url}
              onChange={e => setForm(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://example.com/mcp"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-gray-400">Headers JSON</span>
            <textarea
              className={`${inputCls} min-h-20 font-mono`}
              value={form.headers_json}
              onChange={e => setForm(prev => ({ ...prev, headers_json: e.target.value }))}
              placeholder={'{"Authorization":"Bearer ..."}'}
            />
            <span className="text-xs text-gray-500">Optional.</span>
          </label>
        </div>
      )}

      <label className="inline-flex items-center gap-2 text-sm text-gray-300">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={e => setForm(prev => ({ ...prev, enabled: e.target.checked }))}
        />
        Enabled
      </label>

      <div className="flex items-center gap-2">
        <button className={buttonPrimary} disabled={saving || !form.name.trim()} onClick={onSubmit}>
          {saving ? 'Saving...' : submitLabel}
        </button>
        <button className={buttonSecondary} disabled={saving} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function ToolCard({
  tool,
  testState,
  onToggleSchema,
  schemaOpen,
  onStartTest,
  onArgsChange,
  onInvoke,
}: {
  tool: McpTool
  testState: ToolTestState | undefined
  schemaOpen: boolean
  onToggleSchema: () => void
  onStartTest: () => void
  onArgsChange: (value: string) => void
  onInvoke: () => void
}) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-3 flex flex-col gap-2">
      <div>
        <div className="font-bold text-gray-100">{tool.name}</div>
        <div className="text-sm text-gray-400">{tool.description || 'No description provided.'}</div>
      </div>
      <div className="flex items-center gap-2">
        <button className={buttonSecondary} onClick={onToggleSchema}>▶ Schema</button>
        <button className={buttonPrimary} onClick={onStartTest}>Test</button>
      </div>
      {schemaOpen && (
        <pre className="font-mono text-xs bg-gray-800 p-2 rounded overflow-auto text-gray-200">
          {JSON.stringify(tool.input_schema ?? {}, null, 2)}
        </pre>
      )}
      {testState?.open && (
        <div className="flex flex-col gap-2 pt-1">
          <textarea
            className={`${inputCls} min-h-24 font-mono`}
            value={testState.args}
            onChange={e => onArgsChange(e.target.value)}
          />
          {testState.error && <div className="text-red-400 text-xs mt-1">{testState.error}</div>}
          <button className={`${buttonPrimary} self-start`} disabled={testState.loading} onClick={onInvoke}>
            {testState.loading ? 'Invoking...' : 'Invoke'}
          </button>
          {testState.result && (
            <pre className="font-mono text-xs bg-gray-800 p-2 rounded overflow-auto text-gray-200">
              {JSON.stringify(testState.result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

export default function WorldPanel() {
  const [servers, setServers] = useState<WorldServer[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<ServerFormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ServerFormState>(emptyForm)
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)
  const [tools, setTools] = useState<McpTool[]>([])
  const [toolsLoading, setToolsLoading] = useState(false)
  const [toolsError, setToolsError] = useState<string | null>(null)
  const [schemaOpen, setSchemaOpen] = useState<Record<string, boolean>>({})
  const [toolTests, setToolTests] = useState<Record<string, ToolTestState>>({})

  const loadServers = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.world.listServers()
      setServers(data)
      return data
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load servers')
      return []
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadServers() }, [])

  const refreshAfterMutation = async () => {
    const fresh = await loadServers()
    const selected = fresh.find(server => server.id === selectedServerId)
    if (selected?.last_status === 'connected') await loadTools(selected.id)
    else if (selectedServerId) {
      setTools([])
      setToolsError(selected ? 'Server not connected — click Connect first' : null)
    }
  }

  const loadTools = async (serverId: string) => {
    setToolsLoading(true)
    setToolsError(null)
    setTools([])
    try {
      const response = await api.world.listTools(serverId)
      setTools(response.tools)
    } catch (e) {
      setToolsError(e instanceof Error ? e.message : 'Failed to load tools')
    } finally {
      setToolsLoading(false)
    }
  }

  const selectServer = async (server: WorldServer) => {
    setSelectedServerId(server.id)
    setSchemaOpen({})
    setToolTests({})
    setTools([])
    setToolsError(null)
    if (server.last_status !== 'connected') {
      setToolsError('Server not connected — click Connect first')
      return
    }
    await loadTools(server.id)
  }

  const createServer = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.world.createServer(buildPayload(addForm))
      setAddForm(emptyForm)
      setShowAddForm(false)
      await refreshAfterMutation()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create server')
    } finally {
      setSaving(false)
    }
  }

  const updateServer = async () => {
    if (!editingId) return
    setSaving(true)
    setError(null)
    try {
      await api.world.updateServer(editingId, buildPayload(editForm))
      setEditingId(null)
      await refreshAfterMutation()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update server')
    } finally {
      setSaving(false)
    }
  }

  const deleteServer = async (server: WorldServer) => {
    if (!window.confirm(`Delete MCP server "${server.name}"?`)) return
    setError(null)
    try {
      await api.world.deleteServer(server.id)
      if (selectedServerId === server.id) {
        setSelectedServerId(null)
        setTools([])
        setToolsError(null)
      }
      await refreshAfterMutation()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete server')
    }
  }

  const connectServer = async (server: WorldServer) => {
    setError(null)
    try {
      await api.world.connectServer(server.id)
      await refreshAfterMutation()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect server')
    }
  }

  const disconnectServer = async (server: WorldServer) => {
    setError(null)
    try {
      await api.world.disconnectServer(server.id)
      await refreshAfterMutation()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to disconnect server')
    }
  }

  const beginEdit = (server: WorldServer) => {
    setEditingId(server.id)
    setEditForm(serverToForm(server))
  }

  const selectedServer = servers.find(server => server.id === selectedServerId) ?? null

  const startTest = (toolName: string) => {
    setToolTests(prev => ({
      ...prev,
      [toolName]: prev[toolName] ?? { open: true, args: '{}', error: null, loading: false, result: null },
    }))
  }

  const updateTestArgs = (toolName: string, value: string) => {
    setToolTests(prev => ({
      ...prev,
      [toolName]: { ...(prev[toolName] ?? { open: true, args: '{}', error: null, loading: false, result: null }), args: value, error: null },
    }))
  }

  const invokeTool = async (toolName: string) => {
    if (!selectedServerId) return
    const current = toolTests[toolName] ?? { open: true, args: '{}', error: null, loading: false, result: null }
    let parsed: unknown
    try {
      parsed = JSON.parse(current.args)
    } catch {
      setToolTests(prev => ({ ...prev, [toolName]: { ...current, error: 'Invalid JSON', loading: false } }))
      return
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setToolTests(prev => ({ ...prev, [toolName]: { ...current, error: 'Invalid JSON', loading: false } }))
      return
    }

    setToolTests(prev => ({ ...prev, [toolName]: { ...current, error: null, loading: true } }))
    try {
      const result = await api.world.invoke(selectedServerId, toolName, parsed as Record<string, unknown>)
      setToolTests(prev => ({ ...prev, [toolName]: { ...current, error: null, loading: false, result } }))
    } catch (e) {
      setToolTests(prev => ({
        ...prev,
        [toolName]: { ...current, error: e instanceof Error ? e.message : 'Invoke failed', loading: false },
      }))
    }
  }

  return (
    <div className="p-4 text-gray-100 h-full overflow-y-auto flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">World MCP Servers</h2>
          <p className="text-sm text-gray-500">Manage external MCP servers and test their tools from the workspace.</p>
        </div>
        <button className={buttonPrimary} onClick={() => setShowAddForm(true)}>Add Server</button>
      </div>

      {error && <div className="text-red-400 text-xs mt-1 rounded border border-red-900/60 bg-red-950/30 p-2">{error}</div>}

      {showAddForm && (
        <ServerForm
          form={addForm}
          setForm={setAddForm}
          submitLabel="Create Server"
          saving={saving}
          onSubmit={createServer}
          onCancel={() => { setShowAddForm(false); setAddForm(emptyForm) }}
        />
      )}

      <section className="rounded-lg border border-gray-700 bg-gray-900/30 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-700 text-sm font-semibold text-gray-400 uppercase tracking-wide">Servers</div>
        <div className="p-3">
          {loading && <div className="text-sm text-gray-400">Loading servers...</div>}
          {!loading && servers.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-700 p-5 text-center flex flex-col items-center gap-3">
              <div className="text-gray-400">No MCP servers configured.</div>
              <button className={buttonPrimary} onClick={() => setShowAddForm(true)}>Add Server</button>
            </div>
          )}
          {!loading && servers.length > 0 && (
            <div className="flex flex-col">
              {servers.map(server => (
                <div key={server.id} className="border-b border-gray-700 py-2 last:border-b-0">
                  <div
                    className={`rounded p-2 cursor-pointer transition-colors ${selectedServerId === server.id ? 'bg-gray-800' : 'hover:bg-gray-800/60'}`}
                    onClick={() => selectServer(server)}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center text-sm font-bold text-gray-100">
                          <span className={statusDotClass(server.last_status)} />
                          <span className="truncate">{server.name}</span>
                        </div>
                        <div className="text-xs text-gray-500 font-mono truncate">
                          {server.transport === 'stdio' ? [server.command, ...(server.args ?? [])].filter(Boolean).join(' ') : server.url}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                        <span className="text-xs text-gray-400 font-mono">{server.last_status}</span>
                        {server.last_status === 'connected' ? (
                          <button className={buttonSecondary} onClick={() => disconnectServer(server)}>Disconnect</button>
                        ) : (
                          <button className={buttonPrimary} onClick={() => connectServer(server)}>Connect</button>
                        )}
                        <button className={buttonSecondary} onClick={() => beginEdit(server)}>Edit</button>
                        <button className={buttonDanger} onClick={() => deleteServer(server)}>Delete</button>
                      </div>
                    </div>
                  </div>
                  {editingId === server.id && (
                    <div className="mt-2">
                      <ServerForm
                        form={editForm}
                        setForm={setEditForm}
                        submitLabel="Update Server"
                        saving={saving}
                        onSubmit={updateServer}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {selectedServer && (
        <section className="rounded-lg border border-gray-700 bg-gray-900/30 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-700 text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Tools · {selectedServer.name}
          </div>
          <div className="p-3 flex flex-col gap-3">
            {toolsLoading && <div className="text-sm text-gray-400">Loading tools...</div>}
            {toolsError && <div className="text-sm text-gray-400">{toolsError}</div>}
            {!toolsLoading && !toolsError && tools.length === 0 && <div className="text-sm text-gray-400">No tools exposed by this server.</div>}
            {!toolsLoading && tools.map(tool => (
              <ToolCard
                key={tool.name}
                tool={tool}
                testState={toolTests[tool.name]}
                schemaOpen={Boolean(schemaOpen[tool.name])}
                onToggleSchema={() => setSchemaOpen(prev => ({ ...prev, [tool.name]: !prev[tool.name] }))}
                onStartTest={() => startTest(tool.name)}
                onArgsChange={value => updateTestArgs(tool.name, value)}
                onInvoke={() => invokeTool(tool.name)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
