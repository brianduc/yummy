'use client'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import type { Session } from '@/lib/types'

interface SessionsPanelProps {
  sessions: Session[]
  currentSessionId: string
  onNew: () => void
  onDeleteRequest: (s: Session) => void
}

export default function SessionsPanel({ sessions, currentSessionId, onNew, onDeleteRequest }: SessionsPanelProps) {
  const router = useRouter()
  const isDeleteDisabled = sessions.length <= 1

  const handleSessionNavigation = (sessionId: string) => {
    router.push(`/workspace/${sessionId}`)
  }

  return (
    <div className="p-3 flex flex-col gap-2 overflow-auto h-full">
      <button
        type="button"
        onClick={onNew}
        className="border border-dashed rounded cursor-pointer font-mono text-sm"
        style={{ padding: '.6rem', borderColor: 'var(--border)', background: 'none', color: 'var(--text-3)' }}>
        + New Workspace
      </button>

      {sessions.map(s => (
        <div
          key={s.id}
          className="relative rounded-lg"
        >
          <button
            type="button"
            className="w-full rounded-lg cursor-pointer"
            style={{
              padding: '.65rem .75rem',
              paddingRight: '2.5rem',
              background: s.id === currentSessionId ? 'var(--green-glow)' : 'var(--bg)',
              border: `1px solid ${s.id === currentSessionId ? 'var(--green-dim)' : 'var(--border)'}`,
              borderLeft: `3px solid ${s.id === currentSessionId ? 'var(--green)' : 'var(--border)'}`,
              textAlign: 'left',
            }}
            onClick={() => handleSessionNavigation(s.id)}
          >
            <div className="font-bold text-base truncate mb-0.5 pr-6"
              style={{ color: s.id === currentSessionId ? 'var(--green)' : 'var(--text)' }}>
              {s.name}
            </div>
            <div className="text-2xs" style={{ color: 'var(--text-3)' }}>
              {s.workflow_state?.replace(/_/g, ' ')} · {new Date(s.created_at).toLocaleDateString()}
            </div>
          </button>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              if (isDeleteDisabled) return
              onDeleteRequest(s)
            }}
            title={isDeleteDisabled ? 'Cannot delete the last workspace' : 'Delete session'}
            aria-label={isDeleteDisabled ? 'Cannot delete the last workspace' : 'Delete session'}
            disabled={isDeleteDisabled}
            className="absolute top-1/2 -translate-y-1/2 right-2 bg-transparent border-none cursor-pointer leading-none rounded hover:text-red-500 transition-colors flex items-center justify-center"
            style={{
              color: 'var(--text-3)',
              padding: '3px',
              opacity: isDeleteDisabled ? 0.35 : 1,
              cursor: isDeleteDisabled ? 'not-allowed' : 'pointer',
            }}
          ><Trash2 size={13} /></button>
        </div>
      ))}
    </div>
  )
}
