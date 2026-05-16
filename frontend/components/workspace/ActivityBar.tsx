'use client'

import React from 'react'
import { useRouter, usePathname, useParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  activityItems,
  buildWorkspaceActivityRoute,
  isWorkspaceActivityActive,
  type ActivityId,
} from '@/lib/workspace-navigation'

export type { ActivityId, ActivityItem } from '@/lib/workspace-navigation'

interface ActivityBarProps {
  activeActivity?: ActivityId
  onActivityChange?: (id: ActivityId) => void
  workflowState?: string
  isRunning?: boolean
}

export default function ActivityBar({ workflowState, isRunning }: ActivityBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const sessionId = params?.sessionId as string | undefined

  return (
    <div
      data-testid="activity-bar"
      className="flex flex-col items-center gap-1 py-3 w-12 flex-shrink-0 select-none"
      style={{ background: 'var(--bg)', borderRight: '1px solid var(--border)' }}
    >
      {/* Brand */}
      <div
        className="w-8 h-8 rounded-md mb-2 flex items-center justify-center font-display font-extrabold text-sm cursor-default"
        style={{ background: 'var(--green-mute)', color: 'var(--green)' }}
        title="YUMMY"
      >
        Y
      </div>

      {/* Divider */}
      <div className="w-8 h-px my-1" style={{ background: 'var(--border)' }} />

      {/* Activity items */}
      {activityItems.map((item) => {
        const isActive = isWorkspaceActivityActive(pathname, sessionId, item)
        const showIndicator =
          item.id === 'sdlc' &&
          (isRunning || (workflowState && workflowState !== 'idle' && workflowState !== 'done'))

        return (
          <button
            key={item.id}
            data-testid={item.testId}
            onClick={() => sessionId && router.push(buildWorkspaceActivityRoute(sessionId, item))}
            className={cn(
              'w-10 h-10 flex items-center justify-center rounded-md transition-all duration-150 cursor-pointer relative',
              'hover:bg-[var(--bg-3)]',
              isActive && 'bg-[var(--bg-2)]',
            )}
            title={item.label}
          >
            <item.icon
              size={20}
              style={{
                color: isActive ? item.activeColor : 'var(--text-3)',
                transition: 'color 0.15s',
              }}
            />

            {/* Pipeline running indicator */}
            {showIndicator && (
              <span
                className="absolute top-1 right-1 w-2 h-2 rounded-full animate-pulse"
                style={{ background: 'var(--amber)' }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
