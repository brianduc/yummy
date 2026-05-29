'use client'

import { useParams } from 'next/navigation'
import { useWorkspaceStatus } from '@/hooks/useWorkspaceStatus'
import DbPanel from '@/components/workspace/DbPanel'
import { useWorkspaceSessionListContext } from '../session-context'

export default function DatabasePage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { sessions } = useWorkspaceSessionListContext()
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
