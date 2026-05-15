import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({ sessionId: 'test-world-session' }),
  usePathname: () => '/workspace/test-world-session/world',
}))

vi.mock('@/components/workspace/WorldPanel', () => ({
  default: () => <div data-testid="world-panel-stub">WorldPanel</div>,
}))

import WorldPage from '@/app/workspace/[sessionId]/world/page'

describe('WorldPage', () => {
  it('renders world-page wrapper', () => {
    render(<WorldPage />)
    expect(screen.getByTestId('world-page')).toBeInTheDocument()
  })

  it('renders WorldPanel component', () => {
    render(<WorldPage />)
    expect(screen.getByTestId('world-panel-stub')).toBeInTheDocument()
  })
})
