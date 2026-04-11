'use client'
import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import type { ChatMessage } from '@/lib/types'

interface Props {
  sessionId: string
  chatHistory: ChatMessage[]
  onHistoryUpdate: (msgs: ChatMessage[]) => void
  hasKB: boolean
}

export default function ChatPanel({ sessionId, chatHistory, onHistoryUpdate, hasKB }: Props) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, loading])

  const send = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setLoading(true)

    const userMsg: ChatMessage = { role: 'user', text: q }
    onHistoryUpdate([...chatHistory, userMsg])

    try {
      const res = await api.ask(sessionId, q) as any
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        text: res.answer,
        trace: res.trace,
      }
      onHistoryUpdate([...chatHistory, userMsg, assistantMsg])
    } catch (e: any) {
      const errMsg: ChatMessage = { role: 'system', text: `❌ ${e.message}` }
      onHistoryUpdate([...chatHistory, userMsg, errMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="flex flex-col h-full">

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 flex flex-col gap-3">
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-text-3 text-[0.8rem] text-center">
            <div className="text-[2rem] opacity-40">◎</div>
            {hasKB ? 'Ask anything about the codebase' : 'Scan the repo first to enable chat'}
          </div>
        ) : (
          chatHistory.map((msg, i) => (
            <div
              key={i}
              className="fade-in flex flex-col gap-[0.2rem]"
              style={{ alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
            >
              <div className="text-[0.68rem] text-text-3 tracking-[0.04em] uppercase">
                {msg.role === 'user' ? 'you' : msg.role === 'assistant' ? 'expert agent' : 'system'}
              </div>
              <div
                className="max-w-[90%] px-[0.8rem] py-2 text-base leading-[1.6]"
                style={{
                  borderRadius: 'var(--radius-lg)',
                  ...(msg.role === 'user' ? {
                    background: 'var(--green-mute)',
                    border: '1px solid var(--green-dim)',
                    color: 'var(--green)',
                    borderBottomRightRadius: 'var(--radius)',
                  } : msg.role === 'assistant' ? {
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    borderBottomLeftRadius: 'var(--radius)',
                  } : {
                    background: 'rgba(255,68,68,0.06)',
                    border: '1px solid var(--red-dim)',
                    color: 'var(--red)',
                    width: '100%',
                  }),
                }}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose" dangerouslySetInnerHTML={{ __html: mdToHtml(msg.text) }} />
                ) : (
                  msg.text
                )}
              </div>

              {/* RAG Trace */}
              {msg.trace && (
                <details className="max-w-[90%] w-full">
                  <summary className="text-[0.68rem] text-text-3 cursor-pointer list-none flex gap-[0.3rem] items-center">
                    <span>⬡</span> RAG trace · {msg.trace.source_chunks.length} chunks
                  </summary>
                  <div className="mt-[0.3rem] p-2 bg-bg-1 border border-border rounded text-[0.7rem] text-text-3">
                    {msg.trace.source_chunks.map((c, j) => (
                      <div key={j} className="mb-[0.4rem]">
                        <div className="text-amber mb-[0.1rem]">
                          {c.files.slice(0, 3).join(' · ')}
                        </div>
                        <div className="text-text-3">{c.summary_preview}</div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="flex gap-2 items-center text-text-3 text-sm">
            <span className="blink text-green">▊</span>
            Expert agent thinking...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border flex gap-2">
        <textarea
          className="input resize-none flex-1"
          rows={2}
          placeholder={hasKB ? 'Ask about the codebase... (Enter to send)' : 'Scan repo first'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={!hasKB || loading}
        />
        <button
          className="btn btn-primary self-end px-[0.9rem] py-[0.45rem]"
          onClick={send}
          disabled={!hasKB || loading || !input.trim()}
        >
          ↑
        </button>
      </div>
    </div>
  )
}

function mdToHtml(md: string): string {
  return md
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
}
