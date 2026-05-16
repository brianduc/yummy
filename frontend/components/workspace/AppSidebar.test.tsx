import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppSidebar } from './AppSidebar'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/workspace/test-session/explorer',
  useParams: () => ({ sessionId: 'test-session' }),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, 'data-testid': testId, ...props }: any) => (
    <a href={href} data-testid={testId} {...props}>
      {children}
    </a>
  ),
}))

describe('AppSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders expanded by default and can toggle', () => {
    render(<AppSidebar />)

    const sidebar = screen.getByTestId('app-sidebar')
    expect(sidebar.className).toContain('w-64')

    expect(screen.getByText('YUMMY')).toBeInTheDocument()

    const toggle = screen.getByTestId('sidebar-toggle')
    fireEvent.click(toggle)

    expect(sidebar.className).toContain('w-[64px]')
    expect(screen.queryByText('YUMMY')).toBeNull()
    expect(toggle).toHaveAttribute('aria-label', 'Expand Sidebar')
    expect(screen.getByTestId('sidebar-nav-explorer')).toHaveAttribute('title', 'Explorer')
  })

  it('renders navigation links', () => {
    render(<AppSidebar />)

    const explorerLink = screen.getByTestId('sidebar-nav-explorer')
    expect(explorerLink.getAttribute('href')).toBe('/workspace/test-session/explorer')
    expect(explorerLink).toHaveAttribute('aria-label', 'Explorer')
  })

  it('does not persist expanded state to localStorage when toggled', () => {
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem')

    render(<AppSidebar />)

    fireEvent.click(screen.getByTestId('sidebar-toggle'))
    fireEvent.click(screen.getByTestId('sidebar-toggle'))

    expect(setItemSpy).not.toHaveBeenCalled()
  })
})
