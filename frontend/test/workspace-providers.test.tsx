import { renderHook, act, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockPush, mockReplace } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: vi.fn() }),
  useParams: () => ({ sessionId: 'test-session-123' }),
  usePathname: () => '/workspace/test-session-123',
}))

vi.mock('@/lib/api', () => ({
  api: {
    sessions: {
      get: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    config: {
      status: vi.fn(),
    },
    kb: {
      get: vi.fn(),
      scanStatus: vi.fn(),
    },
    metrics: vi.fn(),
  },
}))

vi.mock('@/lib/theme', () => ({
  getCurrentTheme: vi.fn().mockReturnValue('dark'),
  loadSavedTheme: vi.fn(),
  applyTheme: vi.fn(),
  THEMES: { dark: { id: 'dark' }, light: { id: 'light' } },
}))

vi.mock('@/lib/uiSize', () => ({
  getSavedUiSizeIndex: vi.fn().mockReturnValue(2),
  loadSavedUiSize: vi.fn(),
  applyUiSize: vi.fn(),
  UI_SIZE_DEFAULT_INDEX: 2,
}))

import { api } from '@/lib/api'
import { applyTheme } from '@/lib/theme'
import { applyUiSize } from '@/lib/uiSize'
import { useWorkspaceSession } from '@/hooks/useWorkspaceSession'
import { useWorkspaceStatus } from '@/hooks/useWorkspaceStatus'
import { useWorkspaceUi } from '@/hooks/useWorkspaceUi'

const mockSession = {
  id: 'test-session-123',
  name: 'Test Session',
  created_at: '2026-01-01T00:00:00Z',
  workflow_state: 'idle' as const,
  chat_history: [],
  agent_outputs: {},
  jira_backlog: [],
  metrics: { tokens: 0 },
}

const mockStatus = {
  repo: null,
  ai_provider: 'gemini' as const,
  has_gemini_key: false,
  gemini_key_source: 'none' as const,
  has_github_token: false,
  copilot_key_source: 'none' as const,
  openai_key_source: 'none' as const,
  bedrock_key_source: 'none' as const,
  kb_files: 0,
  kb_insights: 0,
  kb_has_summary: false,
  total_sessions: 1,
  scan_status: null,
  total_requests: 0,
  total_cost_usd: 0,
}

const mockKb = {
  file_count: 5,
  insight_count: 10,
  has_summary: true,
  tree: [],
  insights: [],
  project_summary: 'Test summary',
}

describe('useWorkspaceSession', () => {
  beforeEach(() => {
    vi.mocked(api.sessions.get).mockResolvedValue(mockSession)
    vi.mocked(api.sessions.list).mockResolvedValue([mockSession])
    vi.mocked(api.sessions.create).mockResolvedValue({ ...mockSession, id: 'new-session-456' })
    vi.mocked(api.sessions.delete).mockResolvedValue(undefined)
    vi.mocked(api.metrics).mockResolvedValue({
      total_requests: 0,
      total_cost_usd: 0,
      agent_breakdown: {},
      logs: [],
    })
    mockPush.mockClear()
    mockReplace.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('bootstraps with session data on mount', async () => {
    const { result } = renderHook(() => useWorkspaceSession('test-session-123'))

    await waitFor(() => {
      expect(result.current.session).not.toBeNull()
    })

    expect(result.current.session?.id).toBe('test-session-123')
    expect(result.current.sessions).toHaveLength(1)
    expect(result.current.error).toBeNull()
  })

  it('sets error state on 404 without crashing', async () => {
    vi.mocked(api.sessions.get).mockRejectedValue(new Error('Not Found 404'))
    vi.mocked(api.sessions.create).mockRejectedValue(new Error('create failed'))

    const { result } = renderHook(() => useWorkspaceSession('invalid-session'))

    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    expect(result.current.session).toBeNull()
    expect(result.current.error).toMatch(/not found/i)
  })

  it('redirects to new session on 404', async () => {
    vi.mocked(api.sessions.get).mockRejectedValue(new Error('Not Found 404'))
    vi.mocked(api.sessions.create).mockResolvedValue({ ...mockSession, id: 'new-session-456' })

    renderHook(() => useWorkspaceSession('invalid-session'))

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/workspace/new-session-456')
    })
  })

  it('fetchMetrics loads metrics data', async () => {
    const mockMetrics = {
      total_requests: 5,
      total_cost_usd: 0.01,
      agent_breakdown: {},
      logs: [],
    }
    vi.mocked(api.metrics).mockResolvedValue(mockMetrics)

    const { result } = renderHook(() => useWorkspaceSession('test-session-123'))

    await waitFor(() => {
      expect(result.current.session).not.toBeNull()
    })

    await act(async () => {
      await result.current.fetchMetrics()
    })

    expect(result.current.metrics?.total_requests).toBe(5)
  })

  it('deleteSession removes session and fetches updated list', async () => {
    const { result } = renderHook(() => useWorkspaceSession('test-session-123'))

    await waitFor(() => {
      expect(result.current.session).not.toBeNull()
    })

    await act(async () => {
      await result.current.deleteSession('other-session')
    })

    expect(api.sessions.delete).toHaveBeenCalledWith('other-session')
    expect(api.sessions.list).toHaveBeenCalledTimes(2)
  })
})

describe('useWorkspaceStatus', () => {
  beforeEach(() => {
    vi.mocked(api.config.status).mockResolvedValue(mockStatus)
    vi.mocked(api.kb.get).mockResolvedValue(mockKb)
    vi.mocked(api.kb.scanStatus).mockResolvedValue({ running: false, text: '', progress: 0 })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('fetches status and kb on mount', async () => {
    const { result } = renderHook(() => useWorkspaceStatus())

    await waitFor(() => {
      expect(result.current.status).not.toBeNull()
    })

    expect(result.current.status?.ai_provider).toBe('gemini')
    expect(result.current.kb?.file_count).toBe(5)
    expect(result.current.error).toBeNull()
  })

  it('cleans up polling interval on unmount', async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')

    const { result, unmount } = renderHook(() => useWorkspaceStatus())

    await waitFor(() => {
      expect(result.current.status).not.toBeNull()
    })

    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })

  it('exposes startScanPoll and stopScanPoll', async () => {
    const { result } = renderHook(() => useWorkspaceStatus())

    await waitFor(() => {
      expect(result.current.status).not.toBeNull()
    })

    expect(typeof result.current.startScanPoll).toBe('function')
    expect(typeof result.current.stopScanPoll).toBe('function')
  })

  it('setScanStatus updates scanStatus state', async () => {
    const { result } = renderHook(() => useWorkspaceStatus())

    await waitFor(() => {
      expect(result.current.status).not.toBeNull()
    })

    act(() => {
      result.current.setScanStatus({ running: true, text: 'Scanning...', progress: 50 })
    })

    expect(result.current.scanStatus?.running).toBe(true)
    expect(result.current.scanStatus?.text).toBe('Scanning...')
  })

  it('fetchStatus and fetchKb are callable', async () => {
    const { result } = renderHook(() => useWorkspaceStatus())

    await waitFor(() => {
      expect(result.current.status).not.toBeNull()
    })

    await act(async () => {
      await result.current.fetchStatus()
      await result.current.fetchKb()
    })

    expect(api.config.status).toHaveBeenCalledTimes(2)
    expect(api.kb.get).toHaveBeenCalledTimes(2)
  })
})

describe('useWorkspaceUi', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('loads saved theme on mount', () => {
    const { result } = renderHook(() => useWorkspaceUi())
    expect(result.current.theme).toBe('dark')
  })

  it('loads saved uiSize index on mount', () => {
    const { result } = renderHook(() => useWorkspaceUi())
    expect(result.current.uiSize).toBe(2)
  })

  it('setTheme updates theme state and calls applyTheme', () => {
    const { result } = renderHook(() => useWorkspaceUi())

    act(() => {
      result.current.setTheme('light')
    })

    expect(result.current.theme).toBe('light')
    expect(applyTheme).toHaveBeenCalledWith('light')
  })

  it('setUiSize updates uiSize state and calls applyUiSize', () => {
    const { result } = renderHook(() => useWorkspaceUi())

    act(() => {
      result.current.setUiSize(3)
    })

    expect(result.current.uiSize).toBe(3)
    expect(applyUiSize).toHaveBeenCalledWith(3)
  })

  it('setCommandPaletteOpen updates preferences.commandPaletteOpen', () => {
    const { result } = renderHook(() => useWorkspaceUi())

    act(() => {
      result.current.setCommandPaletteOpen(true)
    })

    expect(result.current.preferences.commandPaletteOpen).toBe(true)
  })

  it('setOnboardingState updates preferences.onboardingState', () => {
    const { result } = renderHook(() => useWorkspaceUi())

    act(() => {
      result.current.setOnboardingState('dismissed')
    })

    expect(result.current.preferences.onboardingState).toBe('dismissed')
  })

  it('reads dismissed onboarding from localStorage on mount', () => {
    localStorage.setItem('yummy_onboarding', 'done')
    const { result } = renderHook(() => useWorkspaceUi())
    expect(result.current.preferences.onboardingState).toBe('dismissed')
  })

  it('defaults onboardingState to asking when localStorage has no entry', () => {
    localStorage.removeItem('yummy_onboarding')
    const { result } = renderHook(() => useWorkspaceUi())
    expect(result.current.preferences.onboardingState).toBe('asking')
  })
})
