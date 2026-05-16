import {
  Activity,
  Database,
  FolderTree,
  GitBranch,
  Globe,
  History,
  MessageSquare,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export type ActivityId =
  | 'chat'
  | 'explorer'
  | 'sdlc'
  | 'tracing'
  | 'settings'
  | 'db'
  | 'world'
  | 'sessions'

export interface ActivityItem {
  id: ActivityId
  icon: LucideIcon
  label: string
  activeColor: string
  testId: string
  isIndex: boolean
  routeSuffix: string
  breadcrumbLabel: string
}

export const activityItems: ActivityItem[] = [
  { id: 'explorer', icon: FolderTree, label: 'Explorer', activeColor: 'var(--green)', testId: 'activity-bar-item-explorer', isIndex: false, routeSuffix: 'explorer', breadcrumbLabel: 'Explorer' },
  { id: 'sdlc', icon: GitBranch, label: 'SDLC Pipeline', activeColor: 'var(--amber)', testId: 'activity-bar-item-sdlc', isIndex: false, routeSuffix: 'sdlc', breadcrumbLabel: 'SDLC Pipeline' },
  { id: 'chat', icon: MessageSquare, label: 'AI Copilot', activeColor: 'var(--green)', testId: 'activity-bar-item-copilot', isIndex: true, routeSuffix: '', breadcrumbLabel: 'AI Copilot' },
  { id: 'tracing', icon: Activity, label: 'Tracing', activeColor: '#00aaff', testId: 'activity-bar-item-tracing', isIndex: false, routeSuffix: 'tracing', breadcrumbLabel: 'Tracing' },
  { id: 'db', icon: Database, label: 'Database', activeColor: '#ff6644', testId: 'activity-bar-item-database', isIndex: false, routeSuffix: 'database', breadcrumbLabel: 'Database' },
  { id: 'settings', icon: Settings, label: 'Settings', activeColor: 'var(--text-2)', testId: 'activity-bar-item-settings', isIndex: false, routeSuffix: 'settings', breadcrumbLabel: 'Settings' },
  { id: 'world', icon: Globe, label: 'World', activeColor: '#00ccaa', testId: 'activity-bar-item-world', isIndex: false, routeSuffix: 'world', breadcrumbLabel: 'World' },
  { id: 'sessions', icon: History, label: 'Sessions', activeColor: 'var(--text-2)', testId: 'activity-bar-item-sessions', isIndex: false, routeSuffix: 'sessions', breadcrumbLabel: 'Sessions' },
]

export const workspaceActivityRouteLabels: Record<ActivityId, string> = {
  chat: 'AI Copilot',
  explorer: 'Explorer',
  sdlc: 'SDLC Pipeline',
  tracing: 'Tracing',
  settings: 'Settings',
  db: 'Database',
  world: 'World',
  sessions: 'Sessions',
}

export function buildWorkspaceActivityRoute(sessionId: string | undefined, item: ActivityItem): string {
  const base = `/workspace/${sessionId ?? ''}`
  return item.isIndex ? base : `${base}/${item.routeSuffix}`
}

export function isWorkspaceActivityActive(
  pathname: string | null | undefined,
  sessionId: string | undefined,
  item: ActivityItem,
): boolean {
  if (!sessionId || !pathname) return false
  const route = buildWorkspaceActivityRoute(sessionId, item)
  if (item.isIndex) return pathname === route
  return pathname === route || pathname.startsWith(`${route}/`)
}
