import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useParams: () => ({ sessionId: 'test-history-session' }),
}))

vi.mock('@/hooks/useWorkspaceChat', () => ({
  useChat: () => ({
    chatHistory: [
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
    ],
  }),
}))

vi.mock('@/components/workspace/RagPanel', () => ({ default: () => <div data-testid="rag-panel-stub">RagPanel</div> }))

import HistoryPage from '@/app/workspace/[sessionId]/history/page'

describe('HistoryPage', () => {
  it('renders history-page wrapper', () => {
    render(<HistoryPage />)
    expect(screen.getByTestId('history-page')).toBeInTheDocument()
  })

  it('renders RagPanel component', () => {
    render(<HistoryPage />)
    expect(screen.getByTestId('rag-panel-stub')).toBeInTheDocument()
  })

  it('mounts without error', () => {
    expect(() => render(<HistoryPage />)).not.toThrow()
  })
})
