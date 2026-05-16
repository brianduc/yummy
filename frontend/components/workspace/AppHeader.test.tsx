import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPathname } = vi.hoisted(() => {
  const mockPathname = { value: '/workspace/test-session-abc' }
  return { mockPathname }
})

vi.mock('next/navigation', () => ({
  useParams: () => ({ sessionId: 'test-session-abc' }),
  usePathname: () => mockPathname.value,
}))

import AppHeader from '@/components/workspace/AppHeader'

describe('AppHeader component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPathname.value = '/workspace/test-session-abc'
  })

  it('renders app-header container', () => {
    render(<AppHeader />)
    expect(screen.getByTestId('app-header')).toBeInTheDocument()
    expect(screen.getByTestId('app-header')).toHaveClass('h-14', 'border-b')
  })

  it('renders base Workspace breadcrumb', () => {
    render(<AppHeader />)
    const breadcrumbs = screen.getByTestId('breadcrumbs')
    expect(breadcrumbs).toHaveTextContent('Workspace')
  })

  it('renders correct breadcrumb for AI Copilot (index route)', () => {
    mockPathname.value = '/workspace/test-session-abc'
    render(<AppHeader />)
    const breadcrumbs = screen.getByTestId('breadcrumbs')
    expect(breadcrumbs).toHaveTextContent('AI Copilot')
  })

  it('renders correct breadcrumb for Explorer route', () => {
    mockPathname.value = '/workspace/test-session-abc/explorer'
    render(<AppHeader />)
    const breadcrumbs = screen.getByTestId('breadcrumbs')
    expect(breadcrumbs).toHaveTextContent('Explorer')
  })

  it('renders correct breadcrumb for nested Explorer route', () => {
    mockPathname.value = '/workspace/test-session-abc/explorer/folder-a'
    render(<AppHeader />)
    const breadcrumbs = screen.getByTestId('breadcrumbs')
    expect(breadcrumbs).toHaveTextContent('Explorer')
  })

  it('triggers onOpenCommandPalette when Command button is clicked', () => {
    const onOpenCommandPalette = vi.fn()
    render(<AppHeader onOpenCommandPalette={onOpenCommandPalette} />)
    
    const trigger = screen.getByTestId('command-palette-trigger')
    fireEvent.click(trigger)
    expect(onOpenCommandPalette).toHaveBeenCalledTimes(1)
  })

  it('triggers onOpenCopilot when AI Copilot button is clicked', () => {
    const onOpenCopilot = vi.fn()
    render(<AppHeader onOpenCopilot={onOpenCopilot} />)
    
    const trigger = screen.getByTestId('ai-copilot-trigger')
    fireEvent.click(trigger)
    expect(onOpenCopilot).toHaveBeenCalledTimes(1)
  })

  it('displays Cmd/Ctrl+K hint in command palette trigger', () => {
    render(<AppHeader />)
    const trigger = screen.getByTestId('command-palette-trigger')
    expect(trigger).toHaveTextContent('Cmd/Ctrl+K')
  })

  it('keeps command palette trigger interactive for shell wiring', () => {
    const onOpenCommandPalette = vi.fn()
    render(<AppHeader onOpenCommandPalette={onOpenCommandPalette} />)

    fireEvent.click(screen.getByTestId('command-palette-trigger'))

    expect(onOpenCommandPalette).toHaveBeenCalledTimes(1)
  })
})
