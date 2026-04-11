'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { MetricsData } from '@/lib/types'

export default function MetricsPanel() {
  const [data, setData] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetch = async () => {
    setLoading(true)
    try {
      const d = await api.metrics() as MetricsData
      setData(d)
    } catch { } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch() }, [])

  if (!data) return (
    <div className="flex items-center justify-center h-full text-text-3 text-[0.8rem]">
      {loading ? 'Loading...' : 'No metrics yet'}
    </div>
  )

  const agentEntries = Object.entries(data.agent_breakdown || {})

  return (
    <div className="flex flex-col h-full">

      {/* Top stats */}
      <div className="grid grid-cols-3 border-b border-border">
        {[
          { label: 'Requests', value: data.total_requests },
          { label: 'Cost (USD)', value: `$${data.total_cost_usd.toFixed(5)}` },
          { label: 'Agents', value: agentEntries.length },
        ].map(({ label, value }) => (
          <div key={label} className="p-3 text-center border-r border-border">
            <div className="text-xl text-green font-bold font-display">
              {value}
            </div>
            <div className="text-[0.68rem] text-text-3 uppercase tracking-[0.06em]">
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Agent breakdown */}
      {agentEntries.length > 0 && (
        <div className="p-3 border-b border-border">
          <div className="text-[0.68rem] text-text-3 uppercase tracking-[0.06em] mb-2">
            Agent Breakdown
          </div>
          <div className="flex flex-col gap-[0.3rem]">
            {agentEntries.map(([agent, stats]) => (
              <div key={agent} className="flex items-center gap-2 text-[0.75rem]">
                <span className="text-green w-20 flex-shrink-0">{agent}</span>
                <div className="flex-1 h-1 bg-bg-3 rounded-[2px] overflow-hidden">
                  <div style={{ width: `${Math.min(100, (stats.calls / data.total_requests) * 100)}%` }}
                    className="h-full bg-green shadow-[0_0_4px_rgba(0,255,136,0.4)]" />
                </div>
                <span className="text-text-2 w-10 text-right">{stats.calls}x</span>
                <span className="text-text-3 w-[60px] text-right">${stats.cost.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request log */}
      <div className="flex-1 overflow-auto">
        <div className="grid gap-0 border-b border-border px-2 py-[0.3rem] text-2xs text-text-3 uppercase tracking-[0.04em] sticky top-0 bg-bg-1"
          style={{ gridTemplateColumns: '50px 60px 80px 55px 55px 55px 65px' }}>
          <span>#</span><span>Time</span><span>Agent</span><span>In</span><span>Out</span><span>Lat</span><span>Cost</span>
        </div>
        {data.logs.map((log, i) => (
          <div key={log.id}
            className={`grid gap-0 px-2 py-[0.3rem] text-xs border-b border-border items-center ${i % 2 === 0 ? 'bg-transparent' : 'bg-bg-1'}`}
            style={{ gridTemplateColumns: '50px 60px 80px 55px 55px 55px 65px' }}>
            <span className="text-text-3">{i + 1}</span>
            <span className="text-text-2">{log.time}</span>
            <span className="text-green overflow-hidden text-ellipsis whitespace-nowrap">{log.agent}</span>
            <span className="text-text-2">{(log.in_tokens / 1000).toFixed(1)}k</span>
            <span className="text-text-2">{(log.out_tokens / 1000).toFixed(1)}k</span>
            <span className="text-text-2">{log.latency}s</span>
            <span className={log.cost > 0.001 ? 'text-amber' : 'text-text-3'}>${log.cost.toFixed(4)}</span>
          </div>
        ))}
      </div>

      <div className="p-2 flex justify-end border-t border-border">
        <button className="btn btn-ghost text-xs" onClick={fetch}>
          ⟳ Refresh
        </button>
      </div>
    </div>
  )
}
