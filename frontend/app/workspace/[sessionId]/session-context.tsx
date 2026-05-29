'use client'

import React from 'react'
import type { Session } from '@/lib/types'

export interface WorkspaceSessionListContextValue {
  sessions: Session[]
  fetchSessions: () => Promise<void>
  deleteSession: (targetId: string) => Promise<void>
}

export const WorkspaceSessionListContext =
  React.createContext<WorkspaceSessionListContextValue | null>(null)

export function useWorkspaceSessionListContext() {
  const context = React.useContext(WorkspaceSessionListContext)

  if (!context) {
    throw new Error('useWorkspaceSessionListContext must be used within WorkspaceSessionListContext')
  }

  return context
}
