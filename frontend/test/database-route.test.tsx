import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({ sessionId: 'test-database-session' }),
  usePathname: () => '/workspace/test-database-session/database',
}))

vi.mock('@/hooks/useWorkspaceSession', () => ({
  useWorkspaceSession: () => ({
    session: null,
    sessionId: 'test-database-session',
    sessions: [],
    metrics: null,
    loading: false,
    error: null,
    fetchSession: vi.fn(),
    fetchSessions: vi.fn(),
    fetchMetrics: vi.fn(),
    deleteSession: vi.fn(),
  }),
}))

vi.mock('@/hooks/useWorkspaceStatus', () => ({
  useWorkspaceStatus: () => ({
    status: null,
    kb: null,
    scanStatus: null,
    loading: false,
    error: null,
    fetchStatus: vi.fn().mockResolvedValue(undefined),
    fetchKb: vi.fn(),
    startScanPoll: vi.fn(),
    stopScanPoll: vi.fn(),
    setScanStatus: vi.fn(),
  }),
}))

vi.mock('@/components/workspace/DbPanel', () => ({
  default: () => <div data-testid="db-panel-stub">DbPanel</div>,
}))

import DatabasePage from '@/app/workspace/[sessionId]/database/page'

describe('DatabasePage', () => {
  it('renders database-page wrapper', () => {
    render(<DatabasePage />)
    expect(screen.getByTestId('database-page')).toBeInTheDocument()
  })

  it('renders DbPanel component', () => {
    render(<DatabasePage />)
    expect(screen.getByTestId('db-panel-stub')).toBeInTheDocument()
  })
})
