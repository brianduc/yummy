import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({ sessionId: 'test-sdlc-session' }),
  usePathname: () => '/workspace/test-sdlc-session/sdlc',
}))

const mockSession = {
  id: 'test-sdlc-session',
  name: 'Test Session',
  workflow_state: 'idle',
  agent_outputs: {},
}

vi.mock('@/hooks/useWorkspaceSession', () => ({
  useWorkspaceSession: () => ({
    session: mockSession,
    sessionId: 'test-sdlc-session',
    sessions: [],
    metrics: null,
    loading: false,
    error: null,
    fetchSession: vi.fn(),
    fetchSessions: vi.fn(),
    fetchMetrics: vi.fn(),
    deleteSession: vi.fn(),
  }),
}))

vi.mock('@/hooks/useWorkspaceSdlc', () => ({
  useWorkspaceSdlc: () => ({
    sdlcState: {
      workflowState: 'idle',
      editBA: '',
      editSA: '',
      editDevLead: '',
      streamingAgent: null,
      streamingText: '',
      toolCalls: {},
    },
    busy: false,
    workflowRunning: false,
    runSdlcStream: vi.fn(),
    abort: vi.fn(),
    refreshSDLC: vi.fn(),
    approveBA: vi.fn(),
    approveSA: vi.fn(),
    approveDevLead: vi.fn(),
    restore: vi.fn(),
    setEditBA: vi.fn(),
    setEditSA: vi.fn(),
    setEditDevLead: vi.fn(),
  }),
}))

vi.mock('@/components/workspace/SdlcPanel', () => ({
  default: () => <div data-testid="sdlc-panel-stub">SdlcPanel</div>,
}))

import SdlcPage from '@/app/workspace/[sessionId]/sdlc/page'

describe('SdlcPage', () => {
  it('renders sdlc-page wrapper', async () => {
    await act(async () => {
      render(<SdlcPage />)
    })
    expect(screen.getByTestId('sdlc-page')).toBeInTheDocument()
  })

  it('renders SdlcPanel component', async () => {
    await act(async () => {
      render(<SdlcPage />)
    })
    expect(screen.getByTestId('sdlc-panel-stub')).toBeInTheDocument()
  })
})
