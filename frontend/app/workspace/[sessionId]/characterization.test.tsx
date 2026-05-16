import React from 'react'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WorkspacePage from './page'
import WorkspaceRouteLayout from './layout'

const push = vi.fn()
const replace = vi.fn()
const back = vi.fn()

vi.mock('next/navigation', () => ({
  useParams: () => ({ sessionId: 'test-session-123' }),
  useRouter: () => ({ push, replace, back }),
  usePathname: () => '/workspace/test-session-123',
}))

vi.mock('react-resizable-panels', () => ({
  Group: ({ children }: { children: React.ReactNode }) => <div data-testid="panel-group">{children}</div>,
  Panel: ({ children }: { children: React.ReactNode }) => <div data-testid="panel">{children}</div>,
  Separator: () => <div data-testid="separator" />,
}))

vi.mock('@/hooks/useScanPoll', () => ({
  useScanPoll: () => ({ startScanPoll: vi.fn(), stopScanPoll: vi.fn() }),
}))

vi.mock('@/lib/theme', () => ({
  applyTheme: vi.fn(),
  getCurrentTheme: vi.fn(() => 'dark'),
  loadSavedTheme: vi.fn(),
  THEMES: {},
}))

vi.mock('@/lib/uiSize', () => ({
  getSavedUiSizeIndex: vi.fn(() => 2),
  loadSavedUiSize: vi.fn(),
}))

vi.mock('@/components/workspace/IdePanel', () => ({
  default: () => <div data-testid="ide-panel">IDE panel</div>,
}))

vi.mock('@/components/workspace/NodeGraph', () => ({
  default: () => <div data-testid="node-graph">Node graph</div>,
}))

vi.mock('@/components/workspace/WikiPanel', () => ({
  default: () => <div data-testid="wiki-panel">Wiki panel</div>,
}))

vi.mock('@/components/workspace/InsightsPanel', () => ({
  default: () => <div data-testid="insights-panel">Insights panel</div>,
}))

vi.mock('@/components/workspace/RagPanel', () => ({
  default: () => <div data-testid="rag-panel">RAG panel</div>,
}))

vi.mock('@/components/workspace/SdlcPanel', () => ({
  default: () => <div data-testid="sdlc-panel">SDLC panel</div>,
}))

vi.mock('@/components/workspace/BacklogPanel', () => ({
  default: () => <div data-testid="backlog-panel">Backlog panel</div>,
}))

vi.mock('@/components/workspace/DbPanel', () => ({
  default: () => <div data-testid="db-panel">DB panel</div>,
}))

vi.mock('@/components/workspace/WorldPanel', () => ({
  default: () => <div data-testid="world-panel">World panel</div>,
}))

vi.mock('@/components/workspace/SessionsPanel', () => ({
  default: () => <div data-testid="sessions-panel">Sessions panel</div>,
}))

vi.mock('@/components/workspace/TracingPanel', () => ({
  default: () => <div data-testid="tracing-panel">Tracing panel</div>,
}))

vi.mock('@/components/workspace/SettingsPanel', () => ({
  default: () => <div data-testid="settings-panel">Settings panel</div>,
}))

vi.mock('@/components/workspace/OnboardingWizard', () => ({
  default: () => <div data-testid="onboarding-wizard">Onboarding wizard</div>,
}))

vi.mock('@/components/workspace/CommandPalette', () => ({
  default: () => null,
  createDefaultCommands: vi.fn(() => []),
}))

vi.mock('@/components/workspace/AppSidebar', () => ({
  AppSidebar: () => <aside data-testid="app-sidebar" />,
}))

vi.mock('@/components/workspace/AppHeader', () => ({
  default: ({ onOpenCommandPalette, onOpenCopilot }: { onOpenCommandPalette?: () => void; onOpenCopilot?: () => void }) => (
    <header data-testid="app-header">
      <button type="button" data-testid="command-palette-trigger" onClick={onOpenCommandPalette}>Command</button>
      <button type="button" data-testid="ai-copilot-trigger" onClick={onOpenCopilot}>AI Copilot</button>
    </header>
  ),
}))

vi.mock('@/components/workspace/CopilotSheet', () => ({
  CopilotSheet: ({ open }: { open: boolean }) => (open ? <div data-testid="copilot-sheet">AI Copilot</div> : null),
}))

vi.mock('@/lib/api', () => ({
  api: {
    sessions: {
      get: vi.fn(async () => ({
        id: 'test-session-123',
        name: 'Workspace Baseline',
        workflow_state: 'idle',
        chat_history: [],
        agent_outputs: { requirement: 'Baseline workspace' },
        jira_backlog: [],
      })),
      create: vi.fn(async () => ({ id: 'test-session-123' })),
      list: vi.fn(async () => []),
    },
    config: {
      status: vi.fn(async () => ({ repo: null, ai_provider: 'gemini' })),
    },
    kb: {
      get: vi.fn(async () => ({ tree: [] })),
    },
    metrics: vi.fn(async () => ({})),
    sdlc: {
      state: vi.fn(async () => ({ workflow_state: 'idle', agent_outputs: {}, jira_backlog: [] })),
    },
  },
}))

