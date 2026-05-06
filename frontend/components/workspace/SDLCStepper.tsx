'use client'

import React from 'react'
import { CheckCircle2, Loader2, Circle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkflowState } from '@/lib/types'

interface AgentStep {
  key: string
  label: string
  states: WorkflowState[]
  approveState: WorkflowState
  color: string
}

const STEPS: AgentStep[] = [
  {
    key: 'ba',
    label: 'BA Agent',
    states: ['running_ba', 'waiting_ba_approval'],
    approveState: 'waiting_ba_approval',
    color: 'var(--green)',
  },
  {
    key: 'sa',
    label: 'SA Agent',
    states: ['running_sa', 'waiting_sa_approval'],
    approveState: 'waiting_sa_approval',
    color: '#ffb300',
  },
  {
    key: 'dev_lead',
    label: 'Dev Lead',
    states: ['running_dev_lead', 'waiting_dev_lead_approval'],
    approveState: 'waiting_dev_lead_approval',
    color: '#64a0ff',
  },
  {
    key: 'rest',
    label: 'DEV / QA / SEC / SRE',
    states: ['running_rest'],
    approveState: 'running_rest',
    color: '#ff79c6',
  },
]

interface SDLCStepperProps {
  workflowState: WorkflowState
  streamingAgent: string | null
  isDone: boolean
  onApproveBA?: () => void
  onApproveSA?: () => void
  onApproveDevLead?: () => void
  onStop?: () => void
  busy?: boolean
}

export default function SDLCStepper({
  workflowState,
  streamingAgent,
  isDone,
  onApproveBA,
  onApproveSA,
  onApproveDevLead,
  onStop,
  busy,
}: SDLCStepperProps) {
  if (workflowState === 'idle') return null

  const getStepStatus = (step: AgentStep): 'completed' | 'active' | 'waiting' | 'pending' => {
    if (isDone) return 'completed'
    if (workflowState === step.approveState) return 'waiting'
    if (step.states.includes(workflowState)) return 'active'

    // Check if this step has been completed (is before current state)
    const currentIndex = STEPS.findIndex((s) => s.states.includes(workflowState) || s.approveState === workflowState)
    const stepIndex = STEPS.indexOf(step)
    if (currentIndex === -1) return 'pending'
    if (stepIndex < currentIndex) return 'completed'
    return 'pending'
  }

  const handleApprove = (step: AgentStep) => {
    if (step.key === 'ba') onApproveBA?.()
    else if (step.key === 'sa') onApproveSA?.()
    else if (step.key === 'dev_lead') onApproveDevLead?.()
  }

  return (
    <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto flex-shrink-0"
      style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)' }}>
      {STEPS.map((step, i) => {
        const status = getStepStatus(step)
        const isStreaming = streamingAgent === step.key || (step.key === 'rest' && streamingAgent && !STEPS.slice(0, -1).some(s => s.key === streamingAgent))

        return (
          <React.Fragment key={step.key}>
            {/* Step */}
            <div
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono whitespace-nowrap transition-colors',
                status === 'completed' && 'bg-[var(--green-mute)] text-[var(--green)]',
                status === 'active' && 'text-[var(--green)]',
                status === 'waiting' && 'bg-[rgba(255,179,0,0.08)] text-[var(--amber)] border border-[var(--amber-dim)]',
                status === 'pending' && 'text-[var(--text-3)]',
                isStreaming && 'text-[var(--green)]',
              )}
              style={status === 'active' && !isStreaming ? { background: 'rgba(0,255,136,0.05)' } : undefined}
            >
              {/* Status icon */}
              {status === 'completed' ? (
                <CheckCircle2 size={14} style={{ color: 'var(--green)' }} />
              ) : isStreaming || status === 'active' ? (
                <Loader2 size={14} className="animate-spin" style={{ color: 'var(--green)' }} />
              ) : (
                <Circle size={14} style={{ color: status === 'waiting' ? 'var(--amber)' : 'var(--text-3)' }} />
              )}

              <span className="font-medium tracking-wide">[{i + 1}]</span>
              <span>{step.label}</span>

              {/* Approve button when waiting */}
              {status === 'waiting' && step.key !== 'rest' && !busy && (
                <button
                  onClick={() => handleApprove(step)}
                  className="ml-1 px-2 py-0.5 rounded font-bold text-2xs cursor-pointer transition-all hover:opacity-80"
                  style={{
                    background: 'var(--amber)',
                    color: 'var(--text-inv)',
                  }}
                >
                  Approve
                </button>
              )}
            </div>

            {/* Connector */}
            {i < STEPS.length - 1 && (
              <ChevronRight
                size={14}
                className="flex-shrink-0"
                style={{ color: 'var(--text-3)' }}
              />
            )}
          </React.Fragment>
        )
      })}

      {/* Stop button when running */}
      {(workflowState.includes('running') || busy) && !isDone && (
        <button
          onClick={onStop}
          className="ml-3 px-2.5 py-1 rounded font-mono text-2xs font-bold cursor-pointer transition-all flex items-center gap-1"
          style={{
            background: 'var(--red-dim)',
            color: 'var(--red)',
            border: '1px solid var(--red-dim)',
          }}
        >
          ⬛ Stop
        </button>
      )}
    </div>
  )
}
