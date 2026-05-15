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
    recordsRef.current.push({ kind, signal: controller.signal, task })
  }

  useEffect(() => {
    return () => {
      // RED: the future workspace layout provider should abort in-flight streams here.
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
})

function getSignalsFromAbortControllerMock(): AbortSignal[] {
  return abortControllerInstances.map((controller) => controller.signal)
}
