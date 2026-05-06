'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md px-3 py-1 font-mono text-sm outline-none transition-colors',
          'bg-[var(--bg-1)] border border-[var(--border-2)] text-[var(--text)]',
          'placeholder:text-[var(--text-3)]',
          'focus:border-[var(--green-mute)] focus:shadow-[0_0_0_2px_rgba(0,255,136,0.06)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
