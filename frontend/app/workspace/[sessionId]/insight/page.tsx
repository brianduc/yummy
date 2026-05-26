'use client'

import InsightsPanel from '@/components/workspace/InsightsPanel'
import { useWorkspaceStatus } from '@/hooks/useWorkspaceStatus'

export default function InsightPage() {
  const { kb } = useWorkspaceStatus()

  return (
    <div data-testid="insight-page" className="h-full">
      <InsightsPanel kb={kb} />
    </div>
  )
}
