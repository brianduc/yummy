import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useParams, usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'

const push = vi.fn()
const replace = vi.fn()
const back = vi.fn()

vi.mock('next/navigation', () => ({
  useParams: () => ({ sessionId: 'test-session-123' }),
  useRouter: () => ({ push, replace, back }),
  usePathname: () => '/workspace/test-session-123',
}))

function NavigationProbe() {
  const params = useParams<{ sessionId: string }>()
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div>
      <div data-testid="session-id">{params.sessionId}</div>
      <div data-testid="pathname">{pathname}</div>
      <Link href={`/workspace/${params.sessionId}`} data-testid="workspace-link">
        Workspace link
      </Link>
      <Link href={`/workspace/${params.sessionId}/settings`} data-testid="settings-link">
        Settings link
      </Link>
      <Link href={`/workspace/${params.sessionId}/graph`} data-testid="graph-link">
        Graph link
      </Link>
      <Link href={`/workspace/${params.sessionId}/wiki`} data-testid="wiki-link">
        Wiki link
      </Link>
      <Link href={`/workspace/${params.sessionId}/insight`} data-testid="insight-link">
        Insight link
      </Link>
      <Link href={`/workspace/${params.sessionId}/history`} data-testid="history-link">
        History link
      </Link>
      <Link href={`/workspace/${params.sessionId}/jira`} data-testid="jira-link">
        Jira link
      </Link>
      <button type="button" onClick={() => router.push(`/workspace/${params.sessionId}/sdlc`)}>
        Go SDLC
      </button>
      <button type="button" onClick={() => router.replace(`/workspace/${params.sessionId}/settings`)}>
        Replace route
      </button>
      <button type="button" onClick={() => router.back()}>
        Back
      </button>
    </div>
  )
}

describe('next/navigation mock infrastructure', () => {
  it('returns session-scoped params, pathname, and router methods', () => {
    render(<NavigationProbe />)

    expect(screen.getByTestId('session-id')).toHaveTextContent('test-session-123')
    expect(screen.getByTestId('pathname')).toHaveTextContent('/workspace/test-session-123')
    expect(screen.getByTestId('workspace-link')).toHaveAttribute('href', '/workspace/test-session-123')
    expect(screen.getByTestId('settings-link')).toHaveAttribute('href', '/workspace/test-session-123/settings')
    expect(screen.getByTestId('graph-link')).toHaveAttribute('href', '/workspace/test-session-123/graph')
    expect(screen.getByTestId('wiki-link')).toHaveAttribute('href', '/workspace/test-session-123/wiki')
    expect(screen.getByTestId('insight-link')).toHaveAttribute('href', '/workspace/test-session-123/insight')
    expect(screen.getByTestId('history-link')).toHaveAttribute('href', '/workspace/test-session-123/history')
    expect(screen.getByTestId('jira-link')).toHaveAttribute('href', '/workspace/test-session-123/jira')

    fireEvent.click(screen.getByRole('button', { name: 'Go SDLC' }))
    fireEvent.click(screen.getByRole('button', { name: 'Replace route' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(push).toHaveBeenCalledWith('/workspace/test-session-123/sdlc')
    expect(replace).toHaveBeenCalledWith('/workspace/test-session-123/settings')
    expect(back).toHaveBeenCalledTimes(1)
  })
})
