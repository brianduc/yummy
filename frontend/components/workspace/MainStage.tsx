'use client'

import React from 'react'
import { Search } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import SDLCStepper from './SDLCStepper'
import type { WorkflowState, Session } from '@/lib/types'

type MainTabId = 'ide' | 'graph' | 'wiki' | 'insights' | 'rag' | 'sdlc' | 'backlog' | 'db' | 'world'

const MAIN_TABS: { id: MainTabId; label: string; color: string }[] = [
  { id: 'ide',      label: 'IDE Simulator',     color: 'var(--text-2)' },
  { id: 'graph',    label: 'Node Arch',          color: 'var(--green)' },
  { id: 'wiki',     label: 'GitBook Wiki',       color: '#ff79c6' },
  { id: 'insights', label: 'AI Insights',        color: 'var(--amber)' },
  { id: 'rag',      label: 'RAG Trace',          color: '#00aaff' },
  { id: 'sdlc',     label: 'SDLC Brainstorm',    color: 'var(--amber)' },
  { id: 'backlog',  label: 'JIRA Kanban',        color: '#aa88ff' },
  { id: 'db',       label: 'Local DB',           color: '#ff6644' },
  { id: 'world',    label: 'World',              color: '#00ffaa' },
]

interface MainStageProps {
  activeTab: MainTabId
  onTabChange: (tab: MainTabId) => void
  sessionName: string
  session: Session | null
  workflowState: WorkflowState
  streamingAgent: string | null
  isSDLCDone: boolean
  workflowRunning: boolean
  onOpenCommandPalette: () => void
  onApproveBA?: () => void
  onApproveSA?: () => void
  onApproveDevLead?: () => void
  onStop?: () => void
  children: React.ReactNode
}

export default function MainStage({
  activeTab,
  onTabChange,
  sessionName,
  session,
  workflowState,
  streamingAgent,
  isSDLCDone,
  workflowRunning,
  onOpenCommandPalette,
  onApproveBA,
  onApproveSA,
  onApproveDevLead,
  onStop,
  children,
}: MainStageProps) {
  const hasSDLCStarted = workflowState !== 'idle'

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      {/* Top header with breadcrumbs + search */}
      <div
        className="flex items-center justify-between px-4 flex-shrink-0 border-b"
        style={{ height: 37, background: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-[var(--text-3)]">Workspace</span>
          <span className="text-[var(--text-3)]">/</span>
          <span className="text-[var(--green)] font-medium truncate max-w-[300px]">
            {sessionName}
          </span>
          {hasSDLCStarted && session?.agent_outputs?.requirement && (
            <>
              <span className="text-[var(--text-3)]">/</span>
              <span className="text-[var(--amber)] truncate max-w-[200px]">
                {session.agent_outputs.requirement.slice(0, 40)}...
              </span>
            </>
          )}
        </div>

        {/* Cmd+K search button */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-2xs font-mono cursor-pointer transition-colors hover:bg-[var(--bg-2)]"
          style={{ color: 'var(--text-3)', border: '1px solid var(--border)' }}
        >
          <Search size={12} />
          <span>Search</span>
          <kbd className="px-1 py-0.5 rounded text-[0.6rem]" style={{ background: 'var(--bg-3)', border: '1px solid var(--border-2)' }}>
            ⌘K
          </kbd>
        </button>
      </div>

      {/* SDLC Stepper */}
      {hasSDLCStarted && (
        <SDLCStepper
          workflowState={workflowState}
          streamingAgent={streamingAgent}
          isDone={isSDLCDone}
          onApproveBA={onApproveBA}
          onApproveSA={onApproveSA}
          onApproveDevLead={onApproveDevLead}
          onStop={onStop}
          workflowRunning={workflowRunning}
        />
      )}

      {/* Main content tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => onTabChange(v as MainTabId)}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="flex-shrink-0 overflow-x-auto px-1">
          {MAIN_TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              style={{
                color: activeTab === tab.id ? tab.color : undefined,
              }}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="flex-1 overflow-hidden">
          <div className="h-full" style={{ background: 'var(--bg-1)' }}>
            {children}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export type { MainTabId }
