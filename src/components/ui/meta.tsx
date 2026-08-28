import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Grid de fichas label/valor — `.hl-metagrid` + `.hl-meta`. */
export function MetaGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('hl-metagrid', className)}>{children}</dl>
}

export function MetaTile({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn('hl-meta', className)}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
