import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Código en fuente mono (SKUs, RUT, IDs) — `.hl-chip`. */
export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('hl-chip', className)}>{children}</span>
}
