'use client'

import { createContext } from 'react'

export const FileOpenContext = createContext<{
  ideFile: string
  ideContent: string
  ideLoading: boolean
} | null>(null)
