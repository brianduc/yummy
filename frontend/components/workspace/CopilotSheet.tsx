'use client'

import * as React from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import AICopilot from './AICopilot'
import type { ChatMessage, ScanStatus } from '@/lib/types'

// Copy exact props that AICopilot expects
interface CopilotSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  
  // Forwarded to AICopilot
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

export function CopilotSheet({ open, onOpenChange, ...copilotProps }: CopilotSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[400px] sm:w-[450px] sm:max-w-md p-0 flex flex-col"
        data-testid="copilot-sheet"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>AI Copilot</SheetTitle>
          <SheetDescription>
            AI Copilot chat panel and terminal logs
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-hidden">
          <AICopilot {...copilotProps} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
