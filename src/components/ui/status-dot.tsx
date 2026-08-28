import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Activo/inactivo sobrio (alternativa a badge) — `.hl-dot`. */
export function StatusDot({ active, children, className }: { active: boolean; children: ReactNode; className?: string }) {
  return <span className={cn('hl-dot', !active && 'is-off', className)}>{children}</span>
}
