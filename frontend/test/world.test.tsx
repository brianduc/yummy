import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('api.world client', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('listServers calls GET /world/servers', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] })
    const { api } = await import('../lib/api')

    const result = await api.world.listServers()

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/world/servers'),
      expect.objectContaining({ headers: expect.any(Object) }),
    )
    expect(result).toEqual([])
  })

  it('createServer calls POST /world/servers with body', async () => {
    const server = {
      id: '1',
      name: 'test',
      transport: 'stdio',
      command: 'echo',
      args: [],
      url: null,
      headers_json: null,
      enabled: true,
      created_at: '',
      last_status: 'unknown',
    }
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => server })
    const { api } = await import('../lib/api')

    const result = await api.world.createServer({ name: 'test', transport: 'stdio', command: 'echo' })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/world/servers'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ name: 'test', transport: 'stdio', command: 'echo' })
    expect(result.name).toBe('test')
  })

  it('deleteServer calls DELETE /world/servers/:id', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => undefined })
    const { api } = await import('../lib/api')

    await api.world.deleteServer('abc')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/world/servers/abc'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('invoke calls POST /world/invoke with correct body', async () => {
    const response = { content: [{ type: 'text', text: 'hello' }], is_error: false }
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => response })
    const { api } = await import('../lib/api')

    const result = await api.world.invoke('srv1', 'echo', { msg: 'hi' })

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/world/invoke'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(callBody.server_id).toBe('srv1')
    expect(callBody.tool_name).toBe('echo')
    expect(callBody.arguments).toEqual({ msg: 'hi' })
    expect(result.is_error).toBe(false)
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ detail: 'Not found' }),
      statusText: 'Not Found',
    })
    const { api } = await import('../lib/api')

    await expect(api.world.listServers()).rejects.toThrow('Not found')
  })

  it('connectServer calls POST /world/servers/:id/connect', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ detail: 'connected' }) })
    const { api } = await import('../lib/api')

    const result = await api.world.connectServer('srv1')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/world/servers/srv1/connect'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.detail).toBe('connected')
  })

  it('listTools calls GET /world/servers/:id/tools', async () => {
    const tools = { server_id: 'srv1', tools: [{ name: 'echo', description: 'Echo tool' }] }
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => tools })
    const { api } = await import('../lib/api')

    const result = await api.world.listTools('srv1')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/world/servers/srv1/tools'),
      expect.any(Object),
    )
    expect(result.tools).toHaveLength(1)
  })

  it('getConfig calls GET /world/config', async () => {
    const config = { mcp_server_enabled: true, mcp_server_token_set: false, mcp_server_port: '8001' }
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => config })
    const { api } = await import('../lib/api')

    const result = await api.world.getConfig()

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/world/config'),
      expect.any(Object),
    )
    expect(result.mcp_server_enabled).toBe(true)
  })
})
