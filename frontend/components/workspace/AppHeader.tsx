'use client'

import React from 'react'
import { usePathname, useParams } from 'next/navigation'
import { Command, Sparkles, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { activityItems, buildWorkspaceActivityRoute } from '@/lib/workspace-navigation'

export interface AppHeaderProps {
  onOpenCommandPalette?: () => void
  onOpenCopilot?: () => void
}

export default function AppHeader({
  onOpenCommandPalette,
  onOpenCopilot,
}: AppHeaderProps) {
  const pathname = usePathname()
  const params = useParams()
  const sessionId = params.sessionId as string | undefined

  let activeItem = null
  if (pathname && sessionId) {
    const sortedItems = [...activityItems].sort((a, b) => b.routeSuffix.length - a.routeSuffix.length)
    
    for (const item of sortedItems) {
      const route = buildWorkspaceActivityRoute(sessionId, item)
      if (item.isIndex) {
        if (pathname === route) {
          activeItem = item
          break
        }
      } else {
        if (pathname === route || pathname.startsWith(`${route}/`)) {
          activeItem = item
          break
        }
      }
    }
  }

  return (
    <header
      data-testid="app-header"
      className="h-14 border-b flex items-center justify-between px-4 shrink-0"
      style={{
        backgroundColor: 'var(--bg)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-center" data-testid="breadcrumbs">
        <span className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>
          Workspace
        </span>
        {activeItem && (
          <>
            <ChevronRight className="w-4 h-4 mx-2" style={{ color: 'var(--text-3)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              {activeItem.breadcrumbLabel}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenCommandPalette}
          data-testid="command-palette-trigger"
          className="gap-2 text-[var(--text-2)] hover:text-[var(--text)]"
        >
          <Command size={14} />
          <span>Command</span>
          <kbd
            className="hidden sm:inline-flex h-5 items-center gap-1 rounded px-1.5 font-mono text-[10px] font-medium"
            style={{
              border: '1px solid var(--border-2)',
              backgroundColor: 'var(--bg-2)',
              color: 'var(--text-3)',
            }}
          >
            <span className="text-xs">Cmd/Ctrl</span>+K
          </kbd>
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={onOpenCopilot}
          data-testid="ai-copilot-trigger"
          className="gap-2"
        >
          <Sparkles size={14} />
          <span>AI Copilot</span>
        </Button>
      </div>
    </header>
  )
}