'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useScanPoll } from '@/hooks/useScanPoll'
import { useChat } from '@/hooks/useWorkspaceChat'
import { useWorkspaceSdlc } from '@/hooks/useWorkspaceSdlc'
import { loadSavedTheme } from '@/lib/theme'
import { loadSavedUiSize } from '@/lib/uiSize'

import type { ActivityId } from '@/components/workspace/ActivityBar'
import MainStage, { type MainTabId } from '@/components/workspace/MainStage'
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
  ScanStatus, MetricsData,
} from '@/lib/types'

export default function WorkspacePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = React.use(params)
  const router = useRouter()

  const [activeActivity, setActiveActivity] = useState<ActivityId>('explorer')
  const [activeTab, setActiveTab] = useState<MainTabId>('ide')
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const chat = useChat()

  // Server data
  const [session,  setSession]  = useState<Session | null>(null)
  const [status,   setStatus]   = useState<SystemStatus | null>(null)
  const [kb,       setKb]       = useState<KnowledgeBase | null>(null)
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null)
  const [metrics,  setMetrics]  = useState<MetricsData | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])

  // IDE
  const [ideFile,    setIdeFile]    = useState('')
  const [ideContent, setIdeContent] = useState('')
  const [ideLoading, setIdeLoading] = useState(false)

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

  // Scan polling
  const { startScanPoll } = useScanPoll({
    onStatusUpdate: setScanStatus,
    onMessage: chat.print,
    onComplete: async () => {
      await fetchKb(); await fetchStatus()
      chat.print('✅ Scan complete.')
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
      chat.setChatHistory(session.chat_history || [])
    }
  }, [session, chat])

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

  // RAG ask (streaming)
  // Session delete
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

  const sdlc = useWorkspaceSdlc(sessionId, {
    session,
    setSession,
    print: chat.print,
    setBusy: chat.setBusy,
  })
  const { sdlcState } = sdlc



  // Command palette commands
  const commandItems = createDefaultCommands({
    onScan: () => {
      if (status?.repo) {
        chat.handleCmd('/scan')
      } else {
        chat.print('No repo configured. Use /setup <github-url> to configure.')
      }
    },
    onNewSession: () => chat.handleCmd('/new'),
    onNavigateSettings: () => router.push(`/workspace/${sessionId}/settings`),
    onNavigateTracing: () => router.push(`/workspace/${sessionId}/tracing`),
    onShowInfo: () => chat.handleCmd('/info'),
    onHealthcheck: () => chat.handleCmd('/healthcheck'),
    onStartSDLC: () => {
      chat.print('Use /cr <requirement> in the chat to start the SDLC pipeline.')
    },
  })

  // Derived state
  const isSDLCDone = session?.workflow_state === 'done'

  if (!session) {
    return (
      <div className="h-screen flex items-center justify-center font-mono text-sm" style={{ color: 'var(--text-3)' }}>
        <span style={{ color: 'var(--green)' }}>▊</span>&nbsp;Loading workspace...
      </div>
    )
  }

  return (
    <>
      <MainStage
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sessionName={session.name}
        session={session}
        workflowState={session.workflow_state}
        streamingAgent={sdlcState.streamingAgent}
        isSDLCDone={isSDLCDone}
        workflowRunning={!!session.workflow_state?.includes('running')}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onApproveBA={sdlc.approveBA}
        onApproveSA={sdlc.approveSA}
        onApproveDevLead={sdlc.approveDevLead}
        onStop={sdlc.abort}
      >
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
                editBA={sdlcState.editBA} editSA={sdlcState.editSA} editDevLead={sdlcState.editDevLead}
                        busy={chat?.busy || false}
                        workflowRunning={!!session.workflow_state?.includes('running')}
                streamingAgent={sdlcState.streamingAgent}
                streamingText={sdlcState.streamingText}
                toolCalls={sdlcState.toolCalls}
                onEditBA={sdlc.setEditBA} onEditSA={sdlc.setEditSA} onEditDevLead={sdlc.setEditDevLead}
                onApproveBA={sdlc.approveBA} onApproveSA={sdlc.approveSA} onApproveDevLead={sdlc.approveDevLead}
                onStop={sdlc.abort}
                onRestore={sdlc.restore}
              />
            )}
            {activeTab === 'backlog'  && <BacklogPanel backlog={session.jira_backlog || []} />}
            {activeTab === 'db'       && <DbPanel sessions={sessions} currentSessionId={sessionId} status={status} />}
            {activeTab === 'world'    && <WorldPanel />}
          </>
      </MainStage>

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
            chat.print('🔍 Starting codebase scan...')
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
  )
}