beforeEach(() => {
  window.localStorage.setItem('yummy_onboarding', 'done')
  vi.clearAllMocks()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  })
})

describe('WorkspacePage characterization', () => {
  it('renders the current workspace shell with the default IDE panel and workspace chrome', async () => {
    vi.spyOn(React, 'use').mockReturnValue({ sessionId: 'test-session-123' } as never)

    render(
      <WorkspaceRouteLayout params={Promise.resolve({ sessionId: 'test-session-123' })}>
        <WorkspacePage params={Promise.resolve({ sessionId: 'test-session-123' })} />
      </WorkspaceRouteLayout>,
    )

    await waitFor(() => expect(screen.getByTestId('ide-panel')).toBeInTheDocument())

    expect(screen.getByRole('button', { name: 'AI Copilot' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'IDE Simulator' })).toBeInTheDocument()
    expect(screen.getByTestId('ide-panel')).toBeInTheDocument()
    expect(screen.getByText('Workspace Baseline')).toBeInTheDocument()
  })

  it('documents that the default render shows the IDE panel and not SDLC', async () => {
    vi.spyOn(React, 'use').mockReturnValue({ sessionId: 'test-session-123' } as never)

    render(
      <WorkspaceRouteLayout params={Promise.resolve({ sessionId: 'test-session-123' })}>
        <WorkspacePage params={Promise.resolve({ sessionId: 'test-session-123' })} />
      </WorkspaceRouteLayout>,
    )

    await waitFor(() => expect(screen.getByTestId('ide-panel')).toBeInTheDocument())

    expect(screen.getByTestId('ide-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('sdlc-panel')).toBeNull()
  })

  it('renders workspace index content inside exactly one parent dashboard shell', async () => {
    vi.spyOn(React, 'use').mockReturnValue({ sessionId: 'test-session-123' } as never)

    render(
      <WorkspaceRouteLayout params={Promise.resolve({ sessionId: 'test-session-123' })}>
        <WorkspacePage params={Promise.resolve({ sessionId: 'test-session-123' })} />
      </WorkspaceRouteLayout>,
    )

    await waitFor(() => expect(screen.getByTestId('ide-panel')).toBeInTheDocument())

    expect(screen.getAllByTestId('dashboard-shell')).toHaveLength(1)
    expect(screen.getAllByTestId('app-sidebar')).toHaveLength(1)
    expect(screen.getAllByTestId('app-header')).toHaveLength(1)

    const dashboardContent = screen.getByTestId('dashboard-content')
    expect(within(dashboardContent).getByTestId('workspace-main-slot')).toBeInTheDocument()
    expect(within(dashboardContent).getByTestId('ide-panel')).toBeInTheDocument()
  })

  it('keeps the shell header breadcrumb and command palette trigger wired on the index route', async () => {
    vi.spyOn(React, 'use').mockReturnValue({ sessionId: 'test-session-123' } as never)

    render(
      <WorkspaceRouteLayout params={Promise.resolve({ sessionId: 'test-session-123' })}>
        <WorkspacePage params={Promise.resolve({ sessionId: 'test-session-123' })} />
      </WorkspaceRouteLayout>,
    )

    await waitFor(() => expect(screen.getByTestId('ide-panel')).toBeInTheDocument())

    expect(screen.getByText('Workspace Baseline')).toBeInTheDocument()
    expect(screen.getByTestId('command-palette-trigger')).toBeInTheDocument()
  })

  it('documents that AI Copilot is a Sheet triggered from the header (not a permanent right pane)', async () => {
    vi.spyOn(React, 'use').mockReturnValue({ sessionId: 'test-session-123' } as never)

    render(
      <WorkspaceRouteLayout params={Promise.resolve({ sessionId: 'test-session-123' })}>
        <WorkspacePage params={Promise.resolve({ sessionId: 'test-session-123' })} />
      </WorkspaceRouteLayout>,
    )

    await waitFor(() => expect(screen.getByTestId('ide-panel')).toBeInTheDocument())

    expect(screen.queryByTestId('copilot-sheet')).toBeNull()

    fireEvent.click(screen.getByTestId('ai-copilot-trigger'))

    expect(screen.getByTestId('copilot-sheet')).toBeInTheDocument()
  })

  it('documents that AI Copilot trigger is a single button in the header (Sheet pattern, not inline panel)', async () => {
    vi.spyOn(React, 'use').mockReturnValue({ sessionId: 'test-session-123' } as never)

    render(
      <WorkspaceRouteLayout params={Promise.resolve({ sessionId: 'test-session-123' })}>
        <WorkspacePage params={Promise.resolve({ sessionId: 'test-session-123' })} />
      </WorkspaceRouteLayout>,
    )

    await waitFor(() => expect(screen.getByTestId('ide-panel')).toBeInTheDocument())

    expect(screen.getAllByTestId('ai-copilot-trigger')).toHaveLength(1)
    expect(screen.queryByTestId('copilot-sheet')).toBeNull()
  })
})
