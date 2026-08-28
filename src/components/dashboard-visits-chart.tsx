'use client'

import { TrendingUp } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  XAxis,
  YAxis,
} from 'recharts'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

type Item = {
  date: string
  day: number
  label: string
  visits: number
}

type Props = {
  data: Item[]
  monthLabel: string
  year: number
  totalVisits: number
  peakVisits: number
  peakLabel: string
  averageVisits: number
}

const chartConfig = {
  visits: {
    label: 'Visitas',
    color: 'var(--brand-blue)',
  },
} satisfies ChartConfig

export function DashboardVisitsChart({
  data,
  monthLabel,
  year,
  totalVisits,
  peakVisits,
  peakLabel,
  averageVisits,
}: Props) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Visitas por día del mes</CardTitle>
            <CardDescription className="capitalize">
              {monthLabel} {year}
            </CardDescription>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <div style={{ borderRadius: 'var(--radius-full)', background: 'var(--color-surface-muted)', padding: '4px 12px', fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>
              Total: <span className="hl-tnum" style={{ fontWeight: 500, color: 'var(--color-fg)' }}>{totalVisits}</span>
            </div>
            <div style={{ borderRadius: 'var(--radius-full)', background: 'var(--color-surface-muted)', padding: '4px 12px', fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>
              Promedio: <span className="hl-tnum" style={{ fontWeight: 500, color: 'var(--color-fg)' }}>{averageVisits.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2 pb-4">
        <ChartContainer config={chartConfig} className="h-[160px] xl:h-[180px]">
          <AreaChart
            accessibilityLayer
            data={data}
            margin={{
              top: 12,
              left: 8,
              right: 12,
              bottom: 4,
            }}
          >
            <defs>
              <linearGradient id="fillVisits" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-visits)" stopOpacity={0.24} />
                <stop offset="100%" stopColor="var(--color-visits)" stopOpacity={0.06} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              width={28}
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              minTickGap={18}
              tickFormatter={(value) => value}
            />
            <ChartTooltip
              cursor={{ stroke: 'var(--brand-blue)', strokeWidth: 1, strokeOpacity: 0.18 }}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Area
              type="natural"
              dataKey="visits"
              fill="url(#fillVisits)"
              fillOpacity={1}
              stroke="none"
            />
            <Line
              dataKey="visits"
              type="natural"
              stroke="var(--color-visits)"
              strokeWidth={2.5}
              dot={{
                r: 4.5,
                fill: 'var(--background)',
                stroke: 'var(--color-visits)',
                strokeWidth: 2,
              }}
              activeDot={{
                r: 6,
                fill: 'var(--color-visits)',
                stroke: 'var(--background)',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-1" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, fontSize: 'var(--text-base)' }}>
        <div className="flex items-center gap-2" style={{ fontWeight: 500, lineHeight: 1 }}>
          Pico de {peakVisits} visitas en {peakLabel} <TrendingUp className="h-4 w-4" />
        </div>
        <div style={{ lineHeight: 1, color: 'var(--color-fg-muted)' }}>
          Evolución diaria del período seleccionado.
        </div>
      </CardFooter>
    </Card>
  )
}
