'use client'

import React, { useRef, useEffect, useState } from 'react'
import {
  Sparkles, Copy, Check, Download, Zap, CheckCircle2,
  Loader2, RotateCcw, Square,
} from 'lucide-react'
import AgentCard from './AgentCard'
import { mdToHtml } from '@/lib/mdToHtml'
import { api } from '@/lib/api'
import type { Session, AgentOutputs } from '@/lib/types'

// ─── Skill builder ────────────────────────────────────────────────────────────

/** Converts a free-text requirement into a valid SKILL.md `name` slug. */
function slugifySkillName(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'sdlc-skill'
}

/** Builds a complete SKILL.md string from SDLC pipeline outputs. */
function buildSkillMd(outputs: AgentOutputs): string {
  const requirement = outputs.requirement ?? 'project'
  const name = slugifySkillName(requirement)
  const descBase = requirement.length > 200 ? requirement.slice(0, 200).trim() + '...' : requirement
  const description =
    `Use this skill when working on: ${descBase}. Covers BRD, architecture, ` +
    `technical plan, implementation, security, QA, and DevOps guidelines.`

  const parts: string[] = [
    `---\nname: ${name}\ndescription: >\n  ${description.replace(/\n/g, '\n  ')}\n---`,
    `# ${requirement}`,
  ]

  if (outputs.ba)       parts.push(`## Business Requirements (BRD)\n\n${outputs.ba}`)
  if (outputs.sa)       parts.push(`## Solution Architecture\n\n${outputs.sa}`)
  if (outputs.dev_lead) parts.push(`## Technical Plan\n\n${outputs.dev_lead}`)
  if (outputs.dev)      parts.push(`## Implementation Guidelines\n\n${outputs.dev}`)
  if (outputs.security) parts.push(`## Security Guidelines\n\n${outputs.security}`)
  if (outputs.qa)       parts.push(`## QA Guidelines\n\n${outputs.qa}`)
  if (outputs.sre)      parts.push(`## DevOps / SRE Guidelines\n\n${outputs.sre}`)

  return parts.join('\n\n')
}

// ─── Skill exporter card ──────────────────────────────────────────────────────

type ExportFormat = 'chat' | 'skill'

