'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Scan,
  MessageSquare,
  GitBranch,
  Settings,
  Plus,
  Activity,
  Info,
  Stethoscope,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface CommandItem {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  action: () => void
  category: string
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  commands: CommandItem[]
}

export default function CommandPalette({ open, onOpenChange, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const filtered = commands.filter((cmd) => {
    if (!query) return true
    const q = query.toLowerCase()
    return cmd.label.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q) || cmd.category.toLowerCase().includes(q)
  })

  const categories = [...new Set(filtered.map((c) => c.category))]

  useEffect(() => {
    setSelectedIndex(0)
    setQuery('')
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onOpenChange])

  const execute = useCallback(
    (index: number) => {
      const cmd = filtered[index]
      if (cmd) {
        onOpenChange(false)
        setTimeout(() => cmd.action(), 50)
      }
    },
    [filtered, onOpenChange],
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      execute(selectedIndex)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-lg" style={{ background: 'var(--bg)' }}>
        <DialogTitle className="sr-only">Command Palette</DialogTitle>

        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <Search size={16} style={{ color: 'var(--text-3)' }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search commands..."
            className="flex-1 bg-transparent border-none outline-none font-mono text-sm placeholder:text-[var(--text-3)] text-[var(--text)]"
          />
          <kbd
            className="text-2xs px-1.5 py-0.5 rounded font-mono"
            style={{ background: 'var(--bg-3)', color: 'var(--text-3)', border: '1px solid var(--border)' }}
          >
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {categories.map((category) => {
            const items = filtered.filter((c) => c.category === category)
            if (items.length === 0) return null
            return (
              <div key={category}>
                <div
                  className="px-4 py-1 text-2xs font-mono uppercase tracking-widest"
                  style={{ color: 'var(--text-3)' }}
                >
                  {category}
                </div>
                {items.map((cmd, idx) => {
                  const globalIdx = filtered.indexOf(cmd)
                  const isSelected = globalIdx === selectedIndex
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => execute(globalIdx)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors cursor-pointer',
                        isSelected && 'bg-[var(--bg-2)]',
                      )}
                      style={{ color: isSelected ? 'var(--green)' : 'var(--text-2)' }}
                    >
                      <span style={{ color: isSelected ? 'var(--green)' : 'var(--text-3)' }}>
                        {cmd.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm">{cmd.label}</div>
                        <div className="text-2xs font-mono truncate" style={{ color: 'var(--text-3)' }}>
                          {cmd.description}
                        </div>
                      </div>
                      {isSelected && (
                        <kbd className="text-2xs font-mono" style={{ color: 'var(--green-dim)' }}>
                          ↵
                        </kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center font-mono text-sm" style={{ color: 'var(--text-3)' }}>
              No commands found
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-4 py-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <span className="text-2xs font-mono flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
            <kbd className="px-1 py-0.5 rounded" style={{ border: '1px solid var(--border)', background: 'var(--bg-2)' }}>↑↓</kbd> Navigate
          </span>
          <span className="text-2xs font-mono flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
            <kbd className="px-1 py-0.5 rounded" style={{ border: '1px solid var(--border)', background: 'var(--bg-2)' }}>↵</kbd> Select
          </span>
          <span className="text-2xs font-mono flex items-center gap-1 ml-auto" style={{ color: 'var(--text-3)' }}>
            <kbd className="px-1 py-0.5 rounded" style={{ border: '1px solid var(--border)', background: 'var(--bg-2)' }}>esc</kbd> Close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function createDefaultCommands(
  handlers: {
    onScan: () => void
    onNewSession: () => void
    onNavigateSettings: () => void
    onNavigateTracing: () => void
    onShowInfo: () => void
    onHealthcheck: () => void
    onStartSDLC: () => void
  },
): CommandItem[] {
  return [
    {
      id: 'scan',
      label: 'Scan Codebase',
      description: 'Scan & index the connected GitHub repository',
      icon: <Scan size={16} />,
      action: handlers.onScan,
      category: 'Knowledge Base',
    },
    {
      id: 'ask',
      label: 'Ask Question',
      description: 'Ask AI about the codebase (RAG) — /ask',
      icon: <MessageSquare size={16} />,
      action: () => {}, // handled via input
      category: 'Chat',
    },
    {
      id: 'cr',
      label: 'Start SDLC Pipeline',
      description: 'Begin multi-agent SDLC brainstorm — /cr',
      icon: <GitBranch size={16} />,
      action: handlers.onStartSDLC,
      category: 'Pipeline',
    },
    {
      id: 'new',
      label: 'New Workspace',
      description: 'Create a new session — /new',
      icon: <Plus size={16} />,
      action: handlers.onNewSession,
      category: 'Session',
    },
    {
      id: 'tracing',
      label: 'Tracing Panel',
      description: 'View AI usage metrics and request logs',
      icon: <Activity size={16} />,
      action: handlers.onNavigateTracing,
      category: 'View',
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Configure AI providers and credentials',
      icon: <Settings size={16} />,
      action: handlers.onNavigateSettings,
      category: 'Configuration',
    },
    {
      id: 'healthcheck',
      label: 'Health Check',
      description: 'Ping AI model connection — /healthcheck',
      icon: <Stethoscope size={16} />,
      action: handlers.onHealthcheck,
      category: 'System',
    },
    {
      id: 'info',
      label: 'System Info',
      description: 'Show system status — /info',
      icon: <Info size={16} />,
      action: handlers.onShowInfo,
      category: 'System',
    },
  ]
}

export type { CommandItem }
