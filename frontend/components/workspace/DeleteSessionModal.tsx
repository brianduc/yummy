'use client'

import React from 'react'
import { Trash2 } from 'lucide-react'
import type { Session } from '@/lib/types'

interface DeleteSessionModalProps {
  session: Session
  onClose: () => void
  onConfirm: () => Promise<void>
}

export const DeleteSessionContext = React.createContext<((session: Session | null) => void) | null>(null)

export function useDeleteSessionRequest() {
  return React.useContext(DeleteSessionContext)
}

export default function DeleteSessionModal({ session, onClose, onConfirm }: DeleteSessionModalProps) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="border rounded-xl"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-1)',
          borderColor: '#ff664455',
          padding: '1.75rem 2rem',
          width: 360,
          boxShadow: '0 20px 60px rgba(0,0,0,.5)',
        }}
      >
        <div className="flex items-center gap-2.5 mb-4">
          <Trash2 size={22} style={{ color: '#ff6644' }} />
          <span className="font-display font-extrabold text-lg" style={{ color: '#ff6644' }}>
            Delete Session
          </span>
        </div>
        <p className="text-base leading-relaxed mb-2" style={{ color: 'var(--text-2)' }}>
          Are you sure you want to delete this workspace?
        </p>
        <p
          className="text-sm border rounded px-3 py-2 mb-6 font-mono truncate"
          style={{ color: 'var(--text-3)', background: 'var(--bg)', borderColor: 'var(--border)' }}
        >
          {session.name}
        </p>
        <p className="text-xs mb-6" style={{ color: 'rgba(255,100,68,.7)' }}>
          This action cannot be undone.
        </p>
        <div className="flex gap-2.5 justify-end">
          <button
            onClick={onClose}
            className="border rounded-lg cursor-pointer font-mono text-base"
            style={{
              padding: '.5rem 1.2rem',
              background: 'none',
              borderColor: 'var(--border)',
              color: 'var(--text-2)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="border-none rounded-lg cursor-pointer font-mono text-base font-bold"
            style={{ padding: '.5rem 1.2rem', background: '#ff6644', color: '#fff' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
