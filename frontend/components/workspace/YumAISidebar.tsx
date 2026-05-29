'use client'

import * as React from 'react'
import AICopilot from './AICopilot'
import type { ChatMessage, ScanStatus } from '@/lib/types'
import { Panel, Separator as PanelResizeHandle } from 'react-resizable-panels'

interface YumAISidebarProps {
  chatHistory: ChatMessage[]
  termLogs: { role: string; text: string }[]
  scanStatus: ScanStatus | null
  busy: boolean
  btwBusy: boolean
  workflowRunning: boolean
  termRef: React.RefObject<HTMLDivElement | null>
  onSubmit: (input: string) => Promise<void>
  sessionName: string
}

export function YumAISidebar(props: YumAISidebarProps) {
  return (
    <>
      <PanelResizeHandle 
        className="w-1 cursor-col-resize hover:bg-[var(--green)] active:bg-[var(--green)] transition-colors" 
        style={{ background: 'var(--border)' }} 
      />
      <Panel
        defaultSize="25%"
        minSize="20%"
        maxSize="50%"
        className="flex flex-col h-full bg-[var(--bg)] border-l border-[var(--border)]"
      >
        <div className="flex-1 overflow-hidden" data-testid="yumai-sidebar">
          <AICopilot {...props} />
        </div>
      </Panel>
    </>
  )
}
