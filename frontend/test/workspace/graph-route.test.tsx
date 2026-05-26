import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useParams: () => ({ sessionId: 'test-graph-session' }),
}))

vi.mock('@/hooks/useWorkspaceStatus', () => ({
  useWorkspaceStatus: () => ({
    kb: {
      tree: [{ path: 'src/index.ts' }, { path: 'src/components/Button.tsx' }],
    },
    status: {
      repo: { owner: 'org', repo: 'name' },
    },
  }),
}))

vi.mock('@/components/workspace/NodeGraph', () => ({
  default: () => <div data-testid="nodegraph-stub">NodeGraph</div>,
}))

import GraphPage from '@/app/workspace/[sessionId]/graph/page'

describe('GraphPage', () => {
  it('renders graph-page wrapper', () => {
    render(<GraphPage />)
    expect(screen.getByTestId('graph-page')).toBeInTheDocument()
  })

  it('renders NodeGraph stub', () => {
    render(<GraphPage />)
    expect(screen.getByTestId('nodegraph-stub')).toBeInTheDocument()
  })

  it('exists and mounts without error', () => {
    expect(() => render(<GraphPage />)).not.toThrow()
  })
})
