import {
  Activity,
  BookOpen,
  Database,
  Columns2,
  FolderTree,
  GitBranch,
  Globe,
  History,
  MessageSquare,
  Network,
  Settings,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export type ActivityId =
  | 'chat'
  | 'graph'
  | 'explorer'
  | 'wiki'
  | 'insight'
  | 'sdlc'
  | 'tracing'
  | 'history'
  | 'settings'
  | 'db'
  | 'jira'
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
  { id: 'chat', icon: MessageSquare, label: 'Dashboard', activeColor: 'var(--green)', testId: 'activity-bar-item-copilot', isIndex: true, routeSuffix: '', breadcrumbLabel: 'Dashboard' },
  { id: 'tracing', icon: Activity, label: 'Tracing', activeColor: '#00aaff', testId: 'activity-bar-item-tracing', isIndex: false, routeSuffix: 'tracing', breadcrumbLabel: 'Tracing' },
  { id: 'db', icon: Database, label: 'Database', activeColor: '#ff6644', testId: 'activity-bar-item-database', isIndex: false, routeSuffix: 'database', breadcrumbLabel: 'Database' },
  { id: 'settings', icon: Settings, label: 'Settings', activeColor: 'var(--text-2)', testId: 'activity-bar-item-settings', isIndex: false, routeSuffix: 'settings', breadcrumbLabel: 'Settings' },
  { id: 'world', icon: Globe, label: 'World', activeColor: '#00ccaa', testId: 'activity-bar-item-world', isIndex: false, routeSuffix: 'world', breadcrumbLabel: 'World' },
  { id: 'sessions', icon: History, label: 'Sessions', activeColor: 'var(--text-2)', testId: 'activity-bar-item-sessions', isIndex: false, routeSuffix: 'sessions', breadcrumbLabel: 'Sessions' },
  { id: 'graph', icon: Network, label: 'Graph', activeColor: '#00aaff', testId: 'activity-bar-item-graph', isIndex: false, routeSuffix: 'graph', breadcrumbLabel: 'Node Graph' },
  { id: 'wiki', icon: BookOpen, label: 'Wiki', activeColor: 'var(--green)', testId: 'activity-bar-item-wiki', isIndex: false, routeSuffix: 'wiki', breadcrumbLabel: 'Wiki' },
  { id: 'insight', icon: Zap, label: 'Insight', activeColor: 'var(--amber)', testId: 'activity-bar-item-insight', isIndex: false, routeSuffix: 'insight', breadcrumbLabel: 'AI Insights' },
  { id: 'history', icon: History, label: 'History', activeColor: 'var(--text-2)', testId: 'activity-bar-item-history', isIndex: false, routeSuffix: 'history', breadcrumbLabel: 'Chat History' },
  { id: 'jira', icon: Columns2, label: 'Jira', activeColor: '#ff6644', testId: 'activity-bar-item-jira', isIndex: false, routeSuffix: 'jira', breadcrumbLabel: 'Jira Kanban' },
]

export const workspaceActivityRouteLabels: Record<ActivityId, string> = {
  chat: 'Dashboard',
  graph: 'Graph',
  explorer: 'Explorer',
  wiki: 'Wiki',
  insight: 'Insight',
  sdlc: 'SDLC Pipeline',
  tracing: 'Tracing',
  history: 'History',
  settings: 'Settings',
  db: 'Database',
  jira: 'Jira',
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
