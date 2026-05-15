import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { Session, MetricsData } from '@/lib/types'

export function useWorkspaceSession(sessionId: string) {
  const router = useRouter()
  const routerRef = useRef(router)
  routerRef.current = router
  const [session, setSession] = useState<Session | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  const fetchSession = useCallback(async () => {
    try {
      const s = await api.sessions.get(sessionId) as Session
      if (!cancelledRef.current) {
        setSession(s)
        setError(null)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg?.includes('404')) {
        if (!cancelledRef.current) setError('Session not found')
        try {
          const fresh = await api.sessions.create() as Session
          if (!cancelledRef.current) routerRef.current.replace(`/workspace/${fresh.id}`)
        } catch {
        }
      } else {
        if (!cancelledRef.current) setError(msg)
      }
    }
  }, [sessionId])

  const fetchSessions = useCallback(async () => {
    try {
      const list = await api.sessions.list() as Session[]
      if (!cancelledRef.current) setSessions(list)
    } catch {
    }
  }, [])

  const fetchMetrics = useCallback(async () => {
    try {
      const m = await api.metrics() as MetricsData
      if (!cancelledRef.current) setMetrics(m)
    } catch {
    }
  }, [])

  const deleteSession = useCallback(async (targetId: string) => {
    await api.sessions.delete(targetId)
    await fetchSessions()
    if (targetId === sessionId) {
      const fresh = await api.sessions.create() as Session
      await fetchSessions()
      routerRef.current.replace(`/workspace/${fresh.id}`)
    }
  }, [sessionId, fetchSessions])

  useEffect(() => {
    cancelledRef.current = false
    setLoading(true)
    Promise.all([fetchSession(), fetchSessions()]).finally(() => {
      if (!cancelledRef.current) setLoading(false)
    })
    return () => {
      cancelledRef.current = true
    }
  }, [sessionId, fetchSession, fetchSessions])

  return {
    sessionId,
    session,
    sessions,
    metrics,
    loading,
    error,
    fetchSession,
    fetchSessions,
    fetchMetrics,
    deleteSession,
  }
}
