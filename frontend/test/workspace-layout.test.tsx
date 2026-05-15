import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({ sessionId: 'test-layout-session' }),
  usePathname: () => '/workspace/test-layout-session',
}))

vi.mock('react-resizable-panels', () => ({
  Group: ({ children }: { children: React.ReactNode }) => <div data-testid="panel-group">{children}</div>,
  Panel: ({ children }: { children: React.ReactNode }) => <div data-testid="panel">{children}</div>,
  Separator: () => <div data-testid="separator" />,
}))

const mockSessionHook = vi.fn()
vi.mock('@/hooks/useWorkspaceSession', () => ({
  useWorkspaceSession: (...args: unknown[]) => mockSessionHook(...args),
}))

const mockStatusHook = vi.fn()
vi.mock('@/hooks/useWorkspaceStatus', () => ({
  useWorkspaceStatus: (...args: unknown[]) => mockStatusHook(...args),
}))

const mockUiHook = vi.fn()
vi.mock('@/hooks/useWorkspaceUi', () => ({
  useWorkspaceUi: (...args: unknown[]) => mockUiHook(...args),
}))

vi.mock('@/hooks/useWorkspaceChat', () => ({
  useWorkspaceChat: vi.fn().mockReturnValue({
    chatHistory: [],
    termLogs: [],
    termRef: { current: null },
    busy: false,
    btwBusy: false,
    sendAsk: vi.fn(),
    sendBtw: vi.fn(),
    print: vi.fn(),
    handleCmd: vi.fn(),
    setBusy: vi.fn(),
    setBtwBusy: vi.fn(),
    setChatHistory: vi.fn(),
  }),
  WorkspaceChatProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chat-provider">{children}</div>
  ),
}))

vi.mock('@/hooks/useWorkspaceSdlc', () => ({
  useWorkspaceSdlc: vi.fn().mockReturnValue({
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

vi.mock('@/components/workspace/WorkspaceLayout', () => ({
  default: ({ mainStageChildren }: { mainStageChildren?: React.ReactNode }) => (
    <div data-testid="workspace-layout-inner">{mainStageChildren}</div>
  ),
}))

vi.mock('@/components/workspace/ActivityBar', () => ({
  default: () => <div data-testid="activity-bar" />,
}))

const defaultSessionReturn = {
  sessionId: 'test-layout-session',
  session: {
    id: 'test-layout-session',
    name: 'Test Layout Session',
    created_at: '2026-01-01T00:00:00Z',
    workflow_state: 'idle' as const,
    agent_outputs: {},
    jira_backlog: [],
    chat_history: [],
    metrics: { tokens: 0 },
  },
  sessions: [],
  metrics: null,
  loading: false,
  error: null,
  fetchSession: vi.fn(),
  fetchSessions: vi.fn(),
  fetchMetrics: vi.fn(),
  deleteSession: vi.fn(),
}

const defaultStatusReturn = {
  status: null,
  kb: null,
  scanStatus: null,
  loading: false,
  error: null,
  fetchStatus: vi.fn(),
  fetchKb: vi.fn(),
  startScanPoll: vi.fn(),
  stopScanPoll: vi.fn(),
  setScanStatus: vi.fn(),
}

const defaultUiReturn = {
  theme: 'dark' as const,
  uiSize: 2,
  preferences: { onboardingState: 'dismissed' as const, commandPaletteOpen: false },
  setTheme: vi.fn(),
  setUiSize: vi.fn(),
  setCommandPaletteOpen: vi.fn(),
  setOnboardingState: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSessionHook.mockReturnValue(defaultSessionReturn)
  mockStatusHook.mockReturnValue(defaultStatusReturn)
  mockUiHook.mockReturnValue(defaultUiReturn)
  vi.spyOn(React, 'use').mockReturnValue({ sessionId: 'test-layout-session' } as never)
})

import WorkspaceRouteLayout from '@/app/workspace/[sessionId]/layout'

describe('WorkspaceRouteLayout', () => {
  it('renders workspace-layout wrapper', () => {
    render(
      <WorkspaceRouteLayout params={Promise.resolve({ sessionId: 'test-layout-session' })}>
        <div data-testid="mock-child">child content</div>
      </WorkspaceRouteLayout>,
    )

    expect(screen.getByTestId('workspace-layout')).toBeInTheDocument()
  })

  it('renders workspace-main-slot with child content', () => {
    render(
      <WorkspaceRouteLayout params={Promise.resolve({ sessionId: 'test-layout-session' })}>
        <div data-testid="mock-child">child content</div>
      </WorkspaceRouteLayout>,
    )

    expect(screen.getByTestId('workspace-main-slot')).toBeInTheDocument()
    expect(screen.getByTestId('mock-child')).toBeInTheDocument()
  })

  it('renders workspace-nav element', () => {
    render(
      <WorkspaceRouteLayout params={Promise.resolve({ sessionId: 'test-layout-session' })}>
        <div>child</div>
      </WorkspaceRouteLayout>,
    )

    expect(screen.getByTestId('workspace-nav')).toBeInTheDocument()
  })

  it('layout shell persists when children are replaced (simulates route navigation)', () => {
    const { rerender } = render(
      <WorkspaceRouteLayout params={Promise.resolve({ sessionId: 'test-layout-session' })}>
        <div data-testid="child-page-a">Page A</div>
      </WorkspaceRouteLayout>,
    )

    expect(screen.getByTestId('workspace-layout')).toBeInTheDocument()
    expect(screen.getByTestId('child-page-a')).toBeInTheDocument()

    rerender(
      <WorkspaceRouteLayout params={Promise.resolve({ sessionId: 'test-layout-session' })}>
        <div data-testid="child-page-b">Page B</div>
      </WorkspaceRouteLayout>,
    )

    expect(screen.getByTestId('workspace-layout')).toBeInTheDocument()
    expect(screen.getByTestId('workspace-main-slot')).toBeInTheDocument()
    expect(screen.getByTestId('child-page-b')).toBeInTheDocument()
    expect(screen.queryByTestId('child-page-a')).toBeNull()
  })
})