function SkillExporter({ sessionId, outputs }: { sessionId: string; outputs: AgentOutputs }) {
  const skillMd = buildSkillMd(outputs)

  // ── format tab state ──────────────────────────────────────────────────────
  const [format, setFormat] = useState<ExportFormat>('chat')

  // ── chat-prompt state ─────────────────────────────────────────────────────
  const [chatPrompt, setChatPrompt] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  // ── shared copy/download state ────────────────────────────────────────────
  const [copied, setCopied] = useState(false)

  // ── helpers ───────────────────────────────────────────────────────────────
  const activeContent = format === 'chat' ? chatPrompt : skillMd
  const downloadName  = format === 'chat' ? 'prompt.md'  : 'SKILL.md'

  const handleGenerate = async () => {
    setGenerating(true)
    setGenError(null)
    try {
      const res = await api.sdlc.exportPrompt(sessionId, 'chat')
      setChatPrompt(res.prompt)
    } catch (e) {
      setGenError((e as Error).message || 'Failed to generate prompt.')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = () => {
    if (!activeContent) return
    navigator.clipboard.writeText(activeContent).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleDownload = () => {
    if (!activeContent) return
    const blob = new Blob([activeContent], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = downloadName
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // ── shared button styles ──────────────────────────────────────────────────
  const btnBase: React.CSSProperties = {
    padding: '.4rem 1rem',
    borderRadius: '4px',
    border: '1px solid rgba(170,136,255,.35)',
    background: 'rgba(170,136,255,.12)',
    color: '#aa88ff',
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
  }

  return (
    <div className="border rounded-lg overflow-hidden"
      style={{ background: 'var(--bg)', borderColor: 'rgba(170,136,255,.35)' }}>

      {/* ── Card header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b"
        style={{ background: 'rgba(170,136,255,.08)', borderColor: 'rgba(170,136,255,.25)' }}>
        <span className="text-sm font-bold flex items-center gap-1.5" style={{ color: '#aa88ff' }}>
          <Sparkles size={14} /> Export as Agent Skill
        </span>

        {/* Copy + Download buttons — only active when there is content */}
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            disabled={!activeContent}
            style={{
              ...btnBase,
              background: copied ? 'rgba(80,230,120,.15)' : btnBase.background,
              borderColor: copied ? 'rgba(80,230,120,.4)' : 'rgba(170,136,255,.35)',
              color: copied ? 'var(--green)' : '#aa88ff',
              opacity: activeContent ? 1 : 0.4,
              cursor: activeContent ? 'pointer' : 'not-allowed',
            }}
          >
            {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
          </button>
          <button
            onClick={handleDownload}
            disabled={!activeContent}
            style={{
              ...btnBase,
              opacity: activeContent ? 1 : 0.4,
              cursor: activeContent ? 'pointer' : 'not-allowed',
            }}
          >
            <Download size={13} /> Download {downloadName}
          </button>
        </div>
      </div>

      {/* ── Format tabs ───────────────────────────────────────────────────── */}
      <div className="flex border-b" style={{ borderColor: 'rgba(170,136,255,.15)' }}>
        {(['chat', 'skill'] as ExportFormat[]).map((f) => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            className="px-5 py-3 font-mono text-xs font-bold transition-colors"
            style={{
              background: format === f ? 'rgba(170,136,255,.12)' : 'transparent',
              color: format === f ? '#aa88ff' : 'var(--text-3)',
              borderBottom: format === f ? '2px solid #aa88ff' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {f === 'chat' ? 'Chat Prompt' : 'SKILL.md'}
          </button>
        ))}
      </div>

      {/* ── Chat Prompt tab ───────────────────────────────────────────────── */}
      {format === 'chat' && (
        <>
          {/* Not yet generated */}
          {!chatPrompt && !generating && (
            <div className="flex flex-col items-center gap-3 py-8 px-5">
              <p className="text-xs text-center" style={{ color: 'var(--text-3)', maxWidth: 360 }}>
                Generate a distilled implementation prompt — ready to paste into Claude, ChatGPT, Cursor, or any coding assistant.
              </p>
              {genError && (
                <p className="text-xs font-mono" style={{ color: 'var(--red)' }}>{genError}</p>
              )}
               <button onClick={handleGenerate} style={{ ...btnBase, padding: '.45rem 1.4rem' }}>
                 <Sparkles size={14} /> Generate implementation prompt
               </button>
            </div>
          )}

          {/* Loading */}
          {generating && (
            <div className="flex items-center justify-center gap-2 py-8 px-5">
              <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-3)' }} />
              <span className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>
                Distilling pipeline outputs…
              </span>
            </div>
          )}

          {/* Result */}
          {chatPrompt && !generating && (
            <pre
              className="overflow-auto font-mono text-xs leading-relaxed"
              style={{
                maxHeight: 320,
                margin: 0,
                padding: '1rem 1.25rem',
                background: 'var(--bg-1)',
                color: 'var(--text-2)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {chatPrompt}
            </pre>
          )}
        </>
      )}

      {/* ── SKILL.md tab ──────────────────────────────────────────────────── */}
      {format === 'skill' && (
        <pre
          className="overflow-auto font-mono text-xs leading-relaxed"
          style={{
            maxHeight: 320,
            margin: 0,
            padding: '1rem 1.25rem',
            background: 'var(--bg-1)',
            color: 'var(--text-2)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {skillMd}
        </pre>
      )}
    </div>
  )
}

// ─── AutoScrollDiv ────────────────────────────────────────────────────────────

/** Renders HTML and auto-scrolls to the bottom whenever the content changes. */
function AutoScrollDiv({ html, maxHeight }: { html: string; maxHeight: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [html])
  return (
    <div
      ref={ref}
      className="prose overflow-auto"
      style={{ maxHeight }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

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

  // Auto-scroll the outer panel to the bottom whenever streaming text updates
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [streamingText])

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
    <div ref={containerRef} className="h-full overflow-auto p-6">
      {/* Header row with title + stop button */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-extrabold text-xl flex items-center gap-2" style={{ color: 'var(--amber)' }}>
          <Zap size={18} /> Multi-Agent SDLC Brainstorm
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
            <Square size={12} /> Stop Pipeline
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
                      <AutoScrollDiv html={mdToHtml((outputs as any)[key])} maxHeight={280} />
                    ) : streamingAgent === key ? (
                      <AutoScrollDiv html={mdToHtml(streamingText)} maxHeight={280} />
                    ) : (
                      <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                        {state === 'running_rest' ? <><Loader2 size={11} className="animate-spin" /> Processing...</> : '—'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {state === 'done' && (
          <div className="flex flex-col gap-4">
            <div className="border rounded-lg px-6 py-4 font-bold text-center"
              style={{ background: 'var(--green-mute)', borderColor: 'var(--green-dim)', color: 'var(--green)' }}>
              🎉 SDLC Pipeline complete! Check the JIRA Kanban for the backlog.
            </div>
            <SkillExporter sessionId={session.id} outputs={outputs} />
          </div>
        )}

        {/* ── Checkpoint restore (visible when pipeline stopped with partial outputs) ── */}
        {canRestore && (
          <div className="border rounded-lg px-5 py-4"
            style={{ background: 'rgba(255,179,0,.04)', borderColor: 'rgba(255,179,0,.25)' }}>
            <div className="text-xs font-bold mb-3 flex items-center gap-1.5" style={{ color: 'var(--amber)' }}>
              <RotateCcw size={12} /> Restore checkpoint
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
                  <Check size={11} /> BA
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
                  <Check size={11} /> SA
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
                  <Check size={11} /> Dev Lead
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
