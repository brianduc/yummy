'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useScanPoll } from '@/hooks/useScanPoll'
import { useWorkspaceChat, WorkspaceChatProvider } from '@/hooks/useWorkspaceChat'
import { applyTheme, loadSavedTheme, THEMES, type ThemeId } from '@/lib/theme'
import { loadSavedUiSize } from '@/lib/uiSize'

import WorkspaceLayout from '@/components/workspace/WorkspaceLayout'
import type { ActivityId } from '@/components/workspace/ActivityBar'
import type { MainTabId } from '@/components/workspace/MainStage'
import CommandPalette, { createDefaultCommands } from '@/components/workspace/CommandPalette'

import IdePanel from '@/components/workspace/IdePanel'
import NodeGraph from '@/components/workspace/NodeGraph'
import WikiPanel from '@/components/workspace/WikiPanel'
import InsightsPanel from '@/components/workspace/InsightsPanel'
import RagPanel from '@/components/workspace/RagPanel'
import SdlcPanel from '@/components/workspace/SdlcPanel'
import BacklogPanel from '@/components/workspace/BacklogPanel'
import DbPanel from '@/components/workspace/DbPanel'
import WorldPanel from '@/components/workspace/WorldPanel'
import SessionsPanel from '@/components/workspace/SessionsPanel'
import TracingPanel from '@/components/workspace/TracingPanel'
import SettingsPanel from '@/components/workspace/SettingsPanel'
import OnboardingWizard from '@/components/workspace/OnboardingWizard'

import type {
  Session, SystemStatus, KnowledgeBase,
  ScanStatus, MetricsData, ChatMessage, WorkflowState,
} from '@/lib/types'
import type { SdlcEvent } from '@/lib/api'

