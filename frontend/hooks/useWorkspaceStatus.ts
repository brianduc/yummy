import { useState, useCallback, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { useScanPoll } from '@/hooks/useScanPoll'
import type { KnowledgeBase, ScanStatus, SystemStatus } from '@/lib/types'

interface UseWorkspaceStatusOptions {
  onScanMessage?: (text: string) => void
  onScanComplete?: () => void
}

export function useWorkspaceStatus(options?: UseWorkspaceStatusOptions) {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [kb, setKb] = useState<KnowledgeBase | null>(null)
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      setStatus(await api.config.status() as SystemStatus)
      setError(null)
    } catch {
    }
  }, [])

  const fetchKb = useCallback(async () => {
    try {
      setKb(await api.kb.get() as KnowledgeBase)
    } catch {
    }
  }, [])

  const { startScanPoll, stopScanPoll } = useScanPoll({
    onStatusUpdate: setScanStatus,
    onMessage: options?.onScanMessage ?? (() => undefined),
    onComplete: async () => {
      await fetchKb()
      await fetchStatus()
      options?.onScanComplete?.()
    },
  })

  const stopScanPollRef = useRef<() => void>(() => undefined)
  stopScanPollRef.current = stopScanPoll

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchStatus(), fetchKb()]).finally(() => {
      if (!cancelled) setLoading(false)
    })
    const iv = setInterval(() => fetchStatus(), 4000)
    return () => {
      cancelled = true
      clearInterval(iv)
      stopScanPollRef.current()
    }
  }, [fetchStatus, fetchKb])

  return {
    status,
    kb,
    scanStatus,
    loading,
    error,
    fetchStatus,
    fetchKb,
    startScanPoll,
    stopScanPoll,
    setScanStatus,
  }
}
