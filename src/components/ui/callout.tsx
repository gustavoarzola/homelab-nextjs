import type { ReactNode } from 'react'
import { Info, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

type CalloutTone = 'info' | 'warn' | 'ok' | 'bad'

const ICONS: Record<CalloutTone, typeof Info> = {
  info: Info,
  warn: AlertCircle,
  ok: CheckCircle2,
  bad: XCircle,
}

type CalloutProps = {
  tone?: CalloutTone
  icon?: boolean
  children: ReactNode
  className?: string
}

/** Aviso contextual — `.hl-callout--info/warn/ok/bad`. */
export function Callout({ tone = 'info', icon = true, children, className }: CalloutProps) {
  const Icon = ICONS[tone]
  return (
    <div className={cn('hl-callout', `hl-callout--${tone}`, className)}>
      {icon && <Icon />}
      <div>{children}</div>
    </div>
  )
}
