import { render, screen, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import React, { Suspense } from 'react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ sessionId: 'test-dashboard-session' }),
  usePathname: () => '/workspace/test-dashboard-session',
}))

vi.mock('@/hooks/useWorkspaceSession', () => ({
  useWorkspaceSession: () => ({
    session: {
      id: 'test-dashboard-session',
      name: 'Test Session',
      workflow_state: 'idle',
      jira_backlog: [],
    },
    sessions: [],
    metrics: null,
  }),
}))

vi.mock('@/hooks/useWorkspaceStatus', () => ({
  useWorkspaceStatus: () => ({
    status: { repo: { owner: 'testorg', repo: 'testrepo' }, provider: 'gemini' },
    kb: {
      tree: [
        { name: 'src', children: [] },
        { name: 'README.md', children: [] },
      ],
      project_summary: '',
      insights: [],
    },
    scanStatus: { running: false, text: 'Complete', progress: 100 },
  }),
}))

vi.mock('@/hooks/useWorkspaceSdlc', () => ({
  useWorkspaceSdlc: () => ({ sdlcState: { workflowState: 'idle' }, workflowRunning: false }),
}))

vi.mock('@/hooks/useWorkspaceChat', () => ({
  useChat: () => ({
    chatHistory: [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ],
    print: vi.fn(),
    setChatHistory: vi.fn(),
    setBusy: vi.fn(),
    busy: false,
    handleCmd: vi.fn(),
  }),
  WorkspaceChatProvider: ({ children }: any) => <>{children}</>,
}))

vi.mock('@/hooks/useScanPoll', () => ({
  useScanPoll: () => ({ startScanPoll: vi.fn() }),
}))

vi.mock('@/lib/api', () => ({
  api: {
    sessions: {
      get: vi.fn().mockResolvedValue({
        id: 'test-dashboard-session',
        name: 'Test Session',
        workflow_state: 'idle',
        chat_history: [],
        jira_backlog: [],
      }),
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'fresh-dashboard-session' }),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    config: {
      status: vi.fn().mockResolvedValue({ repo: { owner: 'testorg', repo: 'testrepo' } }),
    },
    kb: {
      get: vi.fn().mockResolvedValue({ tree: [], project_summary: '', insights: [] }),
      file: vi.fn().mockResolvedValue({ content: '' }),
    },
    metrics: vi.fn().mockResolvedValue(null),
  },
}))

vi.mock('@/components/workspace/MainStage', () => ({
  default: ({ children }: any) => <div data-testid="main-stage-stub">{children}</div>,
  createDefaultCommands: vi.fn(() => []),
}))

vi.mock('@/components/workspace/CommandPalette', () => ({
  default: () => <div data-testid="command-palette-stub" />,
  createDefaultCommands: vi.fn(() => []),
}))

vi.mock('@/components/workspace/IdePanel', () => ({ default: () => <div data-testid="ide-panel-stub" /> }))
vi.mock('@/components/workspace/NodeGraph', () => ({ default: () => <div data-testid="node-graph-stub" /> }))
vi.mock('@/components/workspace/WikiPanel', () => ({ default: () => <div data-testid="wiki-panel-stub" /> }))
vi.mock('@/components/workspace/InsightsPanel', () => ({ default: () => <div data-testid="insights-panel-stub" /> }))
vi.mock('@/components/workspace/RagPanel', () => ({ default: () => <div data-testid="rag-panel-stub" /> }))
vi.mock('@/components/workspace/SdlcPanel', () => ({ default: () => <div data-testid="sdlc-panel-stub" /> }))
vi.mock('@/components/workspace/BacklogPanel', () => ({ default: () => <div data-testid="backlog-panel-stub" /> }))
vi.mock('@/components/workspace/DbPanel', () => ({ default: () => <div data-testid="db-panel-stub" /> }))
vi.mock('@/components/workspace/WorldPanel', () => ({ default: () => <div data-testid="world-panel-stub" /> }))
vi.mock('@/components/workspace/SessionsPanel', () => ({ default: () => <div data-testid="sessions-panel-stub" /> }))
vi.mock('@/components/workspace/TracingPanel', () => ({ default: () => <div data-testid="tracing-panel-stub" /> }))
vi.mock('@/components/workspace/SettingsPanel', () => ({ default: () => <div data-testid="settings-panel-stub" /> }))
vi.mock('@/components/workspace/OnboardingWizard', () => ({ default: () => <div data-testid="onboarding-wizard-stub" /> }))

import DashboardPage from '@/app/workspace/[sessionId]/page'

const renderDashboardPage = async () => {
  await act(async () => {
    render(
      <Suspense fallback={<div>Loading...</div>}>
        <DashboardPage params={Promise.resolve({ sessionId: 'test-dashboard-session' })} />
      </Suspense>
    )
  })
}

describe('DashboardPage', () => {
  it('renders dashboard-page wrapper', async () => {
    await renderDashboardPage()
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
  })

  it('shows the repo stat with repo name text', async () => {
    await renderDashboardPage()
    expect(screen.getByTestId('dashboard-stat-repo')).toHaveTextContent('testrepo')
  })

  it('shows the file count stat as 2', async () => {
    await renderDashboardPage()
    expect(screen.getByTestId('dashboard-stat-files')).toHaveTextContent('2')
  })

  it('shows the scan status stat', async () => {
    await renderDashboardPage()
    expect(screen.getByTestId('dashboard-stat-scan')).toHaveTextContent('Complete')
  })

  it('shows the SDLC status stat', async () => {
    await renderDashboardPage()
    expect(screen.getByTestId('dashboard-stat-sdlc')).toHaveTextContent('idle')
  })

  it('shows the chat count stat as 2', async () => {
    await renderDashboardPage()
    expect(screen.getByTestId('dashboard-stat-chats')).toHaveTextContent('2')
  })

  it('renders all dashboard navigation cards', async () => {
    await renderDashboardPage()

    expect(screen.getByTestId('dashboard-card-explorer')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-card-graph')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-card-wiki')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-card-insight')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-card-history')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-card-jira')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-card-world')).toBeInTheDocument()
  })
})
