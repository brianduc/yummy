import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  WorkspaceChatContext,
  WorkspaceSdlcContext,
  WorkspaceSessionContext,
  WorkspaceStatusContext,
  WorkspaceUiContext,
} from '@/hooks/useWorkspaceContracts'

type WorkspaceProviderContracts =
  | WorkspaceSessionContext
  | WorkspaceStatusContext
  | WorkspaceChatContext
  | WorkspaceSdlcContext
  | WorkspaceUiContext

const assertWorkspaceContractsAreTypesOnly = <T extends WorkspaceProviderContracts>() => undefined as T | undefined

assertWorkspaceContractsAreTypesOnly()

type StreamKind = 'chat' | 'sdlc'

type StreamRecord = {
  kind: StreamKind
  controller: AbortController
  signal: AbortSignal
  task: Promise<void>
}

const NativeAbortController = globalThis.AbortController
const abortControllerInstances: MockAbortController[] = []

class MockAbortController implements AbortController {
  private readonly controller = new NativeAbortController()

  constructor() {
    abortControllerInstances.push(this)
  }

  get signal() {
    return this.controller.signal
  }

  abort(reason?: unknown) {
    this.controller.abort(reason)
  }
}

type WorkspaceStreamContextValue = {
  startChatStream: () => void
  startSdlcStream: () => void
  records: StreamRecord[]
}

const WorkspaceStreamContext = createContext<WorkspaceStreamContextValue | null>(null)

function useWorkspaceStreamContext() {
  const value = useContext(WorkspaceStreamContext)
  if (!value) throw new Error('WorkspaceStreamProvider is missing')
  return value
}

async function* neverEndingStream(signal: AbortSignal): AsyncGenerator<string> {
  yield 'started'
  await new Promise<void>((resolve) => {
    signal.addEventListener('abort', () => resolve(), { once: true })
  })
}

function WorkspaceStreamProvider({ children }: { children: React.ReactNode }) {
  const recordsRef = useRef<StreamRecord[]>([])

  const startStream = (kind: StreamKind) => {
    const controller = new AbortController()
    const task = (async () => {
      for await (const _chunk of neverEndingStream(controller.signal)) {
        // Keep consuming until the workspace layout unmounts and aborts the signal.
      }
    })()
    recordsRef.current.push({ kind, controller, signal: controller.signal, task })
  }

  useEffect(() => {
    return () => {
      for (const record of recordsRef.current) {
        record.controller.abort()
      }
    }
  }, [])

  const value = useMemo<WorkspaceStreamContextValue>(() => ({
    startChatStream: () => startStream('chat'),
    startSdlcStream: () => startStream('sdlc'),
    records: recordsRef.current,
  }), [])

  return (
    <WorkspaceStreamContext.Provider value={value}>
      {children}
    </WorkspaceStreamContext.Provider>
  )
}

function WorkspaceLayoutHarness() {
  const streams = useWorkspaceStreamContext()

  return (
    <section aria-label="workspace layout">
      <button type="button" onClick={streams.startChatStream}>start chat</button>
      <button type="button" onClick={streams.startSdlcStream}>start sdlc</button>
      <ChildRoute />
    </section>
  )
}

function ChildRoute() {
  return <p>workspace child route</p>
}

function YumAIToggleHarness() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const streams = useWorkspaceStreamContext()

  return (
    <section aria-label="workspace layout">
      <button type="button" onClick={streams.startChatStream}>start chat</button>
      <button type="button" onClick={streams.startSdlcStream}>start sdlc</button>
      <button type="button" onClick={() => setSidebarOpen((open) => !open)}>toggle YumAI</button>
      {sidebarOpen && <div data-testid="yumai-sidebar">YumAI</div>}
    </section>
  )
}

function MidStreamYumAICloseHarness({
  pauseAfterFirst,
  chunks,
  abortedRef,
}: {
  pauseAfterFirst: Promise<void>
  chunks: string[]
  abortedRef: { current: boolean }
}) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const controllerRef = React.useRef(new NativeAbortController())

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
    <section aria-label="mid-stream harness">
      <button type="button" onClick={startStream} data-testid="start-stream">start stream</button>
      <button type="button" onClick={() => setSidebarOpen(true)} data-testid="open-yumai">open YumAI</button>
      <button type="button" onClick={() => setSidebarOpen(false)} data-testid="close-yumai">close YumAI</button>
      {sidebarOpen && <div data-testid="yumai-sidebar">YumAI</div>}
    </section>
  )
}

