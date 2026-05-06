'use client'

import React from 'react'
import { Cpu, DollarSign, Loader2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { FileNode, SystemStatus, MetricsData } from '@/lib/types'

interface TreeNodeProps {
  node: FileNode
  depth: number
  onFileOpen: (path: string) => void
}

function TreeNodeItem({ node, depth, onFileOpen }: TreeNodeProps) {
  const isDir = node.status === 'pending'
  const statusColor =
    node.status === 'done' ? 'var(--green-dim)'
    : node.status === 'processing' ? 'var(--amber)'
    : 'var(--text-3)'

  return (
    <div
      onClick={() => !isDir && onFileOpen(node.path)}
      className="flex items-center gap-1.5 py-0.5 cursor-pointer hover:bg-[var(--bg-3)] rounded px-1 transition-colors text-xs font-mono"
      style={{ paddingLeft: `${depth * 14 + 8}px`, color: isDir ? 'var(--text-3)' : 'var(--text-2)' }}
    >
      <span className="flex-shrink-0" style={{ color: statusColor, fontSize: '0.65rem' }}>
        {isDir ? '▸' : '⬡'}
      </span>
      <span className="truncate">{node.name}</span>
    </div>
  )
}

function buildTree(flatList: FileNode[]) {
  if (!flatList || flatList.length === 0) return []
  const root: any[] = []
  const map: Record<string, any> = {}

  for (const file of flatList) {
    const parts = file.path.split('/')
    let current = root
    let currentPath = ''

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const isLast = i === parts.length - 1

      if (!map[currentPath]) {
        const entry = {
          name: part,
          path: currentPath,
          status: isLast ? file.status : 'pending' as const,
          children: [] as any[],
        }
        map[currentPath] = entry
        current.push(entry)
      }
      current = map[currentPath].children
    }
  }

  return root
}

function FileTreeView({ tree, onFileOpen }: { tree: FileNode[]; onFileOpen: (path: string) => void }) {
  const rootItems = buildTree(tree)

  const renderNodes = (nodes: any[], depth: number): React.ReactNode[] =>
    nodes.map((node) => (
      <React.Fragment key={node.path}>
        <TreeNodeItem node={node} depth={depth} onFileOpen={onFileOpen} />
        {node.children && node.children.length > 0 && renderNodes(node.children, depth + 1)}
      </React.Fragment>
    ))

  return <div className="py-1">{renderNodes(rootItems, 0)}</div>
}

interface ContextPanelProps {
  fileTree: FileNode[]
  onFileOpen: (path: string) => void
  status: SystemStatus | null
  metrics: MetricsData | null
  isRunning?: boolean
  children?: React.ReactNode
}

export default function ContextPanel({
  fileTree,
  onFileOpen,
  status,
  metrics,
  isRunning,
  children,
}: ContextPanelProps) {
  const providerLabel = status?.ai_provider ?? 'gemini'
  const providerMap: Record<string, string> = {
    gemini: 'Gemini',
    openai: 'OpenAI',
    ollama: 'Ollama',
    copilot: 'Copilot',
    bedrock: 'Bedrock',
  }
  const modelMap: Record<string, string | undefined> = {
    gemini: status?.gemini_model,
    openai: status?.openai_model,
    ollama: status?.ollama_model,
    copilot: status?.copilot_model,
    bedrock: status?.bedrock_model,
  }
  const modelName = modelMap[providerLabel] || providerLabel

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-1)' }}>
      <div
        className="flex items-center px-3 flex-shrink-0 font-mono text-2xs uppercase tracking-widest"
        style={{
          height: 32,
          color: 'var(--text-3)',
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        Explorer
      </div>

      {/* File tree */}
      <ScrollArea className="flex-1">
        <FileTreeView tree={fileTree} onFileOpen={onFileOpen} />
        {(!fileTree || fileTree.length === 0) && (
          <div className="px-3 py-8 text-center text-2xs" style={{ color: 'var(--text-3)' }}>
            No files indexed. Run /scan to start.
          </div>
        )}
      </ScrollArea>

      {/* Children slot (for sessions, tracing, settings panels) */}
      {children && <div className="flex-1 overflow-hidden">{children}</div>}

      {/* Footer with AI model and cost */}
      <div
        className="flex items-center justify-between px-3 flex-shrink-0 font-mono text-2xs border-t"
        style={{
          height: 28,
          background: 'var(--bg)',
          borderColor: 'var(--border)',
          color: 'var(--text-3)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <Cpu size={11} />
          <span>{providerMap[providerLabel] || providerLabel}</span>
          <span className="opacity-50">{modelName}</span>
          {isRunning && <Loader2 size={10} className="animate-spin" style={{ color: 'var(--amber)' }} />}
        </div>
        <div className="flex items-center gap-1">
          <DollarSign size={10} />
          <span>
            {metrics ? `$${metrics.total_cost_usd.toFixed(4)}` : '$0.00'}
          </span>
        </div>
      </div>
    </div>
  )
}
