'use client'

import React from 'react'
import {
  MessageSquare,
  FolderTree,
  GitBranch,
  Activity,
  Settings,
  Database,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type ActivityId = 'chat' | 'explorer' | 'sdlc' | 'tracing' | 'settings' | 'db'

interface ActivityItem {
  id: ActivityId
  icon: LucideIcon
  label: string
  activeColor: string
}

const ITEMS: ActivityItem[] = [
  { id: 'explorer', icon: FolderTree, label: 'Explorer', activeColor: 'var(--green)' },
  { id: 'sdlc',     icon: GitBranch,  label: 'SDLC Pipeline', activeColor: 'var(--amber)' },
  { id: 'chat',     icon: MessageSquare, label: 'AI Copilot', activeColor: 'var(--green)' },
  { id: 'tracing',  icon: Activity,   label: 'Tracing', activeColor: '#00aaff' },
  { id: 'db',       icon: Database,   label: 'Database', activeColor: '#ff6644' },
  { id: 'settings', icon: Settings,   label: 'Settings', activeColor: 'var(--text-2)' },
]

interface ActivityBarProps {
  activeActivity: ActivityId
  onActivityChange: (id: ActivityId) => void
  workflowState?: string
  isRunning?: boolean
}

export default function ActivityBar({
  activeActivity,
  onActivityChange,
  workflowState,
  isRunning,
}: ActivityBarProps) {
  return (
    <div
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
      {ITEMS.map((item) => {
        const isActive = activeActivity === item.id
        const showIndicator =
          item.id === 'sdlc' && (isRunning || (workflowState && workflowState !== 'idle' && workflowState !== 'done'))

        return (
          <button
            key={item.id}
            onClick={() => onActivityChange(item.id)}
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
