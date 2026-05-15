'use client'

import React from 'react'
import WorldPanel from '@/components/workspace/WorldPanel'

export default function WorldPage() {
  return (
    <div data-testid="world-page" className="h-full">
      <WorldPanel />
    </div>
  )
}
