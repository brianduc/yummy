import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WorkspaceLayout from './WorkspaceLayout'
import { WorkspaceChatProvider } from '@/hooks/useWorkspaceChat'
import type { WorkspaceChatContext } from '@/hooks/useWorkspaceContracts'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({ sessionId: 'real-layout-session' }),
  usePathname: () => '/workspace/real-layout-session',
}))

window.HTMLElement.prototype.scrollIntoView = vi.fn()

function renderRealWorkspaceLayout() {
  const chatContext: WorkspaceChatContext = {
    chatHistory: [{ role: 'user', text: 'Existing real layout chat' }],
    termLogs: [{ role: 'system', text: 'Terminal is ready' }],
    termRef: React.createRef<HTMLDivElement>(),
    busy: false,
    btwBusy: false,
    sendAsk: vi.fn(),
    sendBtw: vi.fn(),
    print: vi.fn(),
    handleCmd: vi.fn().mockResolvedValue(undefined),
    setBusy: vi.fn(),
    setBtwBusy: vi.fn(),
    setChatHistory: vi.fn(),
  }

  return render(
    <WorkspaceChatProvider value={chatContext}>
      <WorkspaceLayout
        activeActivity="explorer"
        onActivityChange={vi.fn()}
        activeTab="ide"
        onTabChange={vi.fn()}
        sessionName="Real Layout Session"
        session={null}
        workflowState="idle"
        streamingAgent={null}
        isSDLCDone={false}
        fileTree={[]}
        onFileOpen={vi.fn()}
        status={null}
        metrics={null}
        scanStatus={null}
        workflowRunning={false}
        onOpenCommandPalette={vi.fn()}
        mainStageChildren={<section data-testid="real-main-stage-child">Actual content slot</section>}
      />
    </WorkspaceChatProvider>,
  )
}

