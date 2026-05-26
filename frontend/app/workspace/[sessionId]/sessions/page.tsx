'use client'

import { useParams, useRouter } from 'next/navigation'
import { useWorkspaceSession } from '@/hooks/useWorkspaceSession'
import { api } from '@/lib/api'
import { useDeleteSessionRequest } from '@/components/workspace/DeleteSessionModal'
import SessionsPanel from '@/components/workspace/SessionsPanel'
import type { Session } from '@/lib/types'

export default function SessionsPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const { sessions } = useWorkspaceSession(sessionId)
  const requestDeleteSession = useDeleteSessionRequest()

  const handleNew = async () => {
    const fresh = await api.sessions.create() as Session
    router.push(`/workspace/${fresh.id}`)
  }

  const handleDeleteRequest = (s: Session) => {
    requestDeleteSession?.(s)
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
