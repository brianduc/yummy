'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import SettingsPanel from './SettingsPanel'
import type { SystemStatus } from '@/lib/types'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  status: SystemStatus | null
  onStatusRefresh: () => Promise<void>
}

export default function SettingsDialog({
  open,
  onOpenChange,
  status,
  onStatusRefresh,
}: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 flex flex-col overflow-hidden"
        style={{ background: 'var(--bg)' }}>
        <DialogHeader className="px-5 pt-5 pb-0 flex-shrink-0">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure AI providers, API keys, and preferences.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden p-4">
          <div className="h-full overflow-auto">
            <SettingsPanel status={status} onStatusRefresh={onStatusRefresh} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
