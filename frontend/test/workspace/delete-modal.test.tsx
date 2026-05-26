import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DeleteSessionModal from '@/components/workspace/DeleteSessionModal'
import type { Session } from '@/lib/types'

describe('DeleteSessionModal', () => {
  const mockSession = {
    id: 'sess-1',
    name: 'Test Session',
    created_at: '2026-05-26T00:00:00.000Z',
    chat_history: [],
    workflow_state: 'idle',
    agent_outputs: {},
    jira_backlog: [],
    metrics: { tokens: 0 },
  } as Session

  it('renders with session name', () => {
    render(<DeleteSessionModal session={mockSession} onClose={vi.fn()} onConfirm={vi.fn()} />)

    expect(screen.getByText('Test Session')).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()

    render(<DeleteSessionModal session={mockSession} onClose={onClose} onConfirm={vi.fn()} />)
    fireEvent.click(screen.getByText('Cancel'))

    expect(onClose).toHaveBeenCalled()
  })

  it('calls onConfirm when Delete is clicked', () => {
    const onConfirm = vi.fn()

    render(<DeleteSessionModal session={mockSession} onClose={vi.fn()} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByText('Delete'))

    expect(onConfirm).toHaveBeenCalled()
  })
})
