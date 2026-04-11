'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { Session } from '@/lib/types'

interface Props {
  currentSessionId: string
}

const STATE_ICON: Record<string, string> = {
  idle:                      '○',
  running_ba:                '⟳',
  waiting_ba_approval:       '⏳',
  running_sa:                '⟳',
  waiting_sa_approval:       '⏳',
  running_dev_lead:          '⟳',
  waiting_dev_lead_approval: '⏳',
  running_rest:              '⟳',
  done:                      '✓',
}
const STATE_COLOR: Record<string, string> = {
  idle:                      'var(--text-3)',
  running_ba:                'var(--amber)',
  waiting_ba_approval:       'var(--amber)',
  running_sa:                'var(--amber)',
  waiting_sa_approval:       'var(--amber)',
  running_dev_lead:          'var(--amber)',
  waiting_dev_lead_approval: 'var(--amber)',
  running_rest:              'var(--amber)',
  done:                      'var(--green)',
}

export default function SessionsSidebar({ currentSessionId }: Props) {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showInput, setShowInput] = useState(false)

  const fetchSessions = async () => {
    try {
      const data = await api.sessions.list() as Session[]
      setSessions(data)
    } catch { }
  }

  useEffect(() => {
    fetchSessions()
    const iv = setInterval(fetchSessions, 5000) // refresh every 5s
    return () => clearInterval(iv)
  }, [])

  const createSession = async () => {
    setCreating(true)
    try {
      const s = await api.sessions.create(newName || undefined) as Session
      setNewName('')
      setShowInput(false)
      await fetchSessions()
      router.push(`/workspace/${s.id}`)
    } catch { } finally {
      setCreating(false)
    }
  }

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this session?')) return
    await api.sessions.delete(id)
    await fetchSessions()
    if (id === currentSessionId && sessions.length > 1) {
      const other = sessions.find(s => s.id !== id)
      if (other) router.push(`/workspace/${other.id}`)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <span className="text-xs text-text-3 uppercase tracking-[0.08em]">
          Workspaces
        </span>
        <button
          className="btn btn-ghost px-[0.4rem] py-[0.15rem] text-xs"
          onClick={() => setShowInput(!showInput)}
        >
          +
        </button>
      </div>

      {/* New session input */}
      {showInput && (
        <div className="p-2 border-b border-border flex gap-[0.3rem]">
          <input
            className="input text-xs px-2 py-[0.3rem]"
            placeholder="Session name..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createSession()}
            autoFocus
          />
          <button className="btn btn-primary px-2 py-[0.3rem] text-xs" onClick={createSession} disabled={creating}>
            {creating ? '⟳' : '✓'}
          </button>
        </div>
      )}

      {/* Session list */}
      <div className="flex-1 overflow-auto">
        {sessions.map(session => {
          const active = session.id === currentSessionId
          return (
            <div
              key={session.id}
              onClick={() => router.push(`/workspace/${session.id}`)}
              className={`group px-3 py-[0.55rem] cursor-pointer border-b border-border transition-[background] duration-150 relative${active ? '' : ' hover:bg-bg-2'}`}
              style={{
                background: active ? 'var(--green-glow)' : undefined,
                borderLeft: active ? '2px solid var(--green)' : '2px solid transparent',
              }}
            >
              <div className="flex items-center gap-[0.4rem] mb-[0.15rem]">
                <span
                  className="text-2xs"
                  style={{ color: STATE_COLOR[session.workflow_state] || 'var(--text-3)' }}
                >
                  {STATE_ICON[session.workflow_state] || '○'}
                </span>
                <span
                  className="text-sm overflow-hidden text-ellipsis whitespace-nowrap flex-1"
                  style={{ color: active ? 'var(--green)' : 'var(--text)' }}
                >
                  {session.name}
                </span>
                <button
                  onClick={e => deleteSession(session.id, e)}
                  className="bg-transparent border-0 cursor-pointer text-text-3 text-[0.7rem] p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                >
                  ✕
                </button>
              </div>
              <div className="text-2xs text-text-3 pl-[0.85rem]">
                {session.workflow_state.replace(/_/g, ' ')}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
