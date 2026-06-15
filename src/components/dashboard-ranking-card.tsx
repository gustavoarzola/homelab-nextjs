'use client'

import { Building2, Stethoscope } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type RankingItem = {
  label: string
  visits: number
}

type Props = {
  title: string
  description: string
  items: RankingItem[]
  icon?: 'laboratory' | 'nurse'
}

export function DashboardRankingCard({
  title,
  description,
  items,
  icon = 'laboratory',
}: Props) {
  const maxVisits = Math.max(...items.map((item) => item.visits), 1)
  const Icon = icon === 'nurse' ? Stethoscope : Building2

  return (
    <Card
      className="border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_12px_30px_-20px_rgba(15,23,42,0.24)]"
      style={{ borderColor: 'var(--border)' }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(44,95,158,0.08)] text-[var(--primary)]">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="line-clamp-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-5">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/8 px-4 py-6 text-sm text-muted-foreground">
            No hay datos para este período.
          </div>
        ) : (
          items.map((item) => {
            const width = `${Math.max((item.visits / maxVisits) * 100, 10)}%`

            return (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <span className="min-w-0 flex-1 break-words text-sm font-medium text-foreground">
                    {item.label}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-sm text-muted-foreground">
                    {item.visits} visita{item.visits === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/[0.05]">
                  <div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, var(--brand-primary), var(--brand-primary-light))', width }}
                  />
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
