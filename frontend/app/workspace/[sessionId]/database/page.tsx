'use client'

import { useParams } from 'next/navigation'
import { useWorkspaceSession } from '@/hooks/useWorkspaceSession'
import { useWorkspaceStatus } from '@/hooks/useWorkspaceStatus'
import DbPanel from '@/components/workspace/DbPanel'

export default function DatabasePage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { sessions } = useWorkspaceSession(sessionId)
  const { status } = useWorkspaceStatus()

  return (
    <div data-testid="database-page" className="h-full">
      <DbPanel
        sessions={sessions}
        currentSessionId={sessionId}
        status={status}
      />
    </div>
  )
}
