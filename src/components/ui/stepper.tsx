import type { ReactNode } from 'react'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

type StepStatus = 'done' | 'active' | 'todo' | 'bad'

/** Un nodo del stepper de ciclo de vida — se compone dentro de `.hl-stepper`. */
export function Step({ status, children }: { status: StepStatus; children: ReactNode }) {
  return (
    <div className={cn('hl-step', `is-${status}`)}>
      <span className="hl-step__dot">{status === 'done' && <Check />}</span>
      <span className="hl-step__label">{children}</span>
    </div>
  )
}

/** Conector entre steps — `filled` cuando el tramo ya se completó. */
export function Pipe({ filled }: { filled?: boolean }) {
  return <span className={cn('hl-pipe', filled && 'is-filled')} />
}
