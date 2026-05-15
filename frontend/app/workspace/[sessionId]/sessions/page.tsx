'use client'

import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useWorkspaceSession } from '@/hooks/useWorkspaceSession'
import { api } from '@/lib/api'
import SessionsPanel from '@/components/workspace/SessionsPanel'
import type { Session } from '@/lib/types'

export default function SessionsPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const { sessions, deleteSession } = useWorkspaceSession(sessionId)

  const handleNew = async () => {
    const fresh = await api.sessions.create() as Session
    router.push(`/workspace/${fresh.id}`)
  }

  const handleDeleteRequest = async (s: Session) => {
    await deleteSession(s.id)
  }

  return (
    <div data-testid="sessions-page" className="h-full">
      <SessionsPanel
        sessions={sessions}
        currentSessionId={sessionId}
        onNew={handleNew}
        onDeleteRequest={handleDeleteRequest}
      />
    </div>
  )
}