export default function WorkspacePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = React.use(params)
  const router = useRouter()

  const [activeActivity, setActiveActivity] = useState<ActivityId>('explorer')
  const [activeTab, setActiveTab] = useState<MainTabId>('ide')
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Server data
  const [session,  setSession]  = useState<Session | null>(null)
  const [status,   setStatus]   = useState<SystemStatus | null>(null)
  const [kb,       setKb]       = useState<KnowledgeBase | null>(null)
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null)
  const [metrics,  setMetrics]  = useState<MetricsData | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])

  // Chat / terminal
  const [termLogs, setTermLogs] = useState<{ role: string; text: string }[]>([
    { role: 'system', text: '⚡ YUMMY — type /help to see commands.' },
  ])

  // IDE
  const [ideFile,    setIdeFile]    = useState('')
  const [ideContent, setIdeContent] = useState('')
  const [ideLoading, setIdeLoading] = useState(false)

  // SDLC edit buffers
  const [editBA,      setEditBA]      = useState('')
  const [editSA,      setEditSA]      = useState('')
  const [editDevLead, setEditDevLead] = useState('')

  // SDLC streaming state
  const [streamingAgent, setStreamingAgent] = useState<string | null>(null)
  const [streamingText,  setStreamingText]  = useState('')

  // Tool call tracking
  type ToolCallEntry = {
    server: string
    tool: string
    args: Record<string, unknown>
    result?: { content: unknown; is_error: boolean }
  }
  const [toolCalls, setToolCalls] = useState<Record<string, ToolCallEntry[]>>({})

  // UI helpers
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [onboardingState, setOnboardingState] = useState<'asking' | 'wizard' | 'dismissed'>(() => {
    if (typeof window === 'undefined') return 'dismissed'
    const stored = localStorage.getItem('yummy_onboarding')
    if (stored === 'done') return 'dismissed'
    return 'asking'
  })


  // Fetchers
  const fetchSession = useCallback(async () => {
    try {
      setSession(await api.sessions.get(sessionId) as Session)
    } catch (e: any) {
      if (e.message?.includes('404')) {
        try {
          const fresh = await api.sessions.create() as Session
          router.replace(`/workspace/${fresh.id}`)
        } catch { }
      }
    }
  }, [sessionId, router])

  const fetchStatus   = useCallback(async () => { try { setStatus(await api.config.status() as SystemStatus) } catch { } }, [])
  const fetchKb       = useCallback(async () => { try { setKb(await api.kb.get() as KnowledgeBase) } catch { } }, [])
  const fetchSessions = useCallback(async () => { try { setSessions(await api.sessions.list() as Session[]) } catch { } }, [])
  const fetchMetrics  = useCallback(async () => { try { setMetrics(await api.metrics() as MetricsData) } catch { } }, [])

  // Bootstrap + polling
  useEffect(() => {
    fetchSession(); fetchStatus(); fetchKb(); fetchSessions()
    loadSavedTheme()
    loadSavedUiSize()
    const iv = setInterval(() => { fetchSession(); fetchStatus() }, 4000)
    return () => clearInterval(iv)
  }, [sessionId, fetchSession, fetchStatus, fetchKb, fetchSessions])

  const chatRef = useRef<any>(null)

  // Scan polling
  const { startScanPoll } = useScanPoll({
    onStatusUpdate: setScanStatus,
    onMessage: chatRef.current?.print,
    onComplete: async () => {
      await fetchKb(); await fetchStatus()
      chatRef.current?.chatRef.current?.print('✅ Scan complete.')
      setActiveTab('wiki')
    },
  })


  useEffect(() => {
    if (activeActivity === 'tracing') fetchMetrics()
  }, [activeActivity, fetchMetrics])

  const prevId = useRef('')
  useEffect(() => {
    if (session && session.id !== prevId.current) {
      prevId.current = session.id
      chatRef.current?.setChatHistory(session.chat_history || [])
      if (session.agent_outputs?.ba)       setEditBA(session.agent_outputs.ba)
      if (session.agent_outputs?.sa)       setEditSA(session.agent_outputs.sa)
      if (session.agent_outputs?.dev_lead) setEditDevLead(session.agent_outputs.dev_lead)
    }
  }, [session])

  // IDE file open
  const openFile = useCallback(async (path: string) => {
    setIdeFile(path); setActiveTab('ide'); setIdeLoading(true); setIdeContent('')
    try {
      const res = await api.kb.file(path) as any
      setIdeContent(res.content || '// (empty)')
    } catch (e: any) {
      setIdeContent(`// [ERROR LOADING FILE]: ${e.message}`)
    } finally { setIdeLoading(false) }
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // SDLC helpers
  const refreshSDLC = async () => {
    try {
      const u = await api.sdlc.state(sessionId) as any
      setSession(prev => prev ? { ...prev, workflow_state: u.workflow_state, agent_outputs: u.agent_outputs, jira_backlog: u.jira_backlog } : prev)
      if (u.agent_outputs?.ba)       setEditBA(u.agent_outputs.ba)
      if (u.agent_outputs?.sa)       setEditSA(u.agent_outputs.sa)
      if (u.agent_outputs?.dev_lead) setEditDevLead(u.agent_outputs.dev_lead)
    } catch { }
  }

  const runSdlcStream = async (gen: AsyncGenerator<SdlcEvent>): Promise<boolean> => {
    chatRef.current?.setBusy(true)
    setStreamingAgent(null)
    setStreamingText('')

    let currentAgent: string | null = null
    let accumulated = ''
    let wasStopped = false
    let flushTimer: ReturnType<typeof setTimeout> | null = null

    const flushText = () => setStreamingText(accumulated)
    const scheduleFlush = () => {
      if (flushTimer) return
      flushTimer = setTimeout(() => { flushTimer = null; flushText() }, 60)
    }

    try {
      for await (const event of gen) {
        if (event.t === 'start') {
          if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
          currentAgent = event.agent
          accumulated = ''
          setStreamingAgent(event.agent)
          setStreamingText('')
          setToolCalls(prev => ({ ...prev, [event.agent]: [] }))
        } else if (event.t === 'c') {
          accumulated += event.text
          scheduleFlush()
        } else if (event.t === 'agent_done') {
          if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
          const key = currentAgent
          const text = accumulated
          if (key) {
            setSession(prev => prev
              ? { ...prev, agent_outputs: { ...prev.agent_outputs, [key]: text } }
              : prev)
          }
          accumulated = ''
          setStreamingText('')
        } else if (event.t === 'done') {
          if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
          const ao = event.agent_outputs as Record<string, string>
          setSession(prev => prev ? {
            ...prev,
            workflow_state: event.state as WorkflowState,
            agent_outputs: ao as any,
            jira_backlog: event.jira_backlog as any,
          } : prev)
          if (ao?.ba)       setEditBA(ao.ba)
          if (ao?.sa)       setEditSA(ao.sa)
          if (ao?.dev_lead) setEditDevLead(ao.dev_lead)
        } else if (event.t === 'stopped') {
          if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
          wasStopped = true
          await refreshSDLC()
        } else if (event.t === 'error') {
          if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
          chatRef.current?.chatRef.current?.print(`❌ ${event.message}`)
        } else if (event.t === 'tool_call') {
          const agent = streamingAgent ?? 'unknown'
          setToolCalls(prev => ({
            ...prev,
            [agent]: [...(prev[agent] ?? []), { server: event.server, tool: event.tool, args: event.args }],
          }))
        } else if (event.t === 'tool_result') {
          const agent = streamingAgent ?? 'unknown'
          setToolCalls(prev => {
            const entries = [...(prev[agent] ?? [])]
            const last = entries[entries.length - 1]
            if (last) entries[entries.length - 1] = { ...last, result: { content: event.content, is_error: event.is_error } }
            return { ...prev, [agent]: entries }
          })
        }
      }
    } catch (e: any) {
      chatRef.current?.chatRef.current?.chatRef.current?.print(`❌ ${e.message}`)
    } finally {
      if (flushTimer) clearTimeout(flushTimer)
      setStreamingAgent(null)
      setStreamingText('')
      chatRef.current?.setBusy(false)
    }
    return wasStopped
  }

  const handleApproveBA = async () => {
    setSession(prev => prev ? { ...prev, workflow_state: 'running_sa' } : prev)
    chatRef.current?.chatRef.current?.print('📧 BA approved. Running SA...')
    const stopped = await runSdlcStream(api.sdlc.approveBaStream(sessionId, editBA))
    if (!stopped) chatRef.current?.chatRef.current?.print('⚠️ SA done. Waiting for approval...')
  }

  const handleApproveSA = async () => {
    setSession(prev => prev ? { ...prev, workflow_state: 'running_dev_lead' } : prev)
    chatRef.current?.chatRef.current?.print('📧 SA approved. Running Dev Lead...')
    const stopped = await runSdlcStream(api.sdlc.approveSaStream(sessionId, editSA))
    if (!stopped) chatRef.current?.chatRef.current?.print('⚠️ Dev Lead done. Waiting for approval...')
  }

  const handleApproveDevLead = async () => {
    setSession(prev => prev ? { ...prev, workflow_state: 'running_rest' } : prev)
    chatRef.current?.chatRef.current?.print('📧 Dev Lead approved. Running DEV/SEC/QA/SRE...')
    const stopped = await runSdlcStream(api.sdlc.approveDevLeadStream(sessionId, editDevLead))
    if (!stopped) chatRef.current?.chatRef.current?.print('🎉 Pipeline complete!')
  }

  const handleRestore = async (checkpoint: 'ba' | 'sa' | 'dev_lead') => {
    const labels: Record<string, string> = { ba: 'BA', sa: 'SA', dev_lead: 'Dev Lead' }
    chatRef.current?.setBusy(true)
    try {
      await api.sdlc.restore(sessionId, checkpoint)
      chatRef.current?.chatRef.current?.print(`↩ Restored to ${labels[checkpoint]} checkpoint. Review and approve to continue.`)
      await refreshSDLC()
    } catch (e: any) {
      chatRef.current?.chatRef.current?.print(`❌ Restore failed: ${e.message}`)
    } finally {
      chatRef.current?.setBusy(false)
    }
  }

  // RAG ask (streaming)
  // Session delete
  const handleStop = async () => {
    try {
      await api.sdlc.stop(sessionId)
      chatRef.current?.print('⏹ Pipeline stopped.')
      await refreshSDLC()
    } catch (e: any) {
      chatRef.current?.print(`❌ Stop failed: ${e.message}`)
    }
  }

  const deleteSession = async (targetId: string) => {
    try {
      await api.sessions.delete(targetId)
      await fetchSessions()
      showToast('🗑 Session deleted.')
      if (targetId === sessionId) {
        const fresh = await api.sessions.create() as Session
        await fetchSessions()
        router.replace(`/workspace/${fresh.id}`)
      }
    } catch (e: any) {
      showToast(`❌ ${e.message}`)
    }
  }

  const abortRef = useRef<AbortController>(new AbortController())
  const chat = useWorkspaceChat(sessionId, abortRef, {
    status,
    session,
    fetchStatus,
    fetchMetrics,
    startScanPoll,
    setScanStatus,
    setActiveTab: setActiveTab as any,
    setActiveActivity: setActiveActivity as any,
    setSession,
    runSdlcStream,
    handleStop,
    ideFile,
    ideContent: ideContent || null
  })
  chatRef.current = chat



  // Command palette commands
  const commandItems = createDefaultCommands({
    onScan: () => {
      if (status?.repo) {
        chatRef.current?.handleCmd('/scan')
      } else {
        chatRef.current?.print('No repo configured. Use /setup <github-url> to configure.')
      }
    },
    onNewSession: () => chatRef.current?.handleCmd('/new'),
    onToggleSettings: () => setActiveActivity('settings'),
    onToggleTracing: () => setActiveActivity('tracing'),
    onShowInfo: () => chatRef.current?.handleCmd('/info'),
    onHealthcheck: () => chatRef.current?.handleCmd('/healthcheck'),
    onStartSDLC: () => {
      chatRef.current?.print('Use /cr <requirement> in the chat to start the SDLC pipeline.')
    },
  })

  // ActivityBar routing
  const handleActivityChange = (id: ActivityId) => {
    setActiveActivity(id)
    if (id === 'sdlc') setActiveTab('sdlc')
    if (id === 'db') setActiveTab('db')
    if (id === 'tracing') fetchMetrics()
  }

  // Derived state
  const isRunning = session?.workflow_state?.includes('running') || !!scanStatus?.running
  const isSDLCDone = session?.workflow_state === 'done'

  if (!session) {
    return (
      <div className="h-screen flex items-center justify-center font-mono text-sm" style={{ color: 'var(--text-3)' }}>
        <span style={{ color: 'var(--green)' }}>▊</span>&nbsp;Loading workspace...
      </div>
    )
  }

  return (
    <WorkspaceChatProvider value={chat}>
      <>
      <WorkspaceLayout
        activeActivity={activeActivity}
        onActivityChange={handleActivityChange}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sessionName={session.name}
        session={session}
        workflowState={session.workflow_state}
        streamingAgent={streamingAgent}
        isSDLCDone={isSDLCDone}
        fileTree={kb?.tree || []}
        onFileOpen={openFile}
        status={status}
        metrics={metrics}
        scanStatus={scanStatus}
                        workflowRunning={!!session.workflow_state?.includes('running')}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onApproveBA={handleApproveBA}
        onApproveSA={handleApproveSA}
        onApproveDevLead={handleApproveDevLead}
        onStop={handleStop}
        mainStageChildren={
          <>
            {activeTab === 'ide'      && <IdePanel tree={kb?.tree || []} ideFile={ideFile} ideContent={ideContent} ideLoading={ideLoading} onFileOpen={openFile} />}
            {activeTab === 'graph'    && (
              <div className="p-6 h-full flex flex-col">
                <h2 className="font-display font-extrabold text-xl mb-4" style={{ color: 'var(--green)' }}>⬡ Node Architecture Graph</h2>
                <div className="flex-1 border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                  <NodeGraph tree={kb?.tree || []} repoInfo={status?.repo ?? null} />
                </div>
              </div>
            )}
            {activeTab === 'wiki'     && <WikiPanel kb={kb} />}
            {activeTab === 'insights' && <InsightsPanel kb={kb} />}
            {activeTab === 'rag'      && <RagPanel chatHistory={chat?.chatHistory || []} />}
            {activeTab === 'sdlc'     && (
              <SdlcPanel
                session={session}
                editBA={editBA} editSA={editSA} editDevLead={editDevLead}
                        busy={chat?.busy || false}
                        workflowRunning={!!session.workflow_state?.includes('running')}
                streamingAgent={streamingAgent}
                streamingText={streamingText}
                toolCalls={toolCalls}
                onEditBA={setEditBA} onEditSA={setEditSA} onEditDevLead={setEditDevLead}
                onApproveBA={handleApproveBA} onApproveSA={handleApproveSA} onApproveDevLead={handleApproveDevLead}
                onStop={handleStop}
                onRestore={handleRestore}
              />
            )}
            {activeTab === 'backlog'  && <BacklogPanel backlog={session.jira_backlog || []} />}
            {activeTab === 'db'       && <DbPanel sessions={sessions} currentSessionId={sessionId} status={status} />}
            {activeTab === 'world'    && <WorldPanel />}
          </>
        }
        contextPanelChildren={
          <>
            {activeActivity === 'tracing' && (
              <TracingPanel metrics={metrics} onLoad={fetchMetrics} />
            )}
            {activeActivity === 'settings' && (
              <SettingsPanel status={status} onStatusRefresh={fetchStatus} />
            )}
            {activeActivity === 'chat' && (
              <SessionsPanel
                sessions={sessions}
                currentSessionId={sessionId}
                onNew={async () => {
                  const s = await api.sessions.create() as Session
                  await fetchSessions()
                  router.push(`/workspace/${s.id}`)
                }}
                onDeleteRequest={setDeleteTarget}
              />
            )}
          </>
        }
      />

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        commands={commandItems}
      />

      {/* Onboarding */}
      {onboardingState === 'asking' && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)' }}>
          <div className="rounded-2xl border w-full max-w-sm mx-4 overflow-hidden"
            style={{ background: 'var(--bg-1)', borderColor: 'var(--border)', boxShadow: '0 32px 80px rgba(0,0,0,.6)' }}>
            <div className="px-6 pt-6 pb-4">
              <div className="text-3xl mb-3">👋</div>
              <p className="font-display font-extrabold text-xl mb-1" style={{ color: 'var(--green)' }}>Welcome to YUMMY</p>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>Is this your first time here?</p>
            </div>
            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={() => setOnboardingState('wizard')}
                className="flex-1 py-2.5 rounded-lg font-bold text-sm cursor-pointer"
                style={{ background: 'var(--green-mute)', color: 'var(--green)', border: '1px solid var(--green-dim)' }}>
                Yes, show me around
              </button>
              <button
                onClick={() => { localStorage.setItem('yummy_onboarding', 'done'); setOnboardingState('dismissed') }}
                className="flex-1 py-2.5 rounded-lg font-bold text-sm cursor-pointer"
                style={{ background: 'var(--bg-2)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                No, I know what I'm doing
              </button>
            </div>
          </div>
        </div>
      )}

      {onboardingState === 'wizard' && (
        <OnboardingWizard
          status={status}
          onComplete={() => {
            localStorage.setItem('yummy_onboarding', 'done')
            setOnboardingState('dismissed')
            fetchStatus()
          }}
          onScanStart={() => {
            setScanStatus({ running: true, text: 'Starting scan...', progress: 0 })
            chatRef.current?.chatRef.current?.print('🔍 Starting codebase scan...')
            setActiveTab('ide')
            startScanPoll()
          }}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setDeleteTarget(null)}>
          <div className="border rounded-xl" onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-1)', borderColor: '#ff664455', padding: '1.75rem 2rem', width: 360, boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
            <div className="flex items-center gap-2.5 mb-4">
              <Trash2 size={22} style={{ color: '#ff6644' }} />
              <span className="font-display font-extrabold text-lg" style={{ color: '#ff6644' }}>Delete Session</span>
            </div>
            <p className="text-base leading-relaxed mb-2" style={{ color: 'var(--text-2)' }}>
              Are you sure you want to delete this workspace?
            </p>
            <p className="text-sm border rounded px-3 py-2 mb-6 font-mono truncate"
              style={{ color: 'var(--text-3)', background: 'var(--bg)', borderColor: 'var(--border)' }}>
              {deleteTarget.name}
            </p>
            <p className="text-xs mb-6" style={{ color: 'rgba(255,100,68,.7)' }}>This action cannot be undone.</p>
            <div className="flex gap-2.5 justify-end">
              <button onClick={() => setDeleteTarget(null)}
                className="border rounded-lg cursor-pointer font-mono text-base"
                style={{ padding: '.5rem 1.2rem', background: 'none', borderColor: 'var(--border)', color: 'var(--text-2)' }}>
                Cancel
              </button>
              <button
                onClick={async () => { const t = deleteTarget; setDeleteTarget(null); await deleteSession(t.id) }}
                className="border-none rounded-lg cursor-pointer font-mono text-base font-bold"
                style={{ padding: '.5rem 1.2rem', background: '#ff6644', color: '#fff' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[300] border rounded-lg flex items-center gap-2 font-mono text-base"
          style={{ background: 'var(--bg-1)', borderColor: 'var(--green-dim)', padding: '.65rem 1.1rem', color: 'var(--green)', boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>
          {toast}
        </div>
      )}

      {/* Global prose styles */}
      <style>{`
        .prose { font-family: var(--font-mono); font-size: .85rem; line-height: 1.7; color: var(--text); }
        .prose h1,.prose h2,.prose h3 { font-family: var(--font-display); }
        .prose code { background: var(--bg-2); border: 1px solid var(--border); color: var(--amber); padding: .1rem .3rem; border-radius: 3px; font-size: .8rem; }
        .prose pre { background: var(--bg-1) !important; }
        .prose ul { padding-left: 1.2rem; }
        .prose li { margin-bottom: .2rem; }
        .prose table { border-collapse: collapse; width: 100%; margin: .75rem 0; font-size: .8rem; }
        .prose th,.prose td { border: 1px solid var(--border); padding: .4rem .65rem; }
        .prose th { background: var(--bg-2); color: var(--text-2); }
      `}</style>
      </>
    </WorkspaceChatProvider>
  )
}
