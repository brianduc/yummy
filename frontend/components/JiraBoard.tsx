'use client'
import type { JiraEpic } from '@/lib/types'

const TYPE_COLORS: Record<string, string> = {
  backend:  '#00aaff',
  frontend: '#aa88ff',
  devops:   '#ffb300',
  security: '#ff6644',
  testing:  '#00ff88',
}

interface Props {
  backlog: JiraEpic[]
}

export default function JiraBoard({ backlog }: Props) {
  if (backlog.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-3 text-[0.8rem] flex-col gap-2">
        <div className="text-[2rem] opacity-30">⬡</div>
        <div>JIRA backlog generated after SA approval</div>
      </div>
    )
  }

  const totalTasks = backlog.reduce((n, e) => n + e.tasks.length, 0)
  const totalPoints = backlog.reduce((n, e) => n + e.tasks.reduce((m, t) => m + (t.story_points || 0), 0), 0)

  return (
    <div className="flex flex-col h-full">
      {/* Header stats */}
      <div className="flex gap-4 px-[0.9rem] py-[0.6rem] border-b border-border text-[0.75rem]">
        <span><span className="text-green">{backlog.length}</span> epics</span>
        <span><span className="text-amber">{totalTasks}</span> tasks</span>
        {totalPoints > 0 && <span><span className="text-text-2">{totalPoints}</span> pts</span>}
      </div>

      {/* Epics */}
      <div className="flex-1 overflow-auto p-3 flex flex-col gap-3">
        {backlog.map((epic, ei) => (
          <div key={ei} className="border border-border rounded-lg overflow-hidden">

            {/* Epic header */}
            <div className="px-3 py-2 bg-bg-2 border-b border-border flex items-center gap-2">
              <span className="text-green text-[0.7rem]">EPIC</span>
              <span className="font-display font-bold text-[0.88rem] text-text">
                {epic.title}
              </span>
              <span className="ml-auto text-[0.7rem] text-text-3">
                {epic.tasks.length} tasks
              </span>
            </div>

            {/* Tasks */}
            <div className="flex flex-col">
              {epic.tasks.map((task, ti) => (
                <details key={ti} className={ti < epic.tasks.length - 1 ? 'border-b border-border' : ''}>
                  <summary className="flex items-center gap-2 px-3 py-[0.45rem] cursor-pointer list-none">
                    <span className="text-2xs text-text-3">▸</span>
                    <span style={{
                      background: `${TYPE_COLORS[task.type] || '#888'}18`,
                      color: TYPE_COLORS[task.type] || '#888',
                      border: `1px solid ${TYPE_COLORS[task.type] || '#888'}44`,
                    }} className="text-[0.68rem] px-[0.4em] py-[0.1em] rounded uppercase tracking-[0.04em] font-semibold flex-shrink-0">
                      {task.type}
                    </span>
                    <span className="text-[0.8rem] text-text flex-1">{task.title}</span>
                    {task.story_points && (
                      <span className="text-[0.68rem] px-[0.4em] py-[0.1em] rounded bg-bg-3 text-text-2 border border-border flex-shrink-0">
                        {task.story_points} pts
                      </span>
                    )}
                  </summary>

                  {task.subtasks.length > 0 && (
                    <div className="px-3 pt-[0.3rem] pb-[0.6rem] pl-[2.2rem] bg-bg-1">
                      {task.subtasks.map((sub, si) => (
                        <div key={si} className="flex gap-[0.4rem] text-[0.76rem] text-text-2 py-[0.15rem] items-start">
                          <span className="text-text-3 flex-shrink-0 mt-[0.1rem]">○</span>
                          <span>{sub}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
