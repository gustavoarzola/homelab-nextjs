import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type FieldGroupProps = {
  label: ReactNode
  htmlFor?: string
  required?: boolean
  hint?: ReactNode
  children: ReactNode
  className?: string
}

export function FieldGroup({ label, htmlFor, required, hint, children, className }: FieldGroupProps) {
  return (
    <div className={cn('hl-fieldgroup', className)}>
      <label htmlFor={htmlFor}>
        {label} {required && <span className="req">*</span>}
      </label>
      {children}
      {hint && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>{hint}</span>}
    </div>
  )
}

export function FieldRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('hl-row2', className)}>{children}</div>
}
