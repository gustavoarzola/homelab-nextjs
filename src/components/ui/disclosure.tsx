import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

type DisclosureProps = {
  summary: ReactNode
  icon?: ReactNode
  danger?: boolean
  open?: boolean
  children: ReactNode
  className?: string
}

/** Acción secundaria/destructiva que se despliega en su lugar — `.hl-disclosure`. */
export function Disclosure({ summary, icon, danger, open, children, className }: DisclosureProps) {
  return (
    <details className={cn('hl-disclosure', danger && 'hl-disclosure--danger', className)} open={open}>
      <summary>
        {icon}
        {summary}
        <span className="chev">
          <ChevronDown />
        </span>
      </summary>
      <div className="hl-disclosure__body">{children}</div>
    </details>
  )
}
