'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-mono text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--green-dim)] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--green-mute)] text-[var(--green)] border border-[var(--green-dim)] hover:bg-[var(--green)] hover:text-[var(--text-inv)] hover:shadow-[0_0_12px_rgba(0,255,136,0.3)]',
        destructive:
          'bg-transparent text-[var(--red)] border border-[var(--red-dim)] hover:bg-[var(--red-dim)] hover:text-white',
        outline:
          'bg-transparent text-[var(--text-2)] border border-[var(--border-2)] hover:border-[var(--green-mute)] hover:text-[var(--text)]',
        secondary:
          'bg-[var(--bg-3)] text-[var(--text-2)] border border-[var(--border-2)] hover:bg-[var(--bg-2)] hover:text-[var(--text)]',
        ghost:
          'bg-transparent text-[var(--text-3)] hover:bg-[var(--bg-2)] hover:text-[var(--text)] border border-transparent',
        link: 'bg-transparent text-[var(--green)] underline-offset-4 hover:underline border border-transparent',
        amber:
          'bg-transparent text-[var(--amber)] border border-[var(--amber-dim)] hover:bg-[var(--amber)] hover:text-[var(--text-inv)]',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
