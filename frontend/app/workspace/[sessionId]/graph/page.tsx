'use client'

import NodeGraph from '@/components/workspace/NodeGraph'
import { useWorkspaceStatus } from '@/hooks/useWorkspaceStatus'

export default function GraphPage() {
  const { kb, status } = useWorkspaceStatus()

  return (
    <div data-testid="graph-page" className="p-6 h-full flex flex-col">
      <h2 className="font-display font-extrabold text-xl mb-4" style={{ color: 'var(--green)' }}>
        ⬡ Node Architecture Graph
      </h2>
      <div className="flex-1 border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        <NodeGraph tree={kb?.tree || []} repoInfo={status?.repo ?? null} />
      </div>
    </div>
  )
}
