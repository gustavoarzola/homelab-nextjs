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
    color: '#2c5f9e',
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
    <Card
      className="border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_12px_30px_-20px_rgba(15,23,42,0.28)]"
      style={{ borderColor: 'var(--border)' }}
    >
      <CardHeader className="pb-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Visitas por día del mes</CardTitle>
            <CardDescription className="capitalize">
              {monthLabel} {year}
            </CardDescription>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <div className="rounded-full bg-black/[0.04] px-3 py-1 text-xs text-muted-foreground">
              Total: <span className="font-medium text-foreground">{totalVisits}</span>
            </div>
            <div className="rounded-full bg-black/[0.04] px-3 py-1 text-xs text-muted-foreground">
              Promedio: <span className="font-medium text-foreground">{averageVisits.toFixed(1)}</span>
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
            <CartesianGrid vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
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
              cursor={{ stroke: 'rgba(44, 95, 158, 0.18)', strokeWidth: 1 }}
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
                fill: '#f8fafc',
                stroke: 'var(--color-visits)',
                strokeWidth: 2,
              }}
              activeDot={{
                r: 6,
                fill: 'var(--color-visits)',
                stroke: '#f8fafc',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-1 border-t border-black/5 pt-3 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none text-foreground">
          Pico de {peakVisits} visitas en {peakLabel} <TrendingUp className="h-4 w-4" />
        </div>
        <div className="leading-none text-muted-foreground">
          Evolución diaria del período seleccionado.
        </div>
      </CardFooter>
    </Card>
  )
}
