'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { useWorkspaceSession } from '@/hooks/useWorkspaceSession'
import TracingPanel from '@/components/workspace/TracingPanel'

export default function TracingPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { metrics, fetchMetrics } = useWorkspaceSession(sessionId)

  return (
    <div data-testid="tracing-page" className="h-full">
      <TracingPanel
        metrics={metrics}
        onLoad={fetchMetrics}
      />
    </div>
  )
}
