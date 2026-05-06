'use client'

import React from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import ActivityBar, { type ActivityId } from './ActivityBar'
import ContextPanel from './ContextPanel'
import MainStage, { type MainTabId } from './MainStage'
import AICopilot from './AICopilot'
import type { Session, SystemStatus, MetricsData, ScanStatus, ChatMessage, FileNode, WorkflowState } from '@/lib/types'

interface WorkspaceLayoutProps {
  // Activity management
  activeActivity: ActivityId
  onActivityChange: (id: ActivityId) => void

  // Main stage
  activeTab: MainTabId
  onTabChange: (tab: MainTabId) => void
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
  chatHistory: ChatMessage[]
  termLogs: { role: string; text: string }[]
  scanStatus: ScanStatus | null
  busy: boolean
  btwBusy: boolean
  workflowRunning: boolean
  termRef: React.RefObject<HTMLDivElement | null>
  onSubmit: (input: string) => Promise<void>

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
  activeActivity,
  onActivityChange,
  activeTab,
  onTabChange,
  sessionName,
  session,
  workflowState,
  streamingAgent,
  isSDLCDone,
  fileTree,
  onFileOpen,
  status,
  metrics,
  chatHistory,
  termLogs,
  scanStatus,
  busy,
  btwBusy,
  workflowRunning,
  termRef,
  onSubmit,
  onOpenCommandPalette,
  onApproveBA,
  onApproveSA,
  onApproveDevLead,
  onStop,
  mainStageChildren,
  contextPanelChildren,
}: WorkspaceLayoutProps) {
  const isRunning = !!scanStatus?.running || busy

  return (
    <div className="flex h-screen overflow-hidden font-mono" style={{ background: 'var(--bg)' }}>
      <Group
        id="yummy-workspace"
        orientation="horizontal"
        defaultLayout={{ left: 20, center: 50, right: 30 }}
        className="flex-1"
      >
        <ActivityBar
          activeActivity={activeActivity}
          onActivityChange={onActivityChange}
          workflowState={workflowState}
          isRunning={isRunning}
        />

        <Panel id="left" defaultSize="20" minSize="15" maxSize="35">
          <ContextPanel
            fileTree={fileTree}
            onFileOpen={onFileOpen}
            status={status}
            metrics={metrics}
            isRunning={isRunning}
          >
            {contextPanelChildren}
          </ContextPanel>
        </Panel>

        <Separator className="w-1 transition-colors cursor-col-resize z-50" style={{ background: 'var(--border)' }} />

        <Panel id="center" defaultSize="50" minSize="30">
          <MainStage
            activeTab={activeTab}
            onTabChange={onTabChange}
            sessionName={sessionName}
            session={session}
            workflowState={workflowState}
            streamingAgent={streamingAgent}
            isSDLCDone={isSDLCDone}
            busy={busy}
            onOpenCommandPalette={onOpenCommandPalette}
            onApproveBA={onApproveBA}
            onApproveSA={onApproveSA}
            onApproveDevLead={onApproveDevLead}
            onStop={onStop}
          >
            {mainStageChildren}
          </MainStage>
        </Panel>

        <Separator className="w-1 transition-colors cursor-col-resize z-50" style={{ background: 'var(--border)' }} />

        <Panel id="right" defaultSize="30" minSize="20" maxSize="50">
          <AICopilot
            chatHistory={chatHistory}
            termLogs={termLogs}
            scanStatus={scanStatus}
            busy={busy}
            btwBusy={btwBusy}
            workflowRunning={workflowRunning}
            termRef={termRef}
            onSubmit={onSubmit}
            sessionName={sessionName}
          />
        </Panel>
      </Group>
    </div>
  )
}
