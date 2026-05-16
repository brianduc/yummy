import React, { useEffect, useState } from 'react'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CopilotSheet } from './CopilotSheet'
import { WorkspaceChatProvider, useChat } from '@/hooks/useWorkspaceChat'
import type { ChatMessage } from '@/lib/types'
import type { WorkspaceChatContext } from '@/hooks/useWorkspaceContracts'

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

describe('CopilotSheet', () => {
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

  it('renders correctly and respects open state', () => {
    const { rerender } = render(<CopilotSheet open={false} onOpenChange={() => {}} {...defaultCopilotProps} />)
    expect(screen.queryByTestId('copilot-sheet')).not.toBeInTheDocument()

    rerender(<CopilotSheet open={true} onOpenChange={() => {}} {...defaultCopilotProps} />)
    expect(screen.getByTestId('copilot-sheet')).toBeInTheDocument()
    // Both SheetTitle and AICopilot's header text should be present
    expect(screen.getAllByText('AI Copilot').length).toBeGreaterThan(0)
  })

  it('preserves prop-backed chat history across open/close cycles', () => {
    const TestComponent = () => {
      const [open, setOpen] = useState(false)
      const chatHistory: ChatMessage[] = [{ role: 'user', text: 'Persistent History Message' }]
      return (
        <>
          <button onClick={() => setOpen(!open)} data-testid="toggle-btn">Toggle</button>
          <CopilotSheet open={open} onOpenChange={setOpen} {...defaultCopilotProps} chatHistory={chatHistory} />
        </>
      )
    }

    render(<TestComponent />)
    
    // Open
    fireEvent.click(screen.getByTestId('toggle-btn'))
    expect(screen.getByTestId('copilot-sheet')).toBeInTheDocument()
    expect(screen.getByText('Persistent History Message')).toBeInTheDocument()

    // Close
    fireEvent.click(screen.getByTestId('toggle-btn'))
    expect(screen.queryByTestId('copilot-sheet')).not.toBeInTheDocument()

    // Re-open
    fireEvent.click(screen.getByTestId('toggle-btn'))
    expect(screen.getByTestId('copilot-sheet')).toBeInTheDocument()
    expect(screen.getByText('Persistent History Message')).toBeInTheDocument()
  })

  it('does not invoke onSubmit or other callbacks upon closing (presentation-only close)', () => {
    const onSubmitMock = vi.fn()
    const onOpenChangeMock = vi.fn()
    
    render(
      <CopilotSheet 
        open={true} 
        onOpenChange={onOpenChangeMock} 
        {...defaultCopilotProps} 
        onSubmit={onSubmitMock} 
      />
    )
    
    // Attempt to close by simulating close button click
    const closeButtons = screen.getAllByRole('button', { name: /close/i })
    fireEvent.click(closeButtons[0]) // The Radix close button
    
    expect(onOpenChangeMock).toHaveBeenCalledWith(false)
    // Most importantly, the internal chat handler should not be touched!
    expect(onSubmitMock).not.toHaveBeenCalled()
  })

  it('WorkspaceChatProvider is not remounted on Sheet open/close (provider is stable)', () => {
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

    const SheetChild = ({ open }: { open: boolean }) => (
      <CopilotSheet open={open} onOpenChange={vi.fn()} {...defaultCopilotProps} chatHistory={chatContext.chatHistory} />
    )

    const Wrapper = ({ open }: { open: boolean }) => (
      <WorkspaceChatProvider value={chatContext}>
        <ProviderMountTracker />
        <ChatBridge />
        <SheetChild open={open} />
      </WorkspaceChatProvider>
    )

    const { rerender } = render(<Wrapper open={false} />)
    const mountCountAfterFirstRender = mountCount

    rerender(<Wrapper open={true} />)
    expect(screen.getByTestId('copilot-sheet')).toBeInTheDocument()

    rerender(<Wrapper open={false} />)
    expect(screen.queryByTestId('copilot-sheet')).not.toBeInTheDocument()

    rerender(<Wrapper open={true} />)
    expect(screen.getByTestId('chat-bridge')).toHaveTextContent('Sentinel message from provider')
    expect(mountCount).toBe(mountCountAfterFirstRender)
  })

  it('multi-chunk stream runs to completion after mid-stream CopilotSheet close (Sheet does not own the stream)', async () => {
    const chunks: string[] = []
    const abortedRef = { current: false }
    let resumeStream!: () => void
    const pauseAfterFirst = new Promise<void>((resolve) => {
      resumeStream = resolve
    })

    const ParentWithStreamAndSheet = () => {
      const [open, setOpen] = useState(true)
      const controllerRef = React.useRef(new AbortController())

      const handleOpenChange = (next: boolean) => {
        setOpen(next)
      }

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
          <button onClick={startStream} data-testid="start-stream">start stream</button>
          <CopilotSheet open={open} onOpenChange={handleOpenChange} {...defaultCopilotProps} />
        </>
      )
    }

    render(<ParentWithStreamAndSheet />)
    expect(screen.getByTestId('copilot-sheet')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('start-stream'))
    await act(async () => {})

    expect(chunks).toEqual(['alpha'])

    fireEvent.click(screen.getAllByRole('button', { name: /close/i })[0]!)
    expect(screen.queryByTestId('copilot-sheet')).not.toBeInTheDocument()

    await act(async () => {
      resumeStream()
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    })

    expect(abortedRef.current).toBe(false)
    expect(chunks).toEqual(['alpha', 'beta', 'gamma'])
  })
})