describe('WorkspaceLayout real dashboard shell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the actual dashboard shell, sidebar, header, main area, and content slot', () => {
    renderRealWorkspaceLayout()

    expect(screen.getByTestId('dashboard-shell')).toHaveClass('h-screen', 'w-full', 'flex', 'overflow-hidden')
    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('app-header')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-main')).toHaveClass('flex-1', 'flex', 'flex-col', 'min-w-0')

    const dashboardContent = screen.getByTestId('dashboard-content')
    expect(dashboardContent).toHaveClass('flex-1', 'overflow-y-auto', 'p-6')
    expect(within(dashboardContent).getByTestId('real-main-stage-child')).toHaveTextContent('Actual content slot')
  })

  it('opens the actual CopilotSheet from the actual AppHeader AI trigger', () => {
    renderRealWorkspaceLayout()

    expect(screen.queryByTestId('copilot-sheet')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('ai-copilot-trigger'))

    expect(screen.getByTestId('copilot-sheet')).toBeInTheDocument()
    expect(screen.getByText('Existing real layout chat')).toBeInTheDocument()
  })

  it('invokes the provided command palette handler from the AppHeader trigger', () => {
    const onOpenCommandPalette = vi.fn()

    render(
      <WorkspaceChatProvider
        value={{
          chatHistory: [{ role: 'user', text: 'Existing real layout chat' }],
          termLogs: [{ role: 'system', text: 'Terminal is ready' }],
          termRef: React.createRef<HTMLDivElement>(),
          busy: false,
          btwBusy: false,
          sendAsk: vi.fn(),
          sendBtw: vi.fn(),
          print: vi.fn(),
          handleCmd: vi.fn().mockResolvedValue(undefined),
          setBusy: vi.fn(),
          setBtwBusy: vi.fn(),
          setChatHistory: vi.fn(),
        }}
      >
        <WorkspaceLayout
          activeActivity="explorer"
          onActivityChange={vi.fn()}
          activeTab="ide"
          onTabChange={vi.fn()}
          sessionName="Real Layout Session"
          session={null}
          workflowState="idle"
          streamingAgent={null}
          isSDLCDone={false}
          fileTree={[]}
          onFileOpen={vi.fn()}
          status={null}
          metrics={null}
          scanStatus={null}
          workflowRunning={false}
          onOpenCommandPalette={onOpenCommandPalette}
          mainStageChildren={<section data-testid="real-main-stage-child">Actual content slot</section>}
        />
      </WorkspaceChatProvider>,
    )

    fireEvent.click(screen.getByTestId('command-palette-trigger'))

    expect(onOpenCommandPalette).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['meta', { metaKey: true }],
    ['ctrl', { ctrlKey: true }],
  ])('opens CopilotSheet with %s+J shortcut', (_, modifier) => {
    renderRealWorkspaceLayout()

    expect(screen.queryByTestId('copilot-sheet')).not.toBeInTheDocument()

    fireEvent.keyDown(window, { ...modifier, key: 'j' })

    expect(screen.getByTestId('copilot-sheet')).toBeInTheDocument()
    expect(screen.getByText('Existing real layout chat')).toBeInTheDocument()
  })

  it('does not create duplicate CopilotSheet dialogs on repeated Meta+J presses', () => {
    renderRealWorkspaceLayout()

    fireEvent.keyDown(window, { metaKey: true, key: 'j' })
    fireEvent.keyDown(window, { metaKey: true, key: 'j' })

    expect(screen.getAllByTestId('copilot-sheet')).toHaveLength(1)
  })

  it('does not render legacy resizable panel artifacts or resize handles', () => {
    const { container } = renderRealWorkspaceLayout()

    expect(screen.queryByTestId('panel-group')).not.toBeInTheDocument()
    expect(screen.queryByTestId('panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('separator')).not.toBeInTheDocument()
    expect(container.querySelector('[data-panel-resize-handle-id]')).toBeNull()
    expect(container.querySelector('[data-panel-group-id]')).toBeNull()
  })

  it('preserves chat history from WorkspaceChatProvider after Sheet close/reopen cycle', () => {
    renderRealWorkspaceLayout()

    fireEvent.click(screen.getByTestId('ai-copilot-trigger'))
    expect(screen.getByTestId('copilot-sheet')).toBeInTheDocument()
    expect(screen.getByText('Existing real layout chat')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByTestId('copilot-sheet')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('ai-copilot-trigger'))
    expect(screen.getByTestId('copilot-sheet')).toBeInTheDocument()
    expect(screen.getByText('Existing real layout chat')).toBeInTheDocument()
  })

  it('WorkspaceChatProvider context state is not altered when CopilotSheet closes', () => {
    const sendAskMock = vi.fn()
    const handleCmdMock = vi.fn().mockResolvedValue(undefined)

    const busyChatContext: WorkspaceChatContext = {
      chatHistory: [{ role: 'assistant', text: 'Stream in progress' }],
      termLogs: [],
      termRef: React.createRef<HTMLDivElement>(),
      busy: true,
      btwBusy: false,
      sendAsk: sendAskMock,
      sendBtw: vi.fn(),
      print: vi.fn(),
      handleCmd: handleCmdMock,
      setBusy: vi.fn(),
      setBtwBusy: vi.fn(),
      setChatHistory: vi.fn(),
    }

    render(
      <WorkspaceChatProvider value={busyChatContext}>
        <WorkspaceLayout
          activeActivity="explorer"
          onActivityChange={vi.fn()}
          activeTab="ide"
          onTabChange={vi.fn()}
          sessionName="Busy Session"
          session={null}
          workflowState="idle"
          streamingAgent={null}
          isSDLCDone={false}
          fileTree={[]}
          onFileOpen={vi.fn()}
          status={null}
          metrics={null}
          scanStatus={null}
          workflowRunning={false}
          onOpenCommandPalette={vi.fn()}
          mainStageChildren={<div />}
        />
      </WorkspaceChatProvider>,
    )

    fireEvent.click(screen.getByTestId('ai-copilot-trigger'))
    expect(screen.getByTestId('copilot-sheet')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByTestId('copilot-sheet')).not.toBeInTheDocument()

    expect(sendAskMock).not.toHaveBeenCalled()
    expect(handleCmdMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('ai-copilot-trigger'))
    expect(screen.getByText('Stream in progress')).toBeInTheDocument()
  })
})
