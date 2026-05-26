import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPush, mockPathname } = vi.hoisted(() => {
  const mockPush = vi.fn()
  const mockPathname = { value: '/workspace/test-session-abc' }
  return { mockPush, mockPathname }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({ sessionId: 'test-session-abc' }),
  usePathname: () => mockPathname.value,
}))

import ActivityBar from '@/components/workspace/ActivityBar'

describe('ActivityBar routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPathname.value = '/workspace/test-session-abc'
  })

  it('renders activity-bar container', () => {
    render(<ActivityBar />)
    expect(screen.getByTestId('activity-bar')).toBeInTheDocument()
  })

  it('clicking explorer navigates to explorer route', () => {
    render(<ActivityBar />)
    fireEvent.click(screen.getByTestId('activity-bar-item-explorer'))
    expect(mockPush).toHaveBeenCalledWith('/workspace/test-session-abc/explorer')
  })

  it('clicking sdlc navigates to sdlc route', () => {
    render(<ActivityBar />)
    fireEvent.click(screen.getByTestId('activity-bar-item-sdlc'))
    expect(mockPush).toHaveBeenCalledWith('/workspace/test-session-abc/sdlc')
  })

  it('clicking AI Copilot navigates to index route', () => {
    render(<ActivityBar />)
    fireEvent.click(screen.getByTestId('activity-bar-item-copilot'))
    expect(mockPush).toHaveBeenCalledWith('/workspace/test-session-abc')
  })

  it('clicking tracing navigates to tracing route', () => {
    render(<ActivityBar />)
    fireEvent.click(screen.getByTestId('activity-bar-item-tracing'))
    expect(mockPush).toHaveBeenCalledWith('/workspace/test-session-abc/tracing')
  })

  it('clicking database navigates to database route', () => {
    render(<ActivityBar />)
    fireEvent.click(screen.getByTestId('activity-bar-item-database'))
    expect(mockPush).toHaveBeenCalledWith('/workspace/test-session-abc/database')
  })

  it('clicking settings navigates to settings route', () => {
    render(<ActivityBar />)
    fireEvent.click(screen.getByTestId('activity-bar-item-settings'))
    expect(mockPush).toHaveBeenCalledWith('/workspace/test-session-abc/settings')
  })

  it('clicking world navigates to world route', () => {
    render(<ActivityBar />)
    fireEvent.click(screen.getByTestId('activity-bar-item-world'))
    expect(mockPush).toHaveBeenCalledWith('/workspace/test-session-abc/world')
  })

  it('clicking sessions navigates to sessions route', () => {
    render(<ActivityBar />)
    fireEvent.click(screen.getByTestId('activity-bar-item-sessions'))
    expect(mockPush).toHaveBeenCalledWith('/workspace/test-session-abc/sessions')
  })

  it('clicking graph navigates to graph route', () => {
    render(<ActivityBar />)
    fireEvent.click(screen.getByTestId('activity-bar-item-graph'))
    expect(mockPush).toHaveBeenCalledWith('/workspace/test-session-abc/graph')
  })

  it('clicking wiki navigates to wiki route', () => {
    render(<ActivityBar />)
    fireEvent.click(screen.getByTestId('activity-bar-item-wiki'))
    expect(mockPush).toHaveBeenCalledWith('/workspace/test-session-abc/wiki')
  })

  it('clicking insight navigates to insight route', () => {
    render(<ActivityBar />)
    fireEvent.click(screen.getByTestId('activity-bar-item-insight'))
    expect(mockPush).toHaveBeenCalledWith('/workspace/test-session-abc/insight')
  })

  it('clicking history navigates to history route', () => {
    render(<ActivityBar />)
    fireEvent.click(screen.getByTestId('activity-bar-item-history'))
    expect(mockPush).toHaveBeenCalledWith('/workspace/test-session-abc/history')
  })

  it('clicking jira navigates to jira route', () => {
    render(<ActivityBar />)
    fireEvent.click(screen.getByTestId('activity-bar-item-jira'))
    expect(mockPush).toHaveBeenCalledWith('/workspace/test-session-abc/jira')
  })

  it('explorer item is highlighted when at explorer route', () => {
    mockPathname.value = '/workspace/test-session-abc/explorer'
    render(<ActivityBar />)
    expect(screen.getByTestId('activity-bar-item-explorer')).toHaveClass('bg-[var(--bg-2)]')
  })

  it('chat item is highlighted when at index route', () => {
    mockPathname.value = '/workspace/test-session-abc'
    render(<ActivityBar />)
    expect(screen.getByTestId('activity-bar-item-copilot')).toHaveClass('bg-[var(--bg-2)]')
  })

  it('sdlc item is highlighted when at sdlc route', () => {
    mockPathname.value = '/workspace/test-session-abc/sdlc'
    render(<ActivityBar />)
    expect(screen.getByTestId('activity-bar-item-sdlc')).toHaveClass('bg-[var(--bg-2)]')
  })

  it('settings item is highlighted when at settings route', () => {
    mockPathname.value = '/workspace/test-session-abc/settings'
    render(<ActivityBar />)
    expect(screen.getByTestId('activity-bar-item-settings')).toHaveClass('bg-[var(--bg-2)]')
  })

  it('world item is highlighted when at world route', () => {
    mockPathname.value = '/workspace/test-session-abc/world'
    render(<ActivityBar />)
    expect(screen.getByTestId('activity-bar-item-world')).toHaveClass('bg-[var(--bg-2)]')
  })

  it('sessions item is highlighted when at sessions route', () => {
    mockPathname.value = '/workspace/test-session-abc/sessions'
    render(<ActivityBar />)
    expect(screen.getByTestId('activity-bar-item-sessions')).toHaveClass('bg-[var(--bg-2)]')
  })

  it('graph item is highlighted when at graph route', () => {
    mockPathname.value = '/workspace/test-session-abc/graph'
    render(<ActivityBar />)
    expect(screen.getByTestId('activity-bar-item-graph')).toHaveClass('bg-[var(--bg-2)]')
  })

  it('wiki item is highlighted when at wiki route', () => {
    mockPathname.value = '/workspace/test-session-abc/wiki'
    render(<ActivityBar />)
    expect(screen.getByTestId('activity-bar-item-wiki')).toHaveClass('bg-[var(--bg-2)]')
  })

  it('insight item is highlighted when at insight route', () => {
    mockPathname.value = '/workspace/test-session-abc/insight'
    render(<ActivityBar />)
    expect(screen.getByTestId('activity-bar-item-insight')).toHaveClass('bg-[var(--bg-2)]')
  })

  it('history item is highlighted when at history route', () => {
    mockPathname.value = '/workspace/test-session-abc/history'
    render(<ActivityBar />)
    expect(screen.getByTestId('activity-bar-item-history')).toHaveClass('bg-[var(--bg-2)]')
  })

  it('jira item is highlighted when at jira route', () => {
    mockPathname.value = '/workspace/test-session-abc/jira'
    render(<ActivityBar />)
    expect(screen.getByTestId('activity-bar-item-jira')).toHaveClass('bg-[var(--bg-2)]')
  })

  it('inactive items do not have active background', () => {
    mockPathname.value = '/workspace/test-session-abc/explorer'
    render(<ActivityBar />)
    expect(screen.getByTestId('activity-bar-item-sdlc')).not.toHaveClass('bg-[var(--bg-2)]')
    expect(screen.getByTestId('activity-bar-item-copilot')).not.toHaveClass('bg-[var(--bg-2)]')
    expect(screen.getByTestId('activity-bar-item-settings')).not.toHaveClass('bg-[var(--bg-2)]')
    expect(screen.getByTestId('activity-bar-item-graph')).not.toHaveClass('bg-[var(--bg-2)]')
    expect(screen.getByTestId('activity-bar-item-wiki')).not.toHaveClass('bg-[var(--bg-2)]')
    expect(screen.getByTestId('activity-bar-item-insight')).not.toHaveClass('bg-[var(--bg-2)]')
    expect(screen.getByTestId('activity-bar-item-history')).not.toHaveClass('bg-[var(--bg-2)]')
    expect(screen.getByTestId('activity-bar-item-jira')).not.toHaveClass('bg-[var(--bg-2)]')
  })

  it('chat index item is not highlighted when at a sub-route', () => {
    mockPathname.value = '/workspace/test-session-abc/sdlc'
    render(<ActivityBar />)
    expect(screen.getByTestId('activity-bar-item-copilot')).not.toHaveClass('bg-[var(--bg-2)]')
  })
})
