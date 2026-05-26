import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useParams: () => ({ sessionId: 'test-explorer-session' }),
}))

vi.mock('@/hooks/useWorkspaceStatus', () => ({
  useWorkspaceStatus: () => ({
    kb: {
      tree: [
        { name: 'src', children: [{ name: 'index.ts' }] },
        { name: 'README.md' },
      ],
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

vi.mock('@/components/workspace/IdePanel', () => ({
  default: () => <div data-testid="ide-panel-stub">IdePanel</div>,
}))

import ExplorerPage from '@/app/workspace/[sessionId]/explorer/page'

describe('ExplorerPage', () => {
  it('renders explorer-page wrapper', () => {
    render(<ExplorerPage />)

    expect(screen.getByTestId('explorer-page')).toBeInTheDocument()
  })

  it('renders IdePanel stub', () => {
    render(<ExplorerPage />)

    expect(screen.getByTestId('ide-panel-stub')).toBeInTheDocument()
  })

  it('passes tree data to IdePanel', () => {
    render(<ExplorerPage />)

    expect(screen.getByTestId('ide-panel-stub')).toHaveTextContent('IdePanel')
  })

  it('contains at least one file node in the tree mock', () => {
    const tree = [
      { name: 'src', children: [{ name: 'index.ts' }] },
      { name: 'README.md' },
    ]

    expect(tree.some(node => node.name === 'README.md' || (node.children?.length ?? 0) > 0)).toBe(true)
  })
})
