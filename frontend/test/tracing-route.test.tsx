import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({ sessionId: 'test-tracing-session' }),
  usePathname: () => '/workspace/test-tracing-session/tracing',
}))

vi.mock('@/hooks/useWorkspaceSession', () => ({
  useWorkspaceSession: () => ({
    session: null,
    sessionId: 'test-tracing-session',
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

vi.mock('@/components/workspace/TracingPanel', () => ({
  default: () => <div data-testid="tracing-panel-stub">TracingPanel</div>,
}))

import TracingPage from '@/app/workspace/[sessionId]/tracing/page'

describe('TracingPage', () => {
  it('renders tracing-page wrapper', () => {
    render(<TracingPage />)
    expect(screen.getByTestId('tracing-page')).toBeInTheDocument()
  })

  it('renders TracingPanel component', () => {
    render(<TracingPage />)
    expect(screen.getByTestId('tracing-panel-stub')).toBeInTheDocument()
  })
})
