'use client'

import WikiPanel from '@/components/workspace/WikiPanel'
import { useWorkspaceStatus } from '@/hooks/useWorkspaceStatus'

export default function WikiPage() {
  const { kb } = useWorkspaceStatus()

  return (
    <div data-testid="wiki-page" className="h-full">
      <WikiPanel kb={kb} />
    </div>
  )
}
