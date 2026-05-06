'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronRight, GripVertical, Clock } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { JiraEpic, JiraTask } from '@/lib/types'

interface BacklogPanelProps {
  backlog: JiraEpic[]
}

type ColumnType = 'backend' | 'frontend' | 'devops' | 'security' | 'testing'

interface Column {
  id: ColumnType
  label: string
  icon: string
  bg: string
  border: string
  headerBg: string
  headerColor: string
}

const COLUMNS: Column[] = [
  { id: 'backend',  icon: '🔧', label: 'Backend',  bg: 'rgba(0,170,255,.06)',  border: 'rgba(0,170,255,.15)',  headerBg: 'rgba(0,170,255,.12)',  headerColor: '#00aaff' },
  { id: 'frontend', icon: '🎨', label: 'Frontend', bg: 'rgba(170,136,255,.06)', border: 'rgba(170,136,255,.15)', headerBg: 'rgba(170,136,255,.12)', headerColor: '#aa88ff' },
  { id: 'devops',   icon: '⚙️', label: 'DevOps',   bg: 'rgba(255,179,0,.05)',   border: 'rgba(255,179,0,.12)',   headerBg: 'rgba(255,179,0,.08)',   headerColor: 'var(--amber)' },
  { id: 'security', icon: '🛡️', label: 'Security', bg: 'rgba(255,68,68,.06)',   border: 'rgba(255,68,68,.15)',   headerBg: 'rgba(255,68,68,.12)',   headerColor: 'var(--red)' },
  { id: 'testing',  icon: '🧪', label: 'Testing',  bg: 'rgba(68,221,255,.06)',  border: 'rgba(68,221,255,.15)',  headerBg: 'rgba(68,221,255,.12)',  headerColor: '#44ddff' },
]

interface KanbanCardProps {
  task: JiraTask
  isExpanded: boolean
  onToggle: () => void
}

function KanbanCard({ task, isExpanded, onToggle }: KanbanCardProps) {
  const hasSubtasks = task.subtasks && task.subtasks.length > 0

  return (
    <div
      className="rounded-lg border mb-2 cursor-pointer select-none transition-all hover:border-[var(--green-mute)]"
      style={{ background: 'var(--bg-1)', borderColor: 'var(--border)' }}
      onClick={onToggle}
    >
      <div className="px-3 py-2.5 flex items-center gap-2">
        <GripVertical size={14} className="flex-shrink-0" style={{ color: 'var(--text-3)' }} />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[0.78rem] font-medium leading-snug" style={{ color: 'var(--text)' }}>
            {task.title}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {task.story_points != null && (
              <span className="text-2xs font-mono flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                <Clock size={10} />
                {task.story_points} pts
              </span>
            )}
            {hasSubtasks && (
              <span className="text-2xs font-mono" style={{ color: 'var(--text-3)' }}>
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {task.subtasks.length} subtasks
              </span>
            )}
          </div>
        </div>
      </div>

      {isExpanded && hasSubtasks && (
        <div className="border-t px-4 py-2 flex flex-col gap-1.5" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
          {task.subtasks.map((sub, si) => (
            <div key={si} className="flex items-start gap-2 text-xs font-mono" style={{ color: 'var(--text-2)' }}>
              <span className="mt-0.5 opacity-40">•</span>
              <span>{sub}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function BacklogPanel({ backlog }: BacklogPanelProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())

  if (!backlog?.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full" style={{ color: 'var(--text-3)' }}>
        <div className="text-5xl opacity-10">⬡</div>
        <p className="font-mono text-sm">Backlog empty. Run /cr to generate JIRA tasks.</p>
      </div>
    )
  }

  const toggleTask = (epicIdx: number, taskIdx: number) => {
    const key = `${epicIdx}-${taskIdx}`
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const allTasks: { task: JiraTask; epicIdx: number; epicTitle: string; taskIdx: number }[] = []
  backlog.forEach((epic, ei) => {
    epic.tasks?.forEach((task, ti) => {
      allTasks.push({ task, epicIdx: ei, epicTitle: epic.title, taskIdx: ti })
    })
  })

  if (allTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full" style={{ color: 'var(--text-3)' }}>
        <div className="text-5xl opacity-10">⬡</div>
        <p className="font-mono text-sm">No tasks in backlog. Run /cr to generate JIRA tasks.</p>
      </div>
    )
  }

  const tasksByColumn: Record<ColumnType, typeof allTasks> = {
    backend: [],
    frontend: [],
    devops: [],
    security: [],
    testing: [],
  }

  allTasks.forEach((item) => {
    const col = item.task.type as ColumnType
    if (tasksByColumn[col]) tasksByColumn[col].push(item)
  })

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
        <h2 className="font-display font-extrabold text-lg" style={{ color: '#aa88ff' }}>
          ⬡ Kanban Board
        </h2>
        <span className="text-2xs font-mono" style={{ color: 'var(--text-3)' }}>
          {allTasks.length} tasks · {backlog.length} epics
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex gap-3 p-4 h-full min-h-0" style={{ minHeight: '100%' }}>
          {COLUMNS.map((col) => {
            const tasks = tasksByColumn[col.id]
            return (
              <div
                key={col.id}
                className="flex-1 min-w-[220px] max-w-[340px] rounded-xl flex flex-col"
                style={{ background: col.bg, border: `1px solid ${col.border}` }}
              >
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-t-xl border-b"
                  style={{ background: col.headerBg, borderColor: col.border }}
                >
                  <span className="text-sm">{col.icon}</span>
                  <span className="font-display font-extrabold text-xs uppercase tracking-wide" style={{ color: col.headerColor }}>
                    {col.label}
                  </span>
                  <span
                    className="ml-auto text-2xs font-mono font-bold px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--bg)', color: col.headerColor }}
                  >
                    {tasks.length}
                  </span>
                </div>

                <div className="p-2 flex-1 overflow-y-auto">
                  {tasks.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-2xs font-mono" style={{ color: 'var(--text-3)' }}>
                      No tasks
                    </div>
                  ) : (
                    tasks.map(({ task, epicIdx, epicTitle, taskIdx }) => (
                      <KanbanCard
                        key={`${epicIdx}-${taskIdx}`}
                        task={task}
                        isExpanded={expandedTasks.has(`${epicIdx}-${taskIdx}`)}
                        onToggle={() => toggleTask(epicIdx, taskIdx)}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      <div className="flex items-center gap-2 px-5 py-2 border-t flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        {backlog.map((epic, ei) => (
          <span
            key={ei}
            className="text-2xs font-mono px-2 py-0.5 rounded-full truncate max-w-[250px]"
            style={{
              background: 'rgba(170,136,255,.08)',
              color: '#aa88ff',
              border: '1px solid rgba(170,136,255,.2)',
            }}
            title={epic.title}
          >
            {epic.title}
          </span>
        ))}
      </div>
    </div>
  )
}
