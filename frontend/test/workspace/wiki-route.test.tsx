import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useParams: () => ({ sessionId: 'test-wiki-session' }),
}))

vi.mock('@/hooks/useWorkspaceStatus', () => ({
  useWorkspaceStatus: () => ({
    kb: {
      project_summary: '# My Project\n\nDescription here',
      insights: [],
    },
    loading: false,
    error: null,
    status: null,
    scanStatus: null,
    fetchStatus: vi.fn(),
    fetchKb: vi.fn(),
    startScanPoll: vi.fn(),
    stopScanPoll: vi.fn(),
    setScanStatus: vi.fn(),
  }),
}))

vi.mock('@/components/workspace/WikiPanel', () => ({
  default: () => <div data-testid="wiki-panel-stub">WikiPanel</div>,
}))

import WikiPage from '@/app/workspace/[sessionId]/wiki/page'

describe('WikiPage', () => {
  it('renders wiki-page wrapper', () => {
    render(<WikiPage />)

    expect(screen.getByTestId('wiki-page')).toBeInTheDocument()
    expect(screen.getByTestId('wiki-panel-stub')).toBeInTheDocument()
  })

  it('renders WikiPanel stub', () => {
    render(<WikiPage />)

    expect(screen.getByTestId('wiki-panel-stub')).toBeInTheDocument()
  })

  it('mounts without error', () => {
    render(<WikiPage />)

    expect(screen.getByTestId('wiki-page')).toHaveTextContent('Wiki')
    expect(screen.getByTestId('wiki-panel-stub')).toBeInTheDocument()
  })
})
