import type { CSSProperties } from 'react'

import { cn } from '@/lib/utils'

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

/** Iniciales sobre fondo tinte azul — `.hl-avatar`. */
export function Avatar({ name, className, style }: { name: string; className?: string; style?: CSSProperties }) {
  return (
    <span className={cn('hl-avatar', className)} style={style}>
      {initials(name)}
    </span>
  )
}
