import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, type SdlcEvent } from '@/lib/api'
import type { Session, WorkflowState } from '@/lib/types'
import type { WorkspaceSdlcContext, WorkspaceSdlcToolCallEntry } from './useWorkspaceContracts'

interface UseWorkspaceSdlcOptions {
  session: Session | null
  setSession: (fn: (prev: Session | null) => Session | null) => void
  print?: (text: string, role?: string) => void
  setBusy?: (busy: boolean) => void
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function useWorkspaceSdlc(
  sessionId: string,
  { session, setSession, print, setBusy }: UseWorkspaceSdlcOptions,
): WorkspaceSdlcContext & {
  setEditBA: (value: string) => void
  setEditSA: (value: string) => void
  setEditDevLead: (value: string) => void
} {
  const [editBA, setEditBA] = useState('')
  const [editSA, setEditSA] = useState('')
  const [editDevLead, setEditDevLead] = useState('')
  const [streamingAgent, setStreamingAgent] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [toolCalls, setToolCalls] = useState<Record<string, WorkspaceSdlcToolCallEntry[]>>({})
  const [busy, setLocalBusy] = useState(false)

  const abortControllerRef = useRef(new AbortController())
  const activeGeneratorRef = useRef<AsyncGenerator<SdlcEvent> | null>(null)
  const isMountedRef = useRef(true)
  const streamingAgentRef = useRef<string | null>(null)

  const safeSetStreamingAgent = useCallback((agent: string | null) => {
    streamingAgentRef.current = agent
    if (isMountedRef.current) setStreamingAgent(agent)
  }, [])

  const safeSetBusy = useCallback((nextBusy: boolean) => {
    if (isMountedRef.current) setLocalBusy(nextBusy)
    setBusy?.(nextBusy)
  }, [setBusy])

  const refreshSDLC = useCallback(async () => {
    try {
      const update = await api.sdlc.state(sessionId) as Partial<Session> & {
        workflow_state?: WorkflowState
      }
      if (!isMountedRef.current) return
      setSession(prev => prev ? {
        ...prev,
        workflow_state: update.workflow_state ?? prev.workflow_state,
        agent_outputs: update.agent_outputs ?? prev.agent_outputs,
        jira_backlog: update.jira_backlog ?? prev.jira_backlog,
      } : prev)
      if (update.agent_outputs?.ba) setEditBA(update.agent_outputs.ba)
      if (update.agent_outputs?.sa) setEditSA(update.agent_outputs.sa)
      if (update.agent_outputs?.dev_lead) setEditDevLead(update.agent_outputs.dev_lead)
    } catch {
      // State refresh is best-effort; callers surface user-facing failures.
    }
  }, [sessionId, setSession])

  const runSdlcStream = useCallback(async (gen: AsyncGenerator<SdlcEvent>): Promise<boolean> => {
    if (!isMountedRef.current) return false
    abortControllerRef.current = new AbortController()
    activeGeneratorRef.current = gen
    safeSetBusy(true)
    safeSetStreamingAgent(null)
    setStreamingText('')

    let currentAgent: string | null = null
    let accumulated = ''
    let wasStopped = false
    let flushTimer: ReturnType<typeof setTimeout> | null = null

    const clearFlush = () => {
      if (flushTimer) {
        clearTimeout(flushTimer)
        flushTimer = null
      }
    }
    const flushText = () => {
      if (isMountedRef.current) setStreamingText(accumulated)
    }
    const scheduleFlush = () => {
      if (flushTimer) return
      flushTimer = setTimeout(() => {
        flushTimer = null
        flushText()
      }, 60)
    }

    try {
      for await (const event of gen) {
        if (!isMountedRef.current || abortControllerRef.current.signal.aborted) break

        if (event.t === 'start') {
          clearFlush()
          currentAgent = event.agent
          accumulated = ''
          safeSetStreamingAgent(event.agent)
          setStreamingText('')
          setToolCalls(prev => ({ ...prev, [event.agent]: [] }))
        } else if (event.t === 'c') {
          accumulated += event.text
          scheduleFlush()
        } else if (event.t === 'agent_done') {
          clearFlush()
          const key = currentAgent ?? event.agent
          const text = accumulated
          if (key) {
            setSession(prev => prev ? {
              ...prev,
              agent_outputs: { ...prev.agent_outputs, [key]: text },
            } : prev)
          }
          accumulated = ''
          setStreamingText('')
        } else if (event.t === 'done') {
          clearFlush()
          const agentOutputs = event.agent_outputs as Session['agent_outputs']
          setSession(prev => prev ? {
            ...prev,
            workflow_state: event.state as WorkflowState,
            agent_outputs: agentOutputs,
            jira_backlog: event.jira_backlog as Session['jira_backlog'],
          } : prev)
          if (agentOutputs?.ba) setEditBA(agentOutputs.ba)
          if (agentOutputs?.sa) setEditSA(agentOutputs.sa)
          if (agentOutputs?.dev_lead) setEditDevLead(agentOutputs.dev_lead)
        } else if (event.t === 'stopped') {
          clearFlush()
          wasStopped = true
          await refreshSDLC()
        } else if (event.t === 'error') {
          clearFlush()
          print?.(`❌ ${event.message}`)
        } else if (event.t === 'tool_call') {
          const agent = streamingAgentRef.current ?? currentAgent ?? 'unknown'
          setToolCalls(prev => ({
            ...prev,
            [agent]: [...(prev[agent] ?? []), { server: event.server, tool: event.tool, args: event.args }],
          }))
        } else if (event.t === 'tool_result') {
          const agent = streamingAgentRef.current ?? currentAgent ?? 'unknown'
          setToolCalls(prev => {
            const entries = [...(prev[agent] ?? [])]
            const last = entries[entries.length - 1]
            if (last) {
              entries[entries.length - 1] = {
                ...last,
                result: { content: event.content, is_error: event.is_error },
              }
            }
            return { ...prev, [agent]: entries }
          })
        }
      }
    } catch (error) {
      if (!isAbortError(error)) print?.(`❌ ${(error as Error).message}`)
    } finally {
      clearFlush()
      activeGeneratorRef.current = null
      if (isMountedRef.current) {
        safeSetStreamingAgent(null)
        setStreamingText('')
        safeSetBusy(false)
      }
    }

    return wasStopped
  }, [print, refreshSDLC, safeSetBusy, safeSetStreamingAgent, setSession])

  const abort = useCallback(async () => {
    abortControllerRef.current.abort()
    const generator = activeGeneratorRef.current
    activeGeneratorRef.current = null
    try {
      await api.sdlc.stop(sessionId)
      print?.('⏹ Pipeline stopped.')
      await refreshSDLC()
    } catch (error) {
      print?.(`❌ Stop failed: ${(error as Error).message}`)
    } finally {
      if (generator?.return) void generator.return(undefined)
      if (isMountedRef.current) {
        safeSetStreamingAgent(null)
        setStreamingText('')
        safeSetBusy(false)
      }
    }
  }, [print, refreshSDLC, safeSetBusy, safeSetStreamingAgent, sessionId])

  const approveBA = useCallback(async () => {
    setSession(prev => prev ? { ...prev, workflow_state: 'running_sa' } : prev)
    print?.('📧 BA approved. Running SA...')
    const stopped = await runSdlcStream(api.sdlc.approveBaStream(sessionId, editBA))
    if (!stopped) print?.('⚠️ SA done. Waiting for approval...')
  }, [editBA, print, runSdlcStream, sessionId, setSession])

  const approveSA = useCallback(async () => {
    setSession(prev => prev ? { ...prev, workflow_state: 'running_dev_lead' } : prev)
    print?.('📧 SA approved. Running Dev Lead...')
    const stopped = await runSdlcStream(api.sdlc.approveSaStream(sessionId, editSA))
    if (!stopped) print?.('⚠️ Dev Lead done. Waiting for approval...')
  }, [editSA, print, runSdlcStream, sessionId, setSession])

  const approveDevLead = useCallback(async () => {
    setSession(prev => prev ? { ...prev, workflow_state: 'running_rest' } : prev)
    print?.('📧 Dev Lead approved. Running DEV/SEC/QA/SRE...')
    const stopped = await runSdlcStream(api.sdlc.approveDevLeadStream(sessionId, editDevLead))
    if (!stopped) print?.('🎉 Pipeline complete!')
  }, [editDevLead, print, runSdlcStream, sessionId, setSession])

  const restore = useCallback(async (checkpoint: 'ba' | 'sa' | 'dev_lead') => {
    const labels: Record<typeof checkpoint, string> = { ba: 'BA', sa: 'SA', dev_lead: 'Dev Lead' }
    safeSetBusy(true)
    try {
      await api.sdlc.restore(sessionId, checkpoint)
      print?.(`↩ Restored to ${labels[checkpoint]} checkpoint. Review and approve to continue.`)
      await refreshSDLC()
    } catch (error) {
      print?.(`❌ Restore failed: ${(error as Error).message}`)
    } finally {
      if (isMountedRef.current) safeSetBusy(false)
    }
  }, [print, refreshSDLC, safeSetBusy, sessionId])

  useEffect(() => {
    if (session?.agent_outputs?.ba) setEditBA(session.agent_outputs.ba)
    if (session?.agent_outputs?.sa) setEditSA(session.agent_outputs.sa)
    if (session?.agent_outputs?.dev_lead) setEditDevLead(session.agent_outputs.dev_lead)
  }, [session?.id, session?.agent_outputs?.ba, session?.agent_outputs?.sa, session?.agent_outputs?.dev_lead])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      abortControllerRef.current.abort()
      void activeGeneratorRef.current?.return?.(undefined)
      activeGeneratorRef.current = null
    }
  }, [])

  return useMemo(() => ({
    sdlcState: {
      workflowState: session?.workflow_state ?? 'idle',
      editBA,
      editSA,
      editDevLead,
      streamingAgent,
      streamingText,
      toolCalls,
    },
    busy,
    workflowRunning: !!session?.workflow_state?.includes('running'),
    runSdlcStream,
    abort,
    refreshSDLC,
    approveBA,
    approveSA,
    approveDevLead,
    restore,
    setEditBA,
    setEditSA,
    setEditDevLead,
  }), [
    abort,
    approveBA,
    approveDevLead,
    approveSA,
    busy,
    editBA,
    editDevLead,
    editSA,
    refreshSDLC,
    restore,
    runSdlcStream,
    session?.workflow_state,
    streamingAgent,
    streamingText,
    toolCalls,
  ])
}
