import type { MutableRefObject } from 'react'
import type { SdlcEvent } from '@/lib/api'
import type { ThemeId } from '@/lib/theme'
import type {
  ChatMessage,
  KnowledgeBase,
  MetricsData,
  ScanStatus,
  Session,
  SystemStatus,
  WorkflowState,
} from '@/lib/types'

export interface TerminalLogEntry {
  role: string
  text: string
}

export interface WorkspaceSessionContext {
  sessionId: string
  session: Session | null
  sessions: Session[]
  metrics: MetricsData | null
  loading: boolean
  error: string | null
  fetchSession: () => Promise<void>
  fetchSessions: () => Promise<void>
  fetchMetrics: () => Promise<void>
  deleteSession: (targetId: string) => Promise<void>
}

export interface WorkspaceStatusContext {
  status: SystemStatus | null
  kb: KnowledgeBase | null
  scanStatus: ScanStatus | null
  loading: boolean
  error: string | null
  fetchStatus: () => Promise<void>
  fetchKb: () => Promise<void>
  startScanPoll: () => void
  stopScanPoll: () => void
  setScanStatus: (status: ScanStatus | null) => void
}

export interface WorkspaceChatContext {
  chatHistory: ChatMessage[]
  termLogs: TerminalLogEntry[]
  termRef: MutableRefObject<HTMLDivElement | null>
  busy: boolean
  btwBusy: boolean
  sendAsk: (question: string, free?: boolean) => Promise<void>
  sendBtw: (question: string) => Promise<void>
  print: (text: string, role?: string) => void
  handleCmd: (rawInput: string) => Promise<void>
  setBusy: React.Dispatch<React.SetStateAction<boolean>>
  setBtwBusy: React.Dispatch<React.SetStateAction<boolean>>
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>
}

export interface WorkspaceSdlcToolCallEntry {
  server: string
  tool: string
  args: Record<string, unknown>
  result?: { content: unknown; is_error: boolean }
}

export interface WorkspaceSdlcState {
  workflowState: WorkflowState
  editBA: string
  editSA: string
  editDevLead: string
  streamingAgent: string | null
  streamingText: string
  toolCalls: Record<string, WorkspaceSdlcToolCallEntry[]>
}

export interface WorkspaceSdlcContext {
  sdlcState: WorkspaceSdlcState
  busy: boolean
  workflowRunning: boolean
  runSdlcStream: (gen: AsyncGenerator<SdlcEvent>) => Promise<boolean>
  abort: () => Promise<void>
  refreshSDLC: () => Promise<void>
  approveBA: () => Promise<void>
  approveSA: () => Promise<void>
  approveDevLead: () => Promise<void>
  restore: (checkpoint: 'ba' | 'sa' | 'dev_lead') => Promise<void>
}

export interface WorkspaceUiPreferences {
  onboardingState: 'asking' | 'wizard' | 'dismissed'
  commandPaletteOpen: boolean
}

export interface WorkspaceUiContext {
  theme: ThemeId
  uiSize: number
  preferences: WorkspaceUiPreferences
  setTheme: (theme: ThemeId) => void
  setUiSize: (index: number) => void
  setCommandPaletteOpen: (open: boolean) => void
  setOnboardingState: (state: WorkspaceUiPreferences['onboardingState']) => void
}
