'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useWorkspaceSession } from '@/hooks/useWorkspaceSession'
import { useWorkspaceSdlc } from '@/hooks/useWorkspaceSdlc'
import SdlcPanel from '@/components/workspace/SdlcPanel'
import type { Session } from '@/lib/types'

export default function SdlcPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const sessionCtx = useWorkspaceSession(sessionId)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    setSession(sessionCtx.session)
  }, [sessionCtx.session])

  const sdlcCtx = useWorkspaceSdlc(sessionId, { session, setSession })

  if (!session) return null

  return (
    <div data-testid="sdlc-page" className="h-full">
      <SdlcPanel
        session={session}
        editBA={sdlcCtx.sdlcState.editBA}
        editSA={sdlcCtx.sdlcState.editSA}
        editDevLead={sdlcCtx.sdlcState.editDevLead}
        busy={sdlcCtx.busy}
        workflowRunning={sdlcCtx.workflowRunning}
        streamingAgent={sdlcCtx.sdlcState.streamingAgent}
        streamingText={sdlcCtx.sdlcState.streamingText}
        toolCalls={sdlcCtx.sdlcState.toolCalls}
        onEditBA={sdlcCtx.setEditBA}
        onEditSA={sdlcCtx.setEditSA}
        onEditDevLead={sdlcCtx.setEditDevLead}
        onApproveBA={sdlcCtx.approveBA}
        onApproveSA={sdlcCtx.approveSA}
        onApproveDevLead={sdlcCtx.approveDevLead}
        onStop={sdlcCtx.abort}
        onRestore={sdlcCtx.restore}
      />
    </div>
  )
}
