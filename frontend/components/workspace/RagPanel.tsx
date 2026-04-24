'use client'

import React from 'react'
import { mdToHtml } from '@/lib/mdToHtml'
import type { ChatMessage, RAGTrace } from '@/lib/types'

interface RagPanelProps {
  chatHistory: ChatMessage[]
}

/**
 * Map the backend `retrieval_method` to a (label, colorVar) pair.
 *
 * Color semantics — used by the badge so users can see RAG health at a glance:
 *   - GREEN  → at least 2 retrieval legs contributed (real hybrid recall)
 *   - AMBER  → only 1 leg fired (degraded but still grounded in the index)
 *   - RED    → no chunks at all; the answer is built from kb-insights only
 *              (legacy summary fallback — quality is materially worse and
 *              the user MUST know so they can re-scan or fix code-intel)
 *
 * Keep this as a pure function so it's trivially unit-testable and
 * leaves the JSX readable.
 */
function badgeFor(method: string): { label: string; color: string; tooltip: string } {
  switch (method) {
    case 'rag-hybrid':
      return {
        label: 'RAG · hybrid',
        color: 'var(--green, #22c55e)',
        tooltip: 'Two or more retrieval legs (vector / lexical / path) returned hits — best recall.',
      }
    case 'rag-vector-only':
      return {
        label: 'RAG · vector-only',
        color: 'var(--amber, #f59e0b)',
        tooltip: 'Only the embedding leg returned hits. Lexical/path legs were unavailable or empty — recall may be lower for literal-token queries.',
      }
    case 'rag-lexical-only':
      return {
        label: 'RAG · lexical-only',
        color: 'var(--amber, #f59e0b)',
        tooltip: 'Only the LadybugDB FTS leg returned hits. Embedding leg likely failed (check OpenAI key).',
      }
    case 'rag-path-only':
      return {
        label: 'RAG · path-only',
        color: 'var(--amber, #f59e0b)',
        tooltip: 'Only the path/literal leg returned hits. Embeddings may be empty (re-index) and FTS unavailable.',
      }
    case 'rag-degraded':
      return {
        label: 'RAG · degraded',
        color: 'var(--amber, #f59e0b)',
        tooltip: 'All legs ran but returned no chunks. Falling through to kb-insights would be safer — file an issue.',
      }
    case 'kb-insights-fallback':
    default:
      return {
        label: 'kb-insights only',
        color: 'var(--red, #ef4444)',
        tooltip: 'Code-intel index is empty or unavailable. The model is answering from cached project summary + insights only — re-run the scan, then check Settings → scan status for the RAG health indicator.',
      }
  }
}

/**
 * Per-leg pill row inside the expanded trace. Renders one chip per leg
 * with hit count + ok/err status. We intentionally show ALL three legs
 * even when zero — it makes "vector-only because lexical errored" obvious
 * at a glance.
 */
function LegPills({ rt }: { rt: RAGTrace['retrieval_trace'] }) {
  if (!rt) return null
  const legs: Array<{ name: string; hits: number; ok: boolean; err?: string }> = [
    { name: 'vector', hits: rt.vectorHits, ok: rt.vectorOk, err: rt.vectorError },
    { name: 'lexical', hits: rt.lexicalHits, ok: rt.lexicalOk, err: rt.lexicalError },
    { name: 'path', hits: rt.pathHits, ok: rt.pathOk, err: rt.pathError },
  ]
  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {legs.map((l) => {
        const color = !l.ok ? 'var(--red, #ef4444)' : l.hits > 0 ? 'var(--green, #22c55e)' : 'var(--text-3)'
        return (
          <span
            key={l.name}
            title={l.err ? `${l.name} errored: ${l.err}` : `${l.name}: ${l.hits} hits`}
            className="text-2xs px-1.5 py-0.5 rounded border"
            style={{ borderColor: color, color }}
          >
            {l.name}: {l.ok ? l.hits : 'err'}
          </span>
        )
      })}
      <span
        className="text-2xs px-1.5 py-0.5 rounded border"
        style={{ borderColor: 'var(--text-3)', color: 'var(--text-3)' }}
        title="Unique chunks considered before RRF fusion"
      >
        candidates: {rt.candidateCount}
      </span>
    </div>
  )
}

export default function RagPanel({ chatHistory }: RagPanelProps) {
  if (!chatHistory.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full" style={{ color: 'var(--text-3)' }}>
        <div className="text-4xl opacity-20">💬</div>
        <p>No history yet. Type /ask in the chat.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-6">
      <h2 className="font-display font-extrabold text-xl mb-4" style={{ color: '#00aaff' }}>
        ⬡ RAG &amp; Chat History
      </h2>
      <div className="flex flex-col gap-5 pb-8 max-w-[860px] mx-auto">
        {chatHistory.map((m, i) => {
          const badge = m.trace ? badgeFor(m.trace.retrieval_method) : null
          return (
          <div key={i} className="border rounded-xl px-5 py-4"
            style={{
              borderColor: 'var(--border)',
              background: m.role === 'user' ? 'var(--green-glow)' : 'var(--bg)',
              marginLeft: m.role === 'user' ? '10%' : 0,
            }}>
            <div className="text-2xs uppercase tracking-wide font-bold mb-2 flex items-center gap-2"
              style={{ color: m.role === 'user' ? 'var(--green)' : 'var(--text-3)', letterSpacing: '.06em' }}>
              <span>{m.role === 'user' ? '🔍 User Query' : '🤖 AI Response'}</span>
              {badge && (
                <span
                  className="ml-auto text-2xs px-2 py-0.5 rounded-full border font-bold"
                  style={{ borderColor: badge.color, color: badge.color, letterSpacing: 0 }}
                  title={badge.tooltip}
                >
                  {badge.label}
                </span>
              )}
            </div>
            {m.role === 'user'
              ? <p style={{ color: 'var(--text)', fontSize: '.9rem' }}>{m.text}</p>
              : <div className="prose" dangerouslySetInnerHTML={{ __html: mdToHtml(m.text) }} />
            }
            {m.trace && (
              <details className="mt-2.5">
                <summary className="text-xs cursor-pointer" style={{ color: 'var(--text-3)' }}>
                  ⬡ RAG trace · {m.trace.source_chunks?.length || 0} chunks
                </summary>
                <div className="mt-2 p-3 border rounded text-xs leading-relaxed"
                  style={{ background: 'var(--bg-1)', borderColor: 'var(--border)' }}>
                  <div className="mb-1.5" style={{ color: 'var(--text-3)' }}>
                    Intent: <strong style={{ color: 'var(--amber)' }}>{m.trace.intent}</strong>
                    {typeof m.trace.intent_confidence === 'number' && (
                      <span style={{ color: 'var(--text-3)' }}>
                        {' '}(conf {(m.trace.intent_confidence * 100).toFixed(0)}%)
                      </span>
                    )}
                  </div>
                  <LegPills rt={m.trace.retrieval_trace} />
                  {m.trace.source_chunks?.map((c, j) => (
                    <div key={j} className="border rounded p-2 mb-1.5"
                      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                      <div className="mb-0.5 text-2xs" style={{ color: 'var(--amber)' }}>
                        {c.files?.slice(0, 3).join(' · ')}
                      </div>
                      <div style={{ color: 'var(--text-3)' }}>{c.summary_preview}</div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )
        })}
      </div>
    </div>
  )
}
