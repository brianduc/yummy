import { useState, useCallback, useEffect } from 'react'
import { applyTheme, getCurrentTheme, loadSavedTheme } from '@/lib/theme'
import { applyUiSize, getSavedUiSizeIndex, loadSavedUiSize } from '@/lib/uiSize'
import type { ThemeId } from '@/lib/theme'
import type { WorkspaceUiPreferences } from '@/hooks/useWorkspaceContracts'

export function useWorkspaceUi() {
  const [theme, setThemeState] = useState<ThemeId>(() => getCurrentTheme())
  const [uiSize, setUiSizeState] = useState<number>(() => getSavedUiSizeIndex())
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [onboardingState, setOnboardingStateRaw] = useState<WorkspaceUiPreferences['onboardingState']>(() => {
    if (typeof window === 'undefined') return 'dismissed'
    const stored = localStorage.getItem('yummy_onboarding')
    return stored === 'done' ? 'dismissed' : 'asking'
  })

  useEffect(() => {
    loadSavedTheme()
    loadSavedUiSize()
  }, [])

  const setTheme = useCallback((id: ThemeId) => {
    applyTheme(id)
    setThemeState(id)
  }, [])

  const setUiSize = useCallback((index: number) => {
    applyUiSize(index)
    setUiSizeState(index)
  }, [])

  const setOnboardingState = useCallback((state: WorkspaceUiPreferences['onboardingState']) => {
    setOnboardingStateRaw(state)
  }, [])

  return {
    theme,
    uiSize,
    preferences: {
      onboardingState,
      commandPaletteOpen,
    },
    setTheme,
    setUiSize,
    setCommandPaletteOpen,
    setOnboardingState,
  }
}
