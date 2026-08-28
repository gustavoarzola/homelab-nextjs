import type { ReactNode } from 'react'
import { Check, X } from 'lucide-react'

import { cn } from '@/lib/utils'

export type TimelineItem = {
  label: ReactNode
  detail?: ReactNode
  status: 'done' | 'todo' | 'bad'
}

/** Historial de hitos — `.hl-timeline`. */
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <div className="hl-timeline">
      {items.map((item, i) => (
        <div className="hl-tl" key={i}>
          <span className={cn('hl-tl__dot', item.status === 'todo' && 'is-todo', item.status === 'bad' && 'is-bad')}>
            {item.status === 'done' && <Check />}
            {item.status === 'bad' && <X />}
          </span>
          <div className="hl-tl__body">
            <b style={item.status === 'todo' ? { color: 'var(--color-fg-muted)', fontWeight: 400 } : undefined}>{item.label}</b>
            {item.detail && <span>{item.detail}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
