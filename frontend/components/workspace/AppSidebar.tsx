'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  activityItems,
  buildWorkspaceActivityRoute,
  isWorkspaceActivityActive,
} from '@/lib/workspace-navigation'

export function AppSidebar() {
  const [isExpanded, setIsExpanded] = React.useState(true)
  const pathname = usePathname()
  const params = useParams()
  
  // Extract sessionId from params.
  const sessionId = typeof params?.sessionId === 'string' ? params.sessionId : undefined

  return (
    <div
      data-testid="app-sidebar"
      className={cn(
        "flex flex-col border-r border-[var(--border)] bg-[var(--bg)] transition-all duration-300 h-full",
        isExpanded ? "w-64" : "w-[64px]"
      )}
    >
      <div className="flex h-[48px] items-center justify-between border-b border-[var(--border-2)] px-3 shrink-0">
        {isExpanded && (
          <span className="font-mono text-sm font-semibold text-[var(--text)] overflow-hidden text-ellipsis whitespace-nowrap">
            YUMMY
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", !isExpanded && "mx-auto")}
          onClick={() => setIsExpanded(!isExpanded)}
          data-testid="sidebar-toggle"
          title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
          aria-label={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          {isExpanded ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 p-2 overflow-y-auto overflow-x-hidden">
        {activityItems.map((item) => {
          const isActive = isWorkspaceActivityActive(pathname, sessionId, item)
          const route = buildWorkspaceActivityRoute(sessionId, item)

          return (
            <Link
              key={item.id}
              href={route}
              data-testid={`sidebar-nav-${item.id}`}
              title={!isExpanded ? item.label : undefined}
              aria-label={item.label}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-mono transition-colors",
                !isExpanded && "justify-center px-0 h-10 w-10 mx-auto",
                isActive 
                  ? "bg-[var(--bg-2)]"
                  : "text-[var(--text-3)] hover:bg-[var(--bg-2)] hover:text-[var(--text)]"
              )}
            >
              <item.icon
                className="size-5 shrink-0"
                style={{
                  color: isActive ? item.activeColor : undefined,
                }}
              />
              {isExpanded && (
                <span 
                  className="truncate"
                  style={{
                    color: isActive ? item.activeColor : 'var(--text-2)',
                    fontWeight: isActive ? 600 : 400
                  }}
                >
                  {item.label}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
