import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useParams: () => ({ sessionId: 'test-jira-session' }),
}))

vi.mock('@/hooks/useWorkspaceSession', () => ({
  useWorkspaceSession: () => ({
    session: {
      jira_backlog: [{ id: 'epic-1', title: 'Auth Module', tasks: [] }],
    },
    sessionId: 'test-jira-session',
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

vi.mock('@/components/workspace/BacklogPanel', () => ({
  default: () => <div data-testid="backlog-panel-stub">BacklogPanel</div>,
}))

import JiraPage from '@/app/workspace/[sessionId]/jira/page'

describe('JiraPage', () => {
  it('renders jira-page wrapper', () => {
    render(<JiraPage />)
    expect(screen.getByTestId('jira-page')).toBeInTheDocument()
  })

  it('renders BacklogPanel stub', () => {
    render(<JiraPage />)
    expect(screen.getByTestId('backlog-panel-stub')).toBeInTheDocument()
  })

  it('mounts without error', () => {
    expect(() => render(<JiraPage />)).not.toThrow()
  })
})
