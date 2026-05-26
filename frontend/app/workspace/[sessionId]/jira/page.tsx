'use client'

import { useParams } from 'next/navigation'
import BacklogPanel from '@/components/workspace/BacklogPanel'
import { useWorkspaceSession } from '@/hooks/useWorkspaceSession'

export default function JiraPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { session } = useWorkspaceSession(sessionId)

  return (
    <div data-testid="jira-page" className="h-full">
      <BacklogPanel backlog={session?.jira_backlog || []} />
    </div>
  )
}
