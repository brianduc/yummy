import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const { mockPathname } = vi.hoisted(() => ({
  mockPathname: { value: '/workspace/test-layout-session' },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({ sessionId: 'test-layout-session' }),
  usePathname: () => mockPathname.value,
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
  useChat: () => ({
    chatHistory: [],
    termLogs: [],
    termRef: { current: { scrollIntoView: vi.fn() } },
    busy: false,
    btwBusy: false,
    handleCmd: vi.fn(),
  }),
  useWorkspaceChat: vi.fn().mockReturnValue({
    chatHistory: [],
    termLogs: [],
    termRef: { current: { scrollIntoView: vi.fn() } },
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

vi.mock('@/components/workspace/AppSidebar', () => ({
  AppSidebar: () => {
    const isExplorerActive = mockPathname.value.includes('/explorer')

    return (
      <aside data-testid="app-sidebar">
        <a data-testid="sidebar-nav-explorer" className={isExplorerActive ? 'bg-[var(--bg-2)]' : ''} href={`/workspace/test-layout-session/explorer`}>Explorer</a>
        <a data-testid="sidebar-nav-sdlc" className={mockPathname.value.includes('/sdlc') ? 'bg-[var(--bg-2)]' : ''} href={`/workspace/test-layout-session/sdlc`}>SDLC Pipeline</a>
        <a data-testid="sidebar-nav-copilot" className={mockPathname.value === '/workspace/test-layout-session' ? 'bg-[var(--bg-2)]' : ''} href={`/workspace/test-layout-session`}>AI Copilot</a>
      </aside>
    )
  },
}))

vi.mock('@/components/workspace/AppHeader', () => ({
  default: ({ onOpenCommandPalette, onOpenCopilot }: { onOpenCommandPalette?: () => void; onOpenCopilot?: () => void }) => (
    <header data-testid="app-header">
      <div data-testid="breadcrumbs">Workspace / {mockPathname.value.includes('/explorer') ? 'Explorer' : 'AI Copilot'}</div>
      <button data-testid="command-palette-trigger" onClick={onOpenCommandPalette}>Command</button>
      <button data-testid="ai-copilot-trigger" onClick={onOpenCopilot}>AI Copilot</button>
    </header>
  ),
}))

vi.mock('@/components/workspace/CopilotSheet', () => ({
  CopilotSheet: ({ open }: { open: boolean }) => (open ? <div data-testid="copilot-sheet">AI Copilot</div> : null),
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
  mockPathname.value = '/workspace/test-layout-session'
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

  it('renders dashboard shell composition without resize handles or permanent Copilot pane', () => {
    render(
      <WorkspaceRouteLayout params={Promise.resolve({ sessionId: 'test-layout-session' })}>
        <div data-testid="mock-child">child content</div>
      </WorkspaceRouteLayout>,
    )

    expect(screen.getByTestId('dashboard-shell')).toHaveClass('h-screen', 'w-full', 'flex', 'overflow-hidden')
    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('app-header')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-main')).toHaveClass('flex-1', 'flex', 'flex-col', 'min-w-0')
    expect(screen.getByTestId('dashboard-content')).toHaveClass('flex-1', 'overflow-y-auto', 'p-6')
    expect(screen.getByTestId('mock-child')).toBeInTheDocument()
    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('AI Copilot')
    expect(screen.queryByTestId('panel-group')).not.toBeInTheDocument()
    expect(screen.queryByTestId('panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('separator')).not.toBeInTheDocument()
    expect(screen.queryByTestId('copilot-sheet')).not.toBeInTheDocument()
  })

  it('shows index breadcrumb and keeps the command palette trigger wired', () => {
    render(
      <WorkspaceRouteLayout params={Promise.resolve({ sessionId: 'test-layout-session' })}>
        <div data-testid="mock-child">child content</div>
      </WorkspaceRouteLayout>,
    )

    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('AI Copilot')
    fireEvent.click(screen.getByTestId('command-palette-trigger'))
    expect(defaultUiReturn.setCommandPaletteOpen).toHaveBeenCalledWith(true)
  })

  it('shows nested route breadcrumb semantics through the header', () => {
    mockPathname.value = '/workspace/test-layout-session/explorer/folder-a'

    render(
      <WorkspaceRouteLayout params={Promise.resolve({ sessionId: 'test-layout-session' })}>
        <div data-testid="mock-child">child content</div>
      </WorkspaceRouteLayout>,
    )

    expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('Explorer')
  })

  it('keeps sidebar active route semantics aligned with the shared navigation model', () => {
    mockPathname.value = '/workspace/test-layout-session/explorer/folder-a'

    render(
      <WorkspaceRouteLayout params={Promise.resolve({ sessionId: 'test-layout-session' })}>
        <div data-testid="mock-child">child content</div>
      </WorkspaceRouteLayout>,
    )

    expect(screen.getByTestId('sidebar-nav-explorer')).toHaveClass('bg-[var(--bg-2)]')
    expect(screen.getByTestId('sidebar-nav-sdlc')).not.toHaveClass('bg-[var(--bg-2)]')
  })

  it('preserves command palette trigger behavior through dashboard header', () => {
    render(
      <WorkspaceRouteLayout params={Promise.resolve({ sessionId: 'test-layout-session' })}>
        <div>child</div>
      </WorkspaceRouteLayout>,
    )

    fireEvent.click(screen.getByTestId('command-palette-trigger'))

    expect(defaultUiReturn.setCommandPaletteOpen).toHaveBeenCalledWith(true)
  })
})
