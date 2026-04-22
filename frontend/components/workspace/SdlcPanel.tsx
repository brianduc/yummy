'use client'

import React from 'react'
import AgentCard from './AgentCard'
import { mdToHtml } from '@/lib/mdToHtml'
import type { Session, AgentOutputs } from '@/lib/types'

interface SdlcPanelProps {
  session: Session
  editBA: string
  editSA: string
  editDevLead: string
  busy: boolean
  workflowRunning: boolean
  /** Which agent is actively streaming tokens right now (null = none) */
  streamingAgent: string | null
  /** Accumulated streamed text for the current agent (flushed ~60ms) */
  streamingText: string
  onEditBA: (v: string) => void
  onEditSA: (v: string) => void
  onEditDevLead: (v: string) => void
  onApproveBA: () => void
  onApproveSA: () => void
  onApproveDevLead: () => void
  onStop: () => void
  onRestore: (checkpoint: 'ba' | 'sa' | 'dev_lead') => void
}

export default function SdlcPanel({
  session, editBA, editSA, editDevLead, busy, workflowRunning,
  streamingAgent, streamingText,
  onEditBA, onEditSA, onEditDevLead,
  onApproveBA, onApproveSA, onApproveDevLead,
  onStop, onRestore,
}: SdlcPanelProps) {
  const outputs: AgentOutputs = session.agent_outputs || {}
  const state = session.workflow_state

  // Determine which checkpoints are available for restore
  // (only shown when pipeline is idle after having run at least once)
  const canRestore =
    state === 'idle' &&
    !!outputs.requirement &&
    (!!outputs.ba || !!outputs.sa || !!outputs.dev_lead)

  if (!outputs.requirement) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full" style={{ color: 'var(--text-3)' }}>
        <div className="text-5xl opacity-10">⬡</div>
        <p>Type <code>/cr [requirement]</code> in the terminal to start SDLC.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-6">
      {/* Header row with title + stop button */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-extrabold text-xl" style={{ color: 'var(--amber)' }}>
          ⚡ Multi-Agent SDLC Brainstorm
        </h2>
        {workflowRunning && (
          <button
            onClick={onStop}
            disabled={busy && !workflowRunning}
            className="flex items-center gap-1.5 border rounded-lg font-mono text-xs font-bold cursor-pointer transition-colors"
            style={{
              padding: '.35rem .85rem',
              background: 'rgba(255,100,68,.1)',
              borderColor: 'rgba(255,100,68,.4)',
              color: '#ff6644',
            }}
            title="Stop the running pipeline (type /stop in terminal)"
          >
            ⏹ Stop Pipeline
          </button>
        )}
      </div>

      <div className="relative pl-12 flex flex-col gap-8 max-w-[820px]">
        {/* Vertical timeline line */}
        <div className="absolute top-0 bottom-0 w-px" style={{ left: 22, background: 'var(--border)' }} />

        {(outputs.ba || state === 'running_ba' || streamingAgent === 'ba') && (
          <AgentCard dot="var(--green)" title="1. Business Analyst (BRD)"
            loading={state === 'running_ba' && !outputs.ba && streamingAgent !== 'ba'}
            content={streamingAgent === 'ba' ? streamingText : outputs.ba}
            editable={state === 'waiting_ba_approval'}
            editValue={editBA} onEditChange={onEditBA}
            onApprove={onApproveBA} approveLabel="Approve BA" approveColor="var(--green)" busy={busy} />
        )}

        {(outputs.sa || state === 'running_sa' || streamingAgent === 'sa') && (
          <AgentCard dot="#00aaff" title="2. Solution Architect (Design)"
            loading={state === 'running_sa' && !outputs.sa && streamingAgent !== 'sa'}
            content={streamingAgent === 'sa' ? streamingText : outputs.sa}
            editable={state === 'waiting_sa_approval'}
            editValue={editSA} onEditChange={onEditSA}
            onApprove={onApproveSA} approveLabel="Approve SA" approveColor="#00aaff" busy={busy} />
        )}

        {(outputs.dev_lead || state === 'running_dev_lead' || streamingAgent === 'dev_lead') && (
          <AgentCard dot="var(--amber)" title="3. Tech Lead (Plan)"
            loading={state === 'running_dev_lead' && !outputs.dev_lead && streamingAgent !== 'dev_lead'}
            content={streamingAgent === 'dev_lead' ? streamingText : outputs.dev_lead}
            editable={state === 'waiting_dev_lead_approval'}
            editValue={editDevLead} onEditChange={onEditDevLead}
            onApprove={onApproveDevLead} approveLabel="Approve Dev Lead" approveColor="var(--amber)" busy={busy} />
        )}

        {(outputs.dev || outputs.security || state === 'running_rest' || ['dev', 'security', 'qa', 'sre'].includes(streamingAgent ?? '')) && (
          <div className="relative">
            <div className="absolute" style={{ left: -38, top: 14, width: 14, height: 14, borderRadius: '50%', background: 'var(--bg)', border: '2px solid #aa88ff' }} />
            <div className="border rounded-lg overflow-hidden" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
              <div className="border-b px-5 py-2.5 text-sm font-bold"
                style={{ background: 'rgba(170,136,255,.08)', borderColor: 'var(--border)', color: '#aa88ff' }}>
                4. Implementation &amp; Verification
              </div>
              <div className="p-5 flex flex-col gap-4">
                {([
                  { key: 'dev',      label: '💻 Lead Developer',  color: 'var(--amber)' },
                  { key: 'security', label: '🔐 Security Review', color: 'var(--red)' },
                  { key: 'qa',       label: '🧪 QA Engineer',     color: '#aa88ff' },
                  { key: 'sre',      label: '🚀 SRE / DevOps',    color: '#44ddff' },
                ] as const).map(({ key, label, color }) => (
                  <div key={key} className="border rounded-lg px-4 py-3"
                    style={{ background: 'var(--bg-1)', borderColor: 'var(--border)' }}>
                    <div className="text-xs font-bold mb-2" style={{ color }}>{label}</div>
                    {(outputs as any)[key] ? (
                      <div className="prose overflow-auto" style={{ maxHeight: 280 }}
                        dangerouslySetInnerHTML={{ __html: mdToHtml((outputs as any)[key]) }} />
                    ) : streamingAgent === key ? (
                      <div className="prose overflow-auto" style={{ maxHeight: 280 }}
                        dangerouslySetInnerHTML={{ __html: mdToHtml(streamingText) }} />
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                        {state === 'running_rest' ? '⟳ Processing...' : '—'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {state === 'done' && (
          <div className="border rounded-lg px-6 py-4 font-bold text-center"
            style={{ background: 'var(--green-mute)', borderColor: 'var(--green-dim)', color: 'var(--green)' }}>
            🎉 SDLC Pipeline complete! Check the JIRA Kanban for the backlog.
          </div>
        )}

        {/* ── Checkpoint restore (visible when pipeline stopped with partial outputs) ── */}
        {canRestore && (
          <div className="border rounded-lg px-5 py-4"
            style={{ background: 'rgba(255,179,0,.04)', borderColor: 'rgba(255,179,0,.25)' }}>
            <div className="text-xs font-bold mb-3" style={{ color: 'var(--amber)' }}>
              ↩ Restore checkpoint
            </div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>
              Roll back to a completed stage and resume from there.
              Outputs after the selected stage will be cleared.
            </p>
            <div className="flex flex-wrap gap-2">
              {outputs.ba && (
                <button
                  onClick={() => onRestore('ba')}
                  disabled={busy}
                  className="border rounded font-mono text-xs cursor-pointer transition-colors disabled:opacity-40"
                  style={{
                    padding: '.3rem .75rem',
                    background: 'rgba(80,230,120,.08)',
                    borderColor: 'rgba(80,230,120,.3)',
                    color: 'var(--green)',
                  }}
                >
                  ✓ BA
                </button>
              )}
              {outputs.sa && (
                <button
                  onClick={() => onRestore('sa')}
                  disabled={busy}
                  className="border rounded font-mono text-xs cursor-pointer transition-colors disabled:opacity-40"
                  style={{
                    padding: '.3rem .75rem',
                    background: 'rgba(0,170,255,.08)',
                    borderColor: 'rgba(0,170,255,.3)',
                    color: '#00aaff',
                  }}
                >
                  ✓ SA
                </button>
              )}
              {outputs.dev_lead && (
                <button
                  onClick={() => onRestore('dev_lead')}
                  disabled={busy}
                  className="border rounded font-mono text-xs cursor-pointer transition-colors disabled:opacity-40"
                  style={{
                    padding: '.3rem .75rem',
                    background: 'rgba(255,179,0,.08)',
                    borderColor: 'rgba(255,179,0,.3)',
                    color: 'var(--amber)',
                  }}
                >
                  ✓ Dev Lead
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
