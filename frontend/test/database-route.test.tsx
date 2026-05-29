import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceSessionListContext } from '@/app/workspace/[sessionId]/session-context'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({ sessionId: 'test-database-session' }),
  usePathname: () => '/workspace/test-database-session/database',
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
  const renderPage = () =>
    render(
      <WorkspaceSessionListContext.Provider
        value={{
          sessions: [],
          fetchSessions: vi.fn().mockResolvedValue(undefined),
          deleteSession: vi.fn().mockResolvedValue(undefined),
        }}
      >
        <DatabasePage />
      </WorkspaceSessionListContext.Provider>,
    )

  it('renders database-page wrapper', () => {
    renderPage()
    expect(screen.getByTestId('database-page')).toBeInTheDocument()
  })

  it('renders DbPanel component', () => {
    renderPage()
    expect(screen.getByTestId('db-panel-stub')).toBeInTheDocument()
  })
})
