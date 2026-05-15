'use client'

import React, { useRef, useState, useCallback, useEffect } from 'react'
import { useWorkspaceSession } from '@/hooks/useWorkspaceSession'
import { useWorkspaceStatus } from '@/hooks/useWorkspaceStatus'
import { useWorkspaceUi } from '@/hooks/useWorkspaceUi'
import { WorkspaceChatProvider, useWorkspaceChat } from '@/hooks/useWorkspaceChat'
import { useWorkspaceSdlc } from '@/hooks/useWorkspaceSdlc'
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout'
import type { ActivityId } from '@/components/workspace/ActivityBar'
import type { MainTabId } from '@/components/workspace/MainStage'
import type { Session } from '@/lib/types'

export default function WorkspaceRouteLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = React.use(params)
  const abortRef = useRef(new AbortController())

  const [activeActivity, setActiveActivity] = useState<ActivityId>('explorer')
  const [activeTab, setActiveTab] = useState<MainTabId>('ide')

  const sessionCtx = useWorkspaceSession(sessionId)
  const statusCtx = useWorkspaceStatus()
  const uiCtx = useWorkspaceUi()

  const [session, setSession] = useState<Session | null>(null)
  useEffect(() => {
    setSession(sessionCtx.session)
  }, [sessionCtx.session])

  const sdlcCtx = useWorkspaceSdlc(sessionId, { session, setSession })

  const { setCommandPaletteOpen } = uiCtx
  const handleOpenCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true)
  }, [setCommandPaletteOpen])

  const chatCtx = useWorkspaceChat(sessionId, abortRef, {
    status: statusCtx.status,
    session,
    fetchStatus: statusCtx.fetchStatus,
    fetchMetrics: sessionCtx.fetchMetrics,
    startScanPoll: statusCtx.startScanPoll,
    setScanStatus: statusCtx.setScanStatus,
    setActiveTab,
    setActiveActivity,
    setSession,
    runSdlcStream: sdlcCtx.runSdlcStream,
    handleStop: sdlcCtx.abort,
  })

  return (
    <WorkspaceChatProvider value={chatCtx}>
      <div data-testid="workspace-layout">
        <nav data-testid="workspace-nav" aria-label="workspace navigation" />
        <WorkspaceLayout
          activeActivity={activeActivity}
          onActivityChange={setActiveActivity}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          sessionName={session?.name ?? sessionId}
          session={session}
          workflowState={sdlcCtx.sdlcState.workflowState}
          streamingAgent={sdlcCtx.sdlcState.streamingAgent}
          isSDLCDone={session?.workflow_state === 'done'}
          fileTree={statusCtx.kb?.tree ?? []}
          onFileOpen={() => {}}
          status={statusCtx.status}
          metrics={sessionCtx.metrics}
          scanStatus={statusCtx.scanStatus}
          workflowRunning={sdlcCtx.workflowRunning}
          onOpenCommandPalette={handleOpenCommandPalette}
          onApproveBA={sdlcCtx.approveBA}
          onApproveSA={sdlcCtx.approveSA}
          onApproveDevLead={sdlcCtx.approveDevLead}
          onStop={sdlcCtx.abort}
          mainStageChildren={
            <main data-testid="workspace-main-slot">{children}</main>
          }
        />
      </div>
    </WorkspaceChatProvider>
  )
}
