'use client'

import React from 'react'
import { useWorkspaceStatus } from '@/hooks/useWorkspaceStatus'
import SettingsPanel from '@/components/workspace/SettingsPanel'

export default function SettingsPage() {
  const { status, fetchStatus } = useWorkspaceStatus()

  return (
    <div data-testid="settings-page" className="h-full">
      <SettingsPanel
        status={status}
        onStatusRefresh={fetchStatus}
      />
    </div>
  )
}
