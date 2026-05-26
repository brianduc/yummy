import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useParams: () => ({ sessionId: 'test-insight-session' }),
}))

vi.mock('@/hooks/useWorkspaceStatus', () => ({
  useWorkspaceStatus: () => ({
    kb: {
      insights: [{ id: '1', title: 'Code Smell', description: 'Found issue' }],
    },
  }),
}))

vi.mock('@/components/workspace/InsightsPanel', () => ({
  default: () => <div data-testid="insight-panel-stub">InsightsPanel</div>,
}))

import InsightPage from '@/app/workspace/[sessionId]/insight/page'

describe('InsightPage', () => {
  it('renders insight-page wrapper', () => {
    render(<InsightPage />)
    expect(screen.getByTestId('insight-page')).toBeInTheDocument()
  })

  it('renders InsightsPanel component', () => {
    render(<InsightPage />)
    expect(screen.getByTestId('insight-panel-stub')).toBeInTheDocument()
  })

  it('mounts without error', () => {
    expect(() => render(<InsightPage />)).not.toThrow()
  })
})
