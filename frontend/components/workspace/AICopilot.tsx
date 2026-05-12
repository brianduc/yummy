'use client'

import React, { useRef, useEffect, useState, useMemo } from 'react'
import { Send, Loader2, Zap, Bot, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { mdToHtml } from '@/lib/mdToHtml'
import type { ChatMessage, ScanStatus } from '@/lib/types'
import { COMMANDS } from './ChatPanel'

interface AICopilotProps {
  chatHistory: ChatMessage[]
  termLogs: { role: string; text: string }[]
  scanStatus: ScanStatus | null
  busy: boolean
  btwBusy: boolean
  workflowRunning: boolean
  termRef: React.RefObject<HTMLDivElement | null>
  onSubmit: (input: string) => Promise<void>
  sessionName: string
}

const QUICK_COMMANDS = ['/scan', '/ask Explain the auth flow?', '/btw', '/provider', '/help']

export default function AICopilot({
  chatHistory,
  termLogs,
  scanStatus,
  busy,
  btwBusy,
  workflowRunning,
  termRef,
  onSubmit,
  sessionName,
}: AICopilotProps) {
  const [input, setInput] = useState('')
  const [suggestionIdx, setSuggestionIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const isBusy = busy || btwBusy

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, termLogs])

  const handleSubmit = async () => {
    const trimmed = input.trim()
    if (!trimmed || isBusy) return
    setInput('')
    setSuggestionIdx(0)
    await onSubmit(trimmed)
  }

  const activeSuggestions = useMemo(() => {
    if (!input.startsWith('/')) return []
    const prefix = input.split(' ')[0]
    const matches = COMMANDS.filter(c => c.cmd.startsWith(prefix))
    // During pipeline execution, only /btw is available
    return workflowRunning ? matches.filter(c => c.cmd === '/btw') : matches
  }, [input, workflowRunning])

  const selectSuggestion = (s: typeof COMMANDS[number], i: number) => {
    setSuggestionIdx(i)
    if (!s.args) {
      setInput('')
      setSuggestionIdx(0)
      onSubmit(s.cmd)
    } else {
      setInput(s.cmd + ' ')
      inputRef.current?.focus()
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (activeSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSuggestionIdx(prev => Math.min(prev + 1, activeSuggestions.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSuggestionIdx(prev => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        const s = activeSuggestions[suggestionIdx]
        if (!s.args) {
          setInput('')
          setSuggestionIdx(0)
          onSubmit(s.cmd)
        } else {
          setInput(s.cmd + ' ')
        }
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const s = activeSuggestions[suggestionIdx]
        const parts = input.trim().split(' ')
        const hasArgs = parts.length > 1 && parts[1] !== ''
        if (hasArgs) {
          handleSubmit()
        } else if (!s.args) {
          setInput('')
          setSuggestionIdx(0)
          onSubmit(s.cmd)
        } else {
          setInput(s.cmd + ' ')
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setInput('')
        setSuggestionIdx(0)
        return
      }
    }

    if (e.key === 'Enter') {
      handleSubmit()
    }
    if (e.key === 'Escape') { setInput(''); setSuggestionIdx(0) }
  }

  const renderLogLine = (entry: { role: string; text: string }, i: number) => {
    const isUser = entry.role === 'user'
    const isError = entry.role === 'error'
    const isTool = entry.role === 'tool'

    return (
      <div
        key={i}
        className="flex gap-2 mb-1.5"
        style={{
          color: isUser ? 'var(--green)' : isError ? '#ff6644' : isTool ? '#00ffaa' : 'var(--text-2)',
        }}
      >
        <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--text-3)' }}>
          {isUser ? '❯' : isTool ? '🔧' : isError ? '❌' : <Zap size={13} />}
        </span>
        <span className="whitespace-pre-wrap break-words text-[0.8rem] leading-relaxed font-mono">
          {entry.text}
        </span>
      </div>
    )
  }

  const renderChatMessage = (msg: ChatMessage, i: number) => {
    if (msg.role === 'system') {
      return (
        <div key={i} className="flex items-center justify-center py-2">
          <span className="text-2xs px-2 py-0.5 rounded font-mono" style={{ background: 'var(--bg-2)', color: 'var(--text-3)' }}>
            {msg.text}
          </span>
        </div>
      )
    }

    const isUser = msg.role === 'user'
    const html = !isUser ? mdToHtml(msg.text) : ''

    return (
      <div key={i} className={`flex gap-3 mb-3 ${isUser ? 'justify-end' : ''}`}>
        {!isUser && (
          <div className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center mt-0.5"
            style={{ background: 'var(--green-mute)' }}>
            <Bot size={14} style={{ color: 'var(--green)' }} />
          </div>
        )}

        <div
          className={`max-w-[85%] rounded-xl px-3.5 py-2.5 font-mono text-[0.8rem] leading-relaxed ${
            isUser ? 'rounded-br-sm' : 'rounded-bl-sm'
          }`}
          style={
            isUser
              ? { background: 'var(--green-mute)', color: 'var(--green)', border: '1px solid var(--green-dim)' }
              : { background: 'var(--bg-2)', color: 'var(--text)', border: '1px solid var(--border)' }
          }
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{msg.text}</span>
          ) : (
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
          )}

          {/* RAG trace */}
          {!isUser && msg.trace && (
            <details className="mt-2">
              <summary className="text-2xs cursor-pointer" style={{ color: 'var(--text-3)' }}>
                ⬡ RAG trace · {msg.trace.source_chunks?.length || 0} chunks
              </summary>
              <div className="mt-1.5 p-2 rounded text-xs border" style={{ background: 'var(--bg-1)', borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                {msg.trace.source_chunks?.map((c: any, j: number) => (
                  <div key={j} className="mb-1.5">
                    <div style={{ color: 'var(--amber)' }}>{c.files?.slice(0, 3).join(' · ')}</div>
                    <div>{c.summary_preview || c.summary}</div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {isUser && (
          <div className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center mt-0.5"
            style={{ background: 'var(--bg-2)' }}>
            <User size={14} style={{ color: 'var(--green-dim)' }} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-1)' }}>
      {/* Header */}
      <div
        className="flex items-center px-3 flex-shrink-0 border-b"
        style={{
          height: 32,
          background: 'var(--bg)',
          borderColor: 'var(--border)',
        }}
      >
        <span className="font-display font-extrabold text-sm" style={{ color: 'var(--green)' }}>
          AI Copilot
        </span>
        <span className="ml-2 text-2xs font-mono truncate" style={{ color: 'var(--text-3)' }}>
          {sessionName}
        </span>
        {(scanStatus?.running || busy) && (
          <Loader2 size={12} className="animate-spin ml-auto" style={{ color: 'var(--amber)' }} />
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {/* Terminal logs */}
          {termLogs.map((entry, i) => renderLogLine(entry, i))}

          {/* Scan progress */}
          {scanStatus?.running && (
            <div className="flex items-center gap-2 py-1.5 px-2 rounded my-1" style={{ background: 'rgba(255,179,0,0.05)' }}>
              <Loader2 size={12} className="animate-spin" style={{ color: 'var(--amber)' }} />
              <span className="text-xs font-mono" style={{ color: 'var(--amber)' }}>
                {scanStatus.text}
              </span>
              {scanStatus.progress > 0 && (
                <span className="text-2xs font-mono ml-auto" style={{ color: 'var(--amber-dim)' }}>
                  {scanStatus.progress}%
                </span>
              )}
            </div>
          )}

          {/* Chat messages */}
          {chatHistory.map((msg, i) => renderChatMessage(msg, i))}

          {/* Workflow blocked indicator */}
          {workflowRunning && (
            <div className="flex items-center justify-center py-2">
              <span className="text-2xs px-2 py-0.5 rounded font-mono" style={{ background: 'var(--bg-2)', color: 'var(--text-3)' }}>
                Pipeline running — use /btw to chat, /stop to abort
              </span>
            </div>
          )}

          <div ref={termRef} />
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Quick command chips */}
      <div className="px-3 flex gap-1 overflow-x-auto pb-1.5 flex-shrink-0">
        {QUICK_COMMANDS.map((h, i) => {
          const isBtwChip = h === '/btw'
          const chipBlocked = isBusy || (workflowRunning && !isBtwChip)
          return (
            <button
              key={i}
              onClick={() => !chipBlocked && (setInput(h), inputRef.current?.focus())}
              disabled={chipBlocked}
              className="whitespace-nowrap border rounded-full text-2xs cursor-pointer flex-shrink-0 flex items-center gap-1"
              style={{
                background: workflowRunning && isBtwChip ? 'rgba(255,179,0,.1)' : 'var(--bg)',
                borderColor: workflowRunning && isBtwChip ? 'var(--amber)' : 'var(--border)',
                color: workflowRunning && isBtwChip ? 'var(--amber)' : 'var(--text-3)',
                padding: '3px 10px',
                opacity: chipBlocked ? .3 : 1,
              }}>
              <Zap size={10} /> {h}
            </button>
          )
        })}
      </div>

      {/* Command suggestions */}
      {activeSuggestions.length > 0 && (
        <div className="mx-3 mb-1 border rounded-lg overflow-hidden flex-shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
          {activeSuggestions.map((s, i) => (
            <button
              key={s.cmd}
              onMouseEnter={() => setSuggestionIdx(i)}
              onClick={() => selectSuggestion(s, i)}
              className="w-full flex items-center gap-2 px-3 py-2 cursor-pointer text-left"
              style={{
                background: i === suggestionIdx ? 'var(--green-glow)' : 'transparent',
                borderLeft: `2px solid ${i === suggestionIdx ? 'var(--green)' : 'transparent'}`,
              }}>
              <span className="font-mono text-sm font-bold flex-shrink-0"
                style={{ color: i === suggestionIdx ? 'var(--green)' : 'var(--text-2)' }}>
                {s.cmd}
              </span>
              {s.args && (
                <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--amber)' }}>
                  {s.args}
                </span>
              )}
              <span className="text-xs truncate flex-1" style={{ color: 'var(--text-3)' }}>{s.desc}</span>
              {i === suggestionIdx && (
                <span className="text-2xs flex-shrink-0 px-1 rounded"
                  style={{ background: 'var(--bg-2)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                  ↵ select
                </span>
              )}
            </button>
          ))}
          <div className="px-3 py-1 border-t text-2xs"
            style={{ borderColor: 'var(--border)', color: 'var(--text-3)', background: 'var(--bg-1)' }}>
            ↑↓ navigate · ↵ or Tab to select · Esc to close
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setSuggestionIdx(0) }}
          onKeyDown={handleInputKeyDown}
          placeholder={workflowRunning ? '/btw to chat, /stop to abort...' : 'Type /help for commands...'}
          disabled={isBusy}
          className="flex-1 h-8 text-xs"
        />
        <Button
          size="sm"
          variant="default"
          onClick={handleSubmit}
          disabled={isBusy || !input.trim()}
          className="h-8 w-8 p-0"
        >
          <Send size={14} />
        </Button>
      </div>
    </div>
  )
}
