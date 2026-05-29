import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceSessionListContext } from '@/app/workspace/[sessionId]/session-context'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({ sessionId: 'test-sessions-session' }),
  usePathname: () => '/workspace/test-sessions-session/sessions',
}))

vi.mock('@/components/workspace/SessionsPanel', () => ({
  default: () => <div data-testid="sessions-panel-stub">SessionsPanel</div>,
}))

import SessionsPage from '@/app/workspace/[sessionId]/sessions/page'

describe('SessionsPage', () => {
  const renderPage = () =>
    render(
      <WorkspaceSessionListContext.Provider
        value={{
          sessions: [],
          fetchSessions: vi.fn().mockResolvedValue(undefined),
          deleteSession: vi.fn().mockResolvedValue(undefined),
        }}
      >
        <SessionsPage />
      </WorkspaceSessionListContext.Provider>,
    )

  it('renders sessions-page wrapper', () => {
    renderPage()
    expect(screen.getByTestId('sessions-page')).toBeInTheDocument()
  })

  it('renders SessionsPanel component', () => {
    renderPage()
    expect(screen.getByTestId('sessions-panel-stub')).toBeInTheDocument()
  })
})
