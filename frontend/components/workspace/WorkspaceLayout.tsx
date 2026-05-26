'use client'

import React from 'react'
import { useChat } from '@/hooks/useWorkspaceChat'
import { AppSidebar } from './AppSidebar'
import AppHeader from './AppHeader'
import { CopilotSheet } from './CopilotSheet'
import type { Session, SystemStatus, MetricsData, ScanStatus, FileNode, WorkflowState } from '@/lib/types'

interface WorkspaceLayoutProps {
  sessionName: string
  session: Session | null
  workflowState: WorkflowState
  streamingAgent: string | null
  isSDLCDone: boolean

  // Context panel
  fileTree: FileNode[]
  onFileOpen: (path: string) => void
  status: SystemStatus | null
  metrics: MetricsData | null

  // Chat / AI copilot
  scanStatus: ScanStatus | null
  workflowRunning: boolean

  // Command palette
  onOpenCommandPalette: () => void

  // SDLC handlers
  onApproveBA?: () => void
  onApproveSA?: () => void
  onApproveDevLead?: () => void
  onStop?: () => void

  // Panel contents
  mainStageChildren: React.ReactNode
  contextPanelChildren?: React.ReactNode
}

export default function WorkspaceLayout({
  sessionName,
  scanStatus,
  workflowRunning,
  onOpenCommandPalette,
  mainStageChildren,
}: WorkspaceLayoutProps) {
  const [isCopilotOpen, setIsCopilotOpen] = React.useState(false)
  const { chatHistory, termLogs, busy, btwBusy, termRef, handleCmd } = useChat()

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault()
        setIsCopilotOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div
      data-testid="dashboard-shell"
      className="h-screen w-full flex overflow-hidden font-mono"
      style={{ background: 'var(--bg)' }}
    >
      <AppSidebar />

      <div
        data-testid="dashboard-main"
        className="flex-1 flex flex-col min-w-0"
      >
        <AppHeader
          onOpenCommandPalette={onOpenCommandPalette}
          onOpenCopilot={() => setIsCopilotOpen(true)}
        />

        <div data-testid="dashboard-content" className="flex-1 overflow-y-auto p-6">
          {mainStageChildren}
        </div>
      </div>

      <CopilotSheet
        open={isCopilotOpen}
        onOpenChange={setIsCopilotOpen}
        chatHistory={chatHistory}
        termLogs={termLogs}
        busy={busy}
        btwBusy={btwBusy}
        termRef={termRef}
        scanStatus={scanStatus}
        workflowRunning={workflowRunning}
        onSubmit={handleCmd}
        sessionName={sessionName}
      />
    </div>
  )
}
