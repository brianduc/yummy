import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({ sessionId: 'test-settings-session' }),
  usePathname: () => '/workspace/test-settings-session/settings',
}))

vi.mock('@/hooks/useWorkspaceStatus', () => ({
  useWorkspaceStatus: () => ({
    status: null,
    kb: null,
    scanStatus: null,
    loading: false,
    error: null,
    fetchStatus: vi.fn().mockResolvedValue(undefined),
    fetchKb: vi.fn(),
    startScanPoll: vi.fn(),
    stopScanPoll: vi.fn(),
    setScanStatus: vi.fn(),
  }),
}))

vi.mock('@/components/workspace/SettingsPanel', () => ({
  default: () => <div data-testid="settings-panel-stub">SettingsPanel</div>,
}))

import SettingsPage from '@/app/workspace/[sessionId]/settings/page'

describe('SettingsPage', () => {
  it('renders settings-page wrapper', () => {
    render(<SettingsPage />)
    expect(screen.getByTestId('settings-page')).toBeInTheDocument()
  })

  it('renders SettingsPanel component', () => {
    render(<SettingsPage />)
    expect(screen.getByTestId('settings-panel-stub')).toBeInTheDocument()
  })
})
