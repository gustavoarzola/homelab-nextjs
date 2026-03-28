'use client'

import * as React from 'react'
import {
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

import { cn } from '@/lib/utils'

export type ChartConfig = Record<
  string,
  {
    label?: string
    color?: string
  }
>

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null)

export function ChartContainer({
  config,
  className,
  children,
}: {
  config: ChartConfig
  className?: string
  children: React.ReactNode
}) {
  const style = Object.fromEntries(
    Object.entries(config).flatMap(([key, value]) =>
      value.color ? [[`--color-${key}`, value.color]] : [],
    ),
  ) as React.CSSProperties

  return (
    <ChartContext.Provider value={{ config }}>
      <div className={cn('h-[360px] w-full', className)} style={style}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

export function ChartTooltip(props: React.ComponentProps<typeof Tooltip>) {
  return <Tooltip {...props} />
}

type ChartTooltipPayloadItem = {
  dataKey?: string | number
  name?: string
  color?: string
  value?: string | number
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  indicator = 'dot',
}: {
  active?: boolean
  payload?: ChartTooltipPayloadItem[]
  label?: string | number
  indicator?: 'dot' | 'line'
}) {
  const context = React.useContext(ChartContext)

  if (!active || !payload?.length) return null

  const uniquePayload = Array.from(
    new Map(
      payload.map((item) => [String(item.dataKey ?? item.name ?? ''), item]),
    ).values(),
  )

  return (
    <div className="min-w-[180px] rounded-xl border border-border bg-popover px-3 py-2.5 text-sm text-popover-foreground shadow-lg">
      {label ? (
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {String(label)}
        </div>
      ) : null}
      <div className="space-y-1.5">
        {uniquePayload.map((item) => {
          const key = String(item.dataKey)
          const labelText = context?.config[key]?.label ?? item.name ?? key
          const color = item.color ?? context?.config[key]?.color ?? 'currentColor'

          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    indicator === 'line' ? 'h-0.5 w-3 rounded-full' : 'h-2 w-2 rounded-full',
                  )}
                  style={{ backgroundColor: color }}
                />
                <span className="text-muted-foreground">{labelText}</span>
              </div>
              <span className="font-medium text-foreground">
                {item.value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
