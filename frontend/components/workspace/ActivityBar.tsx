'use client'

import React from 'react'
import { useRouter, usePathname, useParams } from 'next/navigation'
import {
  MessageSquare,
  FolderTree,
  GitBranch,
  Activity,
  Settings,
  Database,
  Globe,
  History,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type ActivityId =
  | 'chat'
  | 'explorer'
  | 'sdlc'
  | 'tracing'
  | 'settings'
  | 'db'
  | 'world'
  | 'sessions'

interface ActivityItem {
  id: ActivityId
  icon: LucideIcon
  label: string
  activeColor: string
  testId: string
  isIndex: boolean
  routeSuffix: string
}

const ITEMS: ActivityItem[] = [
  { id: 'explorer', icon: FolderTree,    label: 'Explorer',      activeColor: 'var(--green)',   testId: 'activity-bar-item-explorer',  isIndex: false, routeSuffix: 'explorer'  },
  { id: 'sdlc',     icon: GitBranch,     label: 'SDLC Pipeline', activeColor: 'var(--amber)',   testId: 'activity-bar-item-sdlc',      isIndex: false, routeSuffix: 'sdlc'      },
  { id: 'chat',     icon: MessageSquare, label: 'AI Copilot',    activeColor: 'var(--green)',   testId: 'activity-bar-item-copilot',   isIndex: true,  routeSuffix: ''          },
  { id: 'tracing',  icon: Activity,      label: 'Tracing',       activeColor: '#00aaff',        testId: 'activity-bar-item-tracing',   isIndex: false, routeSuffix: 'tracing'   },
  { id: 'db',       icon: Database,      label: 'Database',      activeColor: '#ff6644',        testId: 'activity-bar-item-database',  isIndex: false, routeSuffix: 'database'  },
  { id: 'settings', icon: Settings,      label: 'Settings',      activeColor: 'var(--text-2)',  testId: 'activity-bar-item-settings',  isIndex: false, routeSuffix: 'settings'  },
  { id: 'world',    icon: Globe,         label: 'World',         activeColor: '#00ccaa',        testId: 'activity-bar-item-world',     isIndex: false, routeSuffix: 'world'     },
  { id: 'sessions', icon: History,       label: 'Sessions',      activeColor: 'var(--text-2)',  testId: 'activity-bar-item-sessions',  isIndex: false, routeSuffix: 'sessions'  },
]

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

  const buildRoute = (item: ActivityItem): string => {
    const base = `/workspace/${sessionId ?? ''}`
    return item.isIndex ? base : `${base}/${item.routeSuffix}`
  }

  const getIsActive = (item: ActivityItem): boolean => {
    if (!sessionId) return false
    const route = buildRoute(item)
    if (item.isIndex) {
      return pathname === route
    }
    return pathname === route || pathname.startsWith(`${route}/`)
  }

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
      {ITEMS.map((item) => {
        const isActive = getIsActive(item)
        const showIndicator =
          item.id === 'sdlc' &&
          (isRunning || (workflowState && workflowState !== 'idle' && workflowState !== 'done'))

        return (
          <button
            key={item.id}
            data-testid={item.testId}
            onClick={() => sessionId && router.push(buildRoute(item))}
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
