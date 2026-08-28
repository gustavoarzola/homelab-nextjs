import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type TagTone = 'blue' | 'green' | 'amber' | 'violet' | 'red' | 'teal' | 'neutral'

type TagProps = {
  tone?: TagTone
  noDot?: boolean
  children: ReactNode
  className?: string
}

export function Tag({ tone = 'neutral', noDot, children, className }: TagProps) {
  return (
    <span className={cn('hl-tag', tone !== 'neutral' && `t-${tone}`, noDot && 'no-dot', className)}>
      {children}
    </span>
  )
}
