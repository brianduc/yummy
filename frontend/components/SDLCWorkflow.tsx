'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import type { Session, WorkflowState, AgentOutputs } from '@/lib/types'

interface Props {
  session: Session
  onUpdate: (updated: Partial<Session>) => void
  hasKB: boolean
}

const AGENTS = [
  { key: 'ba',       label: 'BA',       full: 'Business Analyst',    icon: '📋', color: '#00ff88' },
  { key: 'sa',       label: 'SA',       full: 'Solution Architect',  icon: '🏛',  color: '#00cc66' },
  { key: 'dev_lead', label: 'Dev Lead', full: 'Tech Lead',           icon: '⚙️',  color: '#ffb300' },
  { key: 'dev',      label: 'DEV',      full: 'Developer',           icon: '💻',  color: '#00aaff' },
  { key: 'security', label: 'SEC',      full: 'Security Engineer',   icon: '🔐',  color: '#ff6644' },
  { key: 'qa',       label: 'QA',       full: 'QA Engineer',         icon: '🧪',  color: '#aa88ff' },
  { key: 'sre',      label: 'SRE',      full: 'SRE / DevOps',        icon: '🚀',  color: '#44ddff' },
]

const STATE_ORDER: WorkflowState[] = [
  'idle',
  'running_ba', 'waiting_ba_approval',
  'running_sa', 'waiting_sa_approval',
  'running_dev_lead', 'waiting_dev_lead_approval',
  'running_rest', 'done',
]

function agentStatus(agentKey: string, state: WorkflowState, outputs: AgentOutputs): 'done' | 'running' | 'pending' {
  const runningMap: Record<string, WorkflowState[]> = {
    ba:       ['running_ba'],
    sa:       ['running_sa'],
    dev_lead: ['running_dev_lead'],
    dev:      ['running_rest'],
    security: ['running_rest'],
    qa:       ['running_rest'],
    sre:      ['running_rest'],
  }
  if (outputs[agentKey as keyof AgentOutputs]) return 'done'
  if (runningMap[agentKey]?.includes(state)) return 'running'
  return 'pending'
}

