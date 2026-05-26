'use client'
import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FolderTree, BookOpen, Zap, History, Columns2, Globe, Network } from 'lucide-react'
import { useWorkspaceSession } from '@/hooks/useWorkspaceSession'
import { useWorkspaceStatus } from '@/hooks/useWorkspaceStatus'
import { useChat } from '@/hooks/useWorkspaceChat'
import { loadSavedTheme } from '@/lib/theme'
import { loadSavedUiSize } from '@/lib/uiSize'
import OnboardingWizard from '@/components/workspace/OnboardingWizard'

export default function WorkspaceDashboard({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = React.use(params)
  const router = useRouter()
  const chat = useChat()

  const { session } = useWorkspaceSession(sessionId)
  const { status, kb, scanStatus, fetchStatus, fetchKb, setScanStatus, startScanPoll } = useWorkspaceStatus({
    onScanMessage: chat.print,
    onScanComplete: async () => {
      await fetchKb()
      await fetchStatus()
      chat.print('✅ Scan complete.')
      router.push(`/workspace/${sessionId}/wiki`)
    }
  })

  // UI helpers
  const [onboardingState, setOnboardingState] = useState<'asking' | 'wizard' | 'dismissed'>(() => {
    if (typeof window === 'undefined') return 'dismissed'
    const stored = localStorage.getItem('yummy_onboarding')
    if (stored === 'done') return 'dismissed'
    return 'asking'
  })

  // Bootstrap
  useEffect(() => {
    loadSavedTheme()
    loadSavedUiSize()
  }, [])

  const prevId = useRef('')
  useEffect(() => {
    if (session && session.id !== prevId.current) {
      prevId.current = session.id
      chat.setChatHistory(session.chat_history || [])
    }
  }, [session, chat])

  if (!session) {
    return (
      <div className="h-screen flex items-center justify-center font-mono text-sm" style={{ color: 'var(--text-3)' }}>
        <span style={{ color: 'var(--green)' }}>▊</span>&nbsp;Loading workspace...
      </div>
    )
  }

  const { chatHistory } = chat

  return (
    <>
      <div data-testid="dashboard-page" className="h-full overflow-auto p-6 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display font-extrabold text-2xl md:text-3xl" style={{ color: 'var(--green)' }}>
            YUMMY Dashboard
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>
            {session?.name ?? 'Workspace'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {/* Repo */}
          <div className="rounded-lg border p-4" style={{ background: 'var(--bg-1)', borderColor: 'var(--border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Repository</p>
            <p className="font-mono text-sm font-bold truncate" style={{ color: 'var(--text)' }} data-testid="dashboard-stat-repo">
              {status?.repo ? `${status.repo.owner}/${status.repo.repo}` : 'No repo'}
            </p>
          </div>
          {/* Files */}
          <div className="rounded-lg border p-4" style={{ background: 'var(--bg-1)', borderColor: 'var(--border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Files</p>
            <p className="font-mono text-lg font-bold" style={{ color: 'var(--green)' }} data-testid="dashboard-stat-files">
              {kb?.tree?.length ?? 0}
            </p>
          </div>
          {/* Scan */}
          <div className="rounded-lg border p-4" style={{ background: 'var(--bg-1)', borderColor: 'var(--border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Scan</p>
            <p className="font-mono text-sm font-bold" style={{ color: scanStatus?.running ? 'var(--amber)' : 'var(--text)' }} data-testid="dashboard-stat-scan">
              {scanStatus?.running ? 'Scanning...' : scanStatus?.text ? 'Complete' : 'Not started'}
            </p>
          </div>
          {/* SDLC */}
          <div className="rounded-lg border p-4" style={{ background: 'var(--bg-1)', borderColor: 'var(--border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>SDLC</p>
            <p className="font-mono text-sm font-bold" style={{ color: 'var(--text)' }} data-testid="dashboard-stat-sdlc">
              {session?.workflow_state ?? 'No pipeline'}
            </p>
          </div>
          {/* Chats */}
          <div className="rounded-lg border p-4" style={{ background: 'var(--bg-1)', borderColor: 'var(--border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Chats</p>
            <p className="font-mono text-lg font-bold" style={{ color: 'var(--green)' }} data-testid="dashboard-stat-chats">
              {chatHistory?.length ?? 0}
            </p>
          </div>
        </div>

        {/* Navigation Cards */}
        <h2 className="font-display font-extrabold text-lg mb-4" style={{ color: 'var(--text-2)' }}>Tools</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { route: 'explorer', icon: FolderTree, label: 'Explorer', color: 'var(--green)' },
            { route: 'graph', icon: Network, label: 'Graph', color: '#00aaff' },
            { route: 'wiki', icon: BookOpen, label: 'Wiki', color: 'var(--green)' },
            { route: 'insight', icon: Zap, label: 'Insight', color: 'var(--amber)' },
            { route: 'history', icon: History, label: 'History', color: 'var(--text-2)' },
            { route: 'jira', icon: Columns2, label: 'Jira', color: '#ff6644' },
            { route: 'world', icon: Globe, label: 'World', color: '#00ccaa' },
          ].map(({ route, icon: Icon, label, color }) => (
            <Link key={route} href={`/workspace/${sessionId}/${route}`} data-testid={`dashboard-card-${route}`}
              className="rounded-lg border p-4 flex flex-col items-center gap-2 hover:border-[var(--green-dim)] transition-colors cursor-pointer text-center no-underline"
              style={{ background: 'var(--bg-1)', borderColor: 'var(--border)' }}>
              <Icon size={24} style={{ color }} />
              <span className="font-mono text-xs font-bold" style={{ color: 'var(--text)' }}>{label}</span>
            </Link>
          ))}
        </div>
      </div>

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
            startScanPoll()
          }}
        />
      )}
    </>
  )
}
