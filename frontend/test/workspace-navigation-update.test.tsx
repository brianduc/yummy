import { describe, expect, it } from 'vitest'

import {
  activityItems,
  buildWorkspaceActivityRoute,
  isWorkspaceActivityActive,
} from '@/lib/workspace-navigation'

describe('workspace navigation update', () => {
  const graphItem = activityItems.find((item) => item.id === 'graph')
  const wikiItem = activityItems.find((item) => item.id === 'wiki')
  const insightItem = activityItems.find((item) => item.id === 'insight')
  const historyItem = activityItems.find((item) => item.id === 'history')
  const jiraItem = activityItems.find((item) => item.id === 'jira')
  const chatItem = activityItems.find((item) => item.id === 'chat')

  it('has 13 activity items', () => {
    expect(activityItems).toHaveLength(13)
  })

  it('builds the graph route correctly', () => {
    expect(graphItem).toBeDefined()
    expect(buildWorkspaceActivityRoute('sess-1', graphItem!)).toBe('/workspace/sess-1/graph')
  })

  it('marks graph active on its route', () => {
    expect(graphItem).toBeDefined()
    expect(isWorkspaceActivityActive('/workspace/sess-1/graph', 'sess-1', graphItem!)).toBe(true)
  })

  it('keeps new route suffixes aligned with ids', () => {
    expect(graphItem?.routeSuffix).toBe(graphItem?.id)
    expect(wikiItem?.routeSuffix).toBe(wikiItem?.id)
    expect(insightItem?.routeSuffix).toBe(insightItem?.id)
    expect(historyItem?.routeSuffix).toBe(historyItem?.id)
    expect(jiraItem?.routeSuffix).toBe(jiraItem?.id)
  })

  it('renames chat to Dashboard', () => {
    expect(chatItem?.label).toBe('Dashboard')
  })
})