function NestedWorkspaceRoute({ routeKey }: { routeKey: string }) {
  return (
    <WorkspaceStreamProvider>
      <div data-route-key={routeKey}>
        <WorkspaceLayoutHarness />
      </div>
    </WorkspaceStreamProvider>
  )
}

function LeavingWorkspaceRoute({ inWorkspace, routeKey }: { inWorkspace: boolean; routeKey: string }) {
  if (!inWorkspace) return <main>outside workspace</main>
  return <NestedWorkspaceRoute routeKey={routeKey} />
}

describe('workspace stream lifecycle contracts', () => {
  beforeEach(() => {
    abortControllerInstances.length = 0
    vi.stubGlobal('AbortController', MockAbortController)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stream continues across workspace child route navigation', async () => {
    const { rerender } = render(<NestedWorkspaceRoute routeKey="ide" />)

    fireEvent.click(screen.getByRole('button', { name: 'start chat' }))
    fireEvent.click(screen.getByRole('button', { name: 'start sdlc' }))
    await act(async () => {})

    rerender(<NestedWorkspaceRoute routeKey="sdlc" />)

    expect(screen.getByLabelText('workspace layout')).toBeTruthy()
    const activeSignals = getSignalsFromAbortControllerMock()
    expect(activeSignals).toHaveLength(2)
    expect(activeSignals.every((signal) => signal.aborted === false)).toBe(true)
  })

  it('stream aborts on workspace layout unmount', async () => {
    const { rerender } = render(<LeavingWorkspaceRoute inWorkspace routeKey="ide" />)

    fireEvent.click(screen.getByRole('button', { name: 'start chat' }))
    fireEvent.click(screen.getByRole('button', { name: 'start sdlc' }))
    await act(async () => {})

    rerender(<LeavingWorkspaceRoute inWorkspace={false} routeKey="outside" />)
    await act(async () => {})

    const activeSignals = getSignalsFromAbortControllerMock()
    expect(activeSignals).toHaveLength(2)
    expect(activeSignals.every((signal) => signal.aborted === true)).toBe(true)
  })

  it('stream continues after YumAI open/close cycle (sidebar is presentation-only)', async () => {
    render(
      <WorkspaceStreamProvider>
        <YumAIToggleHarness />
      </WorkspaceStreamProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'start chat' }))
    await act(async () => {})

    fireEvent.click(screen.getByRole('button', { name: 'toggle YumAI' }))
    expect(screen.getByTestId('yumai-sidebar')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'toggle YumAI' }))
    expect(screen.queryByTestId('yumai-sidebar')).not.toBeInTheDocument()

    const signals = getSignalsFromAbortControllerMock()
    expect(signals).toHaveLength(1)
    expect(signals[0]!.aborted).toBe(false)
  })

  it('deterministic multi-chunk stream is not interrupted by mid-stream YumAI close', async () => {
    const chunks: string[] = []
    const abortedRef = { current: false }
    let resumeStream!: () => void
    const pauseAfterFirst = new Promise<void>((resolve) => {
      resumeStream = resolve
    })

    render(
      <WorkspaceStreamProvider>
        <MidStreamYumAICloseHarness
          pauseAfterFirst={pauseAfterFirst}
          chunks={chunks}
          abortedRef={abortedRef}
        />
      </WorkspaceStreamProvider>,
    )

    fireEvent.click(screen.getByTestId('start-stream'))
    await act(async () => {})

    expect(chunks).toEqual(['alpha'])

    fireEvent.click(screen.getByTestId('open-yumai'))
    fireEvent.click(screen.getByTestId('close-yumai'))
    expect(screen.queryByTestId('yumai-sidebar')).not.toBeInTheDocument()

    await act(async () => {
      resumeStream()
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    })

    expect(abortedRef.current).toBe(false)
    expect(chunks).toEqual(['alpha', 'beta', 'gamma'])
  })
})

function getSignalsFromAbortControllerMock(): AbortSignal[] {
  return abortControllerInstances.map((controller) => controller.signal)
}
