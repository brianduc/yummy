'use client'

import { useContext } from 'react'
import IdePanel from '@/components/workspace/IdePanel'
import { useWorkspaceStatus } from '@/hooks/useWorkspaceStatus'
import { FileOpenContext } from '../file-open-context'

export default function ExplorerPage() {
  const { kb } = useWorkspaceStatus()
  const fileCtx = useContext(FileOpenContext)

  return (
    <div data-testid="explorer-page" className="h-full">
      <IdePanel
        tree={kb?.tree || []}
        ideFile={fileCtx?.ideFile || ''}
        ideContent={fileCtx?.ideContent || ''}
        ideLoading={fileCtx?.ideLoading || false}
        onFileOpen={() => {}}
      />
    </div>
  )
}
