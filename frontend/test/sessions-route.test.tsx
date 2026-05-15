import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({ sessionId: 'test-sessions-session' }),
  usePathname: () => '/workspace/test-sessions-session/sessions',
}))

vi.mock('@/hooks/useWorkspaceSession', () => ({
  useWorkspaceSession: () => ({
    session: null,
    sessionId: 'test-sessions-session',
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

vi.mock('@/components/workspace/SessionsPanel', () => ({
  default: () => <div data-testid="sessions-panel-stub">SessionsPanel</div>,
}))

import SessionsPage from '@/app/workspace/[sessionId]/sessions/page'

describe('SessionsPage', () => {
  it('renders sessions-page wrapper', () => {
    render(<SessionsPage />)
    expect(screen.getByTestId('sessions-page')).toBeInTheDocument()
  })

  it('renders SessionsPanel component', () => {
    render(<SessionsPage />)
    expect(screen.getByTestId('sessions-panel-stub')).toBeInTheDocument()
  })
})