export default function SDLCWorkflow({ session, onUpdate, hasKB }: Props) {
  const [requirement, setRequirement] = useState(session.agent_outputs.requirement || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [viewingAgent, setViewingAgent] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const state = session.workflow_state
  const outputs = session.agent_outputs

  const run = async (fn: () => Promise<any>) => {
    setLoading(true)
    setError('')
    try {
      const res = await fn()
      // Refresh session state from server
      const updated = await api.sdlc.state(session.id) as any
      onUpdate({
        workflow_state: updated.workflow_state,
        agent_outputs: updated.agent_outputs,
        jira_backlog: updated.jira_backlog,
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const openAgent = (key: string) => {
    const content = outputs[key as keyof AgentOutputs] || ''
    setEditContent(content)
    setViewingAgent(key)
  }

  const isWaiting = (approval: WorkflowState) => state === approval

  return (
    <div className="flex flex-col h-full">

      {/* Pipeline visualization */}
      <div className="p-3 border-b border-border flex gap-1 items-center overflow-x-auto">
        {AGENTS.map((agent, i) => {
          const status = agentStatus(agent.key, state, outputs)
          return (
            <div key={agent.key} className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => outputs[agent.key as keyof AgentOutputs] && openAgent(agent.key)}
                className={[
                  'flex flex-col items-center gap-[0.2rem] px-2 py-[0.4rem] rounded transition-all duration-200 min-w-[52px]',
                  status === 'done'
                    ? 'bg-green-mute border border-green-dim'
                    : 'bg-bg-2 border',
                  status === 'running'
                    ? 'border-amber'
                    : status === 'done'
                      ? ''
                      : 'border-border',
                  outputs[agent.key as keyof AgentOutputs] ? 'cursor-pointer' : 'cursor-default',
                ].join(' ')}
              >
                <span className="text-lg">{agent.icon}</span>
                <span className={[
                  'text-[0.6rem] font-bold tracking-[0.06em]',
                  status === 'done' ? 'text-green' : status === 'running' ? 'text-amber' : 'text-text-3',
                ].join(' ')}>
                  {status === 'running' ? '⟳' : status === 'done' ? '✓' : ''} {agent.label}
                </span>
              </button>
              {i < AGENTS.length - 1 && (
                <span className="text-border-2 text-[0.7rem]">→</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex-1 overflow-auto p-[0.9rem] flex flex-col gap-[0.9rem]">

        {/* IDLE: Start CR */}
        {(state === 'idle' || state === 'done') && (
          <div className="flex flex-col gap-[0.7rem]">
            {state === 'done' && (
              <div className="px-[0.9rem] py-[0.6rem] bg-green-mute border border-green-dim rounded text-sm text-green">
                🎉 SDLC Pipeline complete! Start a new CR below.
              </div>
            )}
            <label className="text-xs text-text-2 uppercase tracking-[0.06em]">
              Change Request
            </label>
            <textarea
              className="input"
              rows={4}
              placeholder="Describe the feature or change required..."
              value={requirement}
              onChange={e => setRequirement(e.target.value)}
              disabled={!hasKB}
              style={{ resize: 'vertical' }}
            />
            <button
              className="btn btn-primary justify-center"
              onClick={() => run(() => api.sdlc.start(session.id, requirement))}
              disabled={!hasKB || loading || !requirement.trim()}
            >
              {loading ? '⟳ Running BA...' : '▶ Start SDLC Pipeline'}
            </button>
            {!hasKB && <div className="text-xs text-text-3">Scan repo first to enable SDLC.</div>}
          </div>
        )}

        {/* Running states */}
        {state.startsWith('running_') && (
          <div className="text-center p-8 text-text-2 text-base">
            <div className="blink text-green text-[1.5rem] mb-2">⟳</div>
            Agent running...
          </div>
        )}

        {/* WAITING BA APPROVAL */}
        {isWaiting('waiting_ba_approval') && (
          <ApprovalCard
            title="BA — Business Requirements Document"
            agentKey="ba"
            outputs={outputs}
            loading={loading}
            onView={() => openAgent('ba')}
            onApprove={() => run(() => api.sdlc.approveBa(session.id))}
            onApproveEdited={() => run(() => api.sdlc.approveBa(session.id, editContent))}
          />
        )}

        {/* WAITING SA APPROVAL */}
        {isWaiting('waiting_sa_approval') && (
          <ApprovalCard
            title="SA — System Architecture Document"
            agentKey="sa"
            outputs={outputs}
            loading={loading}
            onView={() => openAgent('sa')}
            onApprove={() => run(() => api.sdlc.approveSa(session.id))}
            onApproveEdited={() => run(() => api.sdlc.approveSa(session.id, editContent))}
          />
        )}

        {/* WAITING DEV LEAD APPROVAL */}
        {isWaiting('waiting_dev_lead_approval') && (
          <ApprovalCard
            title="Dev Lead — Implementation Plan"
            agentKey="dev_lead"
            outputs={outputs}
            loading={loading}
            onView={() => openAgent('dev_lead')}
            onApprove={() => run(() => api.sdlc.approveDevLead(session.id))}
            onApproveEdited={() => run(() => api.sdlc.approveDevLead(session.id, editContent))}
          />
        )}

        {/* DONE — show all outputs */}
        {state === 'done' && (
          <div className="flex flex-col gap-2">
            <div className="text-xs text-text-2 uppercase tracking-[0.06em]">
              Agent Outputs — click to view
            </div>
            {AGENTS.filter(a => outputs[a.key as keyof AgentOutputs]).map(agent => (
              <button key={agent.key} className="btn btn-ghost justify-start gap-2" onClick={() => openAgent(agent.key)}>
                <span>{agent.icon}</span>
                <span className="text-text">{agent.full}</span>
                <span className="ml-auto text-green text-[0.7rem]">view →</span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="px-3 py-2 bg-[rgba(255,68,68,0.06)] border border-red-dim rounded text-sm text-red">
            ❌ {error}
          </div>
        )}
      </div>

      {/* Agent output viewer/editor modal */}
      {viewingAgent && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,0.9)] z-[100] flex flex-col">
          <div className="bg-bg-1 border-b border-border px-4 py-[0.6rem] flex gap-3 items-center">
            <span className="text-green text-base font-semibold">
              {AGENTS.find(a => a.key === viewingAgent)?.full} Output
            </span>
            <span className="text-text-3 text-xs">
              {isWaiting('waiting_ba_approval') && viewingAgent === 'ba' ? '— edit before approving' :
               isWaiting('waiting_sa_approval') && viewingAgent === 'sa' ? '— edit before approving' :
               isWaiting('waiting_dev_lead_approval') && viewingAgent === 'dev_lead' ? '— edit before approving' : ''}
            </span>
            <button className="btn btn-ghost ml-auto px-2 py-[0.2rem]" onClick={() => setViewingAgent(null)}>✕</button>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Rendered view */}
            <div className="flex-1 overflow-auto p-6">
              <div className="prose" dangerouslySetInnerHTML={{ __html: mdToHtml(editContent) }} />
            </div>
            {/* Edit textarea */}
            <div className="w-[45%] border-l border-border flex flex-col">
              <div className="px-3 py-[0.4rem] border-b border-border text-[0.7rem] text-text-3">
                ✎ Edit
              </div>
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="flex-1 bg-bg border-none outline-none px-3 py-3 font-mono text-sm text-text leading-[1.6] resize-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ApprovalCard({ title, agentKey, outputs, loading, onView, onApprove, onApproveEdited }: {
  title: string; agentKey: string; outputs: AgentOutputs;
  loading: boolean; onView: () => void; onApprove: () => void; onApproveEdited: () => void;
}) {
  const content = outputs[agentKey as keyof AgentOutputs] || ''
  return (
    <div className="flex flex-col gap-[0.7rem]">
      <div className="text-xs text-amber uppercase tracking-[0.06em]">
        ⏳ Awaiting approval: {title}
      </div>
      <div className="p-[0.7rem] bg-bg-2 border border-border rounded text-sm text-text-2 leading-[1.6] max-h-[120px] overflow-hidden relative">
        {content.slice(0, 400)}...
        <div className="absolute bottom-0 left-0 right-0 h-[40px] bg-gradient-to-t from-bg-2 to-transparent" />
      </div>
      <div className="flex gap-2">
        <button className="btn btn-ghost flex-1 justify-center" onClick={onView}>
          View & Edit
        </button>
        <button className="btn btn-amber flex-1 justify-center" onClick={onApprove} disabled={loading}>
          {loading ? '⟳' : '✓ Approve →'}
        </button>
      </div>
    </div>
  )
}

function mdToHtml(md: string): string {
  return md
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^\|(.+)\|$/gm, (row) => `<tr>${row.split('|').filter(Boolean).map(c => `<td>${c.trim()}</td>`).join('')}</tr>`)
    .replace(/(<tr>[\s\S]*?<\/tr>)/g, '<table>$1</table>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
}
