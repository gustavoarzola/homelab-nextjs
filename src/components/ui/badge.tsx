import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type BadgeProps = {
  badgeClass: string
  children: ReactNode
  className?: string
}

/** Badge de estado. `badgeClass` es una de las `is-*` de `.hl-badge` (ver estado-colors.ts). */
export function Badge({ badgeClass, children, className }: BadgeProps) {
  return <span className={cn('hl-badge', badgeClass, className)}>{children}</span>
}
