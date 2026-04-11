'use client'
import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import type { KnowledgeBase, ScanStatus } from '@/lib/types'

interface Props {
  hasRepo: boolean
}

export default function KBPanel({ hasRepo }: Props) {
  const [kb, setKb] = useState<KnowledgeBase | null>(null)
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'tree' | 'summary' | 'insights'>('tree')
  const [fileContent, setFileContent] = useState<{ path: string; content: string } | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const fetchKb = async () => {
    try {
      const data = await api.kb.get() as KnowledgeBase
      setKb(data)
    } catch { }
  }

  const pollScan = () => {
    pollRef.current = setInterval(async () => {
      try {
        const s = await api.kb.scanStatus() as ScanStatus
        setScanStatus(s)
        if (!s.running) {
          clearInterval(pollRef.current!)
          await fetchKb()
        }
      } catch { }
    }, 1500)
  }

  useEffect(() => {
    fetchKb()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const startScan = async () => {
    setLoading(true)
    try {
      await api.kb.scan()
      setScanStatus({ running: true, text: 'Starting...', progress: 0 })
      pollScan()
    } catch (e: any) {
      setScanStatus({ running: false, text: `Error: ${e.message}`, progress: 0, error: true })
    } finally {
      setLoading(false)
    }
  }

  const openFile = async (path: string) => {
    try {
      const res = await api.kb.file(path) as any
      setFileContent({ path, content: res.content })
    } catch (e: any) {
      alert(e.message)
    }
  }

  const statusColorClass = scanStatus?.error ? 'text-red' : scanStatus?.running ? 'text-amber' : 'text-green'

  return (
    <div className="flex flex-col h-full">

      {/* Scan bar */}
      <div className="p-3 border-b border-border">
        <div className={`flex gap-2 items-center ${scanStatus ? 'mb-2' : ''}`}>
          <button
            className="btn btn-primary flex-1 justify-center"
            onClick={startScan}
            disabled={!hasRepo || loading || scanStatus?.running}
          >
            {scanStatus?.running ? '⟳ Scanning...' : '⬡ Scan Repo'}
          </button>
          {kb && kb.file_count > 0 && (
            <span className="tag tag-green">{kb.file_count} files</span>
          )}
        </div>

        {scanStatus && (
          <div className="text-[0.73rem]">
            <div className={`${statusColorClass} mb-[0.3rem] break-all`}>
              {scanStatus.text}
            </div>
            <div className="h-[3px] bg-bg-3 rounded-[2px] overflow-hidden">
              <div style={{ width: `${scanStatus.progress}%` }} className={[
                'h-full transition-[width] duration-500 ease-[ease] shadow-[0_0_6px_rgba(0,255,136,0.5)]',
                scanStatus.error ? 'bg-red' : 'bg-green',
              ].join(' ')} />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      {kb && kb.file_count > 0 && (
        <div className="flex border-b border-border">
          {(['tree', 'summary', 'insights'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={[
              'flex-1 py-[0.45rem] bg-transparent border-0 font-mono text-[0.7rem] cursor-pointer uppercase tracking-[0.05em]',
              tab === t
                ? 'border-b-2 border-green text-green'
                : 'border-b-2 border-transparent text-text-3',
            ].join(' ')}>
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto">

        {/* File tree */}
        {tab === 'tree' && kb && (
          <div className="text-[0.75rem]">
            {kb.tree.length === 0 ? (
              <div className="p-6 text-text-3 text-center">
                {hasRepo ? 'Click Scan Repo to index codebase' : 'Setup GitHub repo first'}
              </div>
            ) : (
              kb.tree.map((f, i) => (
                <div
                  key={i}
                  onClick={() => openFile(f.path)}
                  className="flex items-center gap-[0.4rem] px-3 py-1 cursor-pointer border-b border-transparent transition-[background] duration-100 hover:bg-bg-2"
                >
                  <span style={{
                    background: f.status === 'done' ? 'var(--green)' : f.status === 'processing' ? 'var(--amber)' : 'var(--text-3)',
                    boxShadow: f.status === 'done' ? '0 0 4px var(--green)' : 'none',
                  }} className="w-[6px] h-[6px] rounded-full flex-shrink-0" />
                  <span className="text-text-2 overflow-hidden text-ellipsis whitespace-nowrap">
                    {f.path}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Project summary */}
        {tab === 'summary' && kb && (
          <div className="p-[0.9rem]">
            {kb.project_summary ? (
              <div className="prose" dangerouslySetInnerHTML={{ __html: mdToHtml(kb.project_summary) }} />
            ) : (
              <div className="text-text-3 text-[0.8rem]">No summary yet. Run scan first.</div>
            )}
          </div>
        )}

        {/* Insights */}
        {tab === 'insights' && kb && (
          <div className="flex flex-col gap-0">
            {kb.insights.map((ins, i) => (
              <details key={ins.id} className="border-b border-border">
                <summary className="px-3 py-2 cursor-pointer text-[0.75rem] text-text-2 list-none flex gap-2 items-center">
                  <span className="text-green">▸</span>
                  <span>Chunk {i + 1} — {ins.files.length} files</span>
                </summary>
                <div className="px-3 pt-2 pb-3 bg-bg-1">
                  <div className="text-[0.7rem] text-text-3 mb-[0.4rem]">
                    {ins.files.slice(0, 4).join(' · ')}{ins.files.length > 4 ? ` +${ins.files.length - 4}` : ''}
                  </div>
                  <div className="text-sm text-text-2 leading-[1.6]">
                    {ins.summary.slice(0, 300)}{ins.summary.length > 300 ? '...' : ''}
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      {/* File viewer modal */}
      {fileContent && (
        <div
          className="fixed inset-0 bg-[rgba(0,0,0,0.85)] z-[100] flex items-center justify-center p-8"
          onClick={() => setFileContent(null)}
        >
          <div
            className="bg-bg-1 border border-border rounded-lg w-full max-w-[800px] max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-[0.6rem] border-b border-border flex justify-between items-center">
              <span className="text-[0.8rem] text-green">{fileContent.path}</span>
              <button className="btn btn-ghost px-2 py-[0.2rem]" onClick={() => setFileContent(null)}>✕</button>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-sm text-text leading-[1.6] m-0 font-mono">
              {fileContent.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

// Minimal markdown → HTML converter (for project summary)
function mdToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])(.+)$/gm, '<p>$1</p>')
}
