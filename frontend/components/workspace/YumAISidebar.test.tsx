import React, { useEffect, useState } from 'react'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { YumAISidebar } from './YumAISidebar'
import { WorkspaceChatProvider, useChat } from '@/hooks/useWorkspaceChat'
import type { ChatMessage } from '@/lib/types'
import type { WorkspaceChatContext } from '@/hooks/useWorkspaceContracts'

import { Group as PanelGroup } from 'react-resizable-panels'

if (typeof window !== 'undefined') {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// Mock the scrollIntoView which might be called by AICopilot
window.HTMLElement.prototype.scrollIntoView = vi.fn()

function makeDefaultChatContext(): WorkspaceChatContext {
  return {
    chatHistory: [],
    termLogs: [],
    termRef: React.createRef<HTMLDivElement>(),
    busy: false,
    btwBusy: false,
    sendAsk: vi.fn(),
    sendBtw: vi.fn(),
    print: vi.fn(),
    handleCmd: vi.fn().mockResolvedValue(undefined),
    setBusy: vi.fn(),
    setBtwBusy: vi.fn(),
    setChatHistory: vi.fn(),
  }
}

describe('YumAISidebar', () => {
  const defaultCopilotProps = {
    chatHistory: [],
    termLogs: [],
    scanStatus: null,
    busy: false,
    btwBusy: false,
    workflowRunning: false,
    termRef: { current: null },
    onSubmit: vi.fn(),
    sessionName: 'Test Session'
  }

  it('renders correctly', () => {
    render(
      <PanelGroup orientation="horizontal">
        <YumAISidebar {...defaultCopilotProps} />
      </PanelGroup>
    )
    expect(screen.getByTestId('yumai-sidebar')).toBeInTheDocument()
    // Both text 'YumAI' should be present
    expect(screen.getAllByText('YumAI').length).toBeGreaterThan(0)
  })

  it('preserves prop-backed chat history', () => {
    const chatHistory: ChatMessage[] = [{ role: 'user', text: 'Persistent History Message' }]
    render(
      <PanelGroup orientation="horizontal">
        <YumAISidebar {...defaultCopilotProps} chatHistory={chatHistory} />
      </PanelGroup>
    )
    
    expect(screen.getByTestId('yumai-sidebar')).toBeInTheDocument()
    expect(screen.getByText('Persistent History Message')).toBeInTheDocument()
  })

  it('WorkspaceChatProvider is not remounted on Sidebar render (provider is stable)', () => {
    const chatContext = makeDefaultChatContext()
    chatContext.chatHistory = [{ role: 'user', text: 'Sentinel message from provider' }]

    let mountCount = 0
    let visibleText: string | null = null

    function ProviderMountTracker() {
      useEffect(() => {
        mountCount += 1
      }, [])
      return null
    }

    function ChatBridge() {
      const ctx = useChat()
      visibleText = ctx.chatHistory[0]?.text ?? null
      return <span data-testid="chat-bridge">{visibleText}</span>
    }

    const Wrapper = ({ open }: { open: boolean }) => (
      <WorkspaceChatProvider value={chatContext}>
        <ProviderMountTracker />
        <ChatBridge />
        <PanelGroup orientation="horizontal">
          {open && <YumAISidebar {...defaultCopilotProps} chatHistory={chatContext.chatHistory} />}
        </PanelGroup>
      </WorkspaceChatProvider>
    )

    const { rerender } = render(<Wrapper open={false} />)
    const mountCountAfterFirstRender = mountCount

    rerender(<Wrapper open={true} />)
    expect(screen.getByTestId('yumai-sidebar')).toBeInTheDocument()

    rerender(<Wrapper open={false} />)
    expect(screen.queryByTestId('yumai-sidebar')).not.toBeInTheDocument()

    rerender(<Wrapper open={true} />)
    expect(screen.getByTestId('chat-bridge')).toHaveTextContent('Sentinel message from provider')
    expect(mountCount).toBe(mountCountAfterFirstRender)
  })

  it('multi-chunk stream runs to completion after mid-stream YumAISidebar close', async () => {
    const chunks: string[] = []
    const abortedRef = { current: false }
    let resumeStream!: () => void
    const pauseAfterFirst = new Promise<void>((resolve) => {
      resumeStream = resolve
    })

    const ParentWithStreamAndSidebar = () => {
      const [open, setOpen] = useState(true)
      const controllerRef = React.useRef(new AbortController())

      const startStream = () => {
        const signal = controllerRef.current.signal
        void (async () => {
          for (let i = 0; i < 3; i++) {
            const chunk = ['alpha', 'beta', 'gamma'][i]!
            if (signal.aborted) {
              abortedRef.current = true
              return
            }
            chunks.push(chunk)
            if (i === 0) await pauseAfterFirst
          }
        })()
      }

      return (
        <>
          <button type="button" onClick={startStream} data-testid="start-stream">start stream</button>
          <button type="button" onClick={() => setOpen(false)} data-testid="close-btn">close</button>
          <PanelGroup orientation="horizontal">
            {open && <YumAISidebar {...defaultCopilotProps} />}
          </PanelGroup>
        </>
      )
    }

    render(<ParentWithStreamAndSidebar />)
    expect(screen.getByTestId('yumai-sidebar')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('start-stream'))
    await act(async () => {})

    expect(chunks).toEqual(['alpha'])

    fireEvent.click(screen.getByTestId('close-btn'))
    expect(screen.queryByTestId('yumai-sidebar')).not.toBeInTheDocument()

    await act(async () => {
      resumeStream()
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    })

    expect(abortedRef.current).toBe(false)
    expect(chunks).toEqual(['alpha', 'beta', 'gamma'])
  })
})
