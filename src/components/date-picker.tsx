'use client'

import * as React from 'react'
import { addDays, format, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker, getDefaultClassNames, type DateRange } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const defaultClassNames = getDefaultClassNames()

const calendarStyles = {
  root: cn(defaultClassNames.root, 'w-fit bg-background p-1.5 text-xs'),
  months: cn(defaultClassNames.months, 'relative w-fit'),
  month: cn(defaultClassNames.month, 'w-fit space-y-1.5 pt-6'),
  month_caption: cn(
    defaultClassNames.month_caption,
    'flex h-6 items-center justify-center px-6 pointer-events-none',
  ),
  caption_label: cn(defaultClassNames.caption_label, 'text-xs font-medium'),
  nav: cn(
    defaultClassNames.nav,
    'absolute inset-x-1 top-1 z-10 flex items-center justify-between',
  ),
  button_previous: cn(
    defaultClassNames.button_previous,
    'pointer-events-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  ),
  button_next: cn(
    defaultClassNames.button_next,
    'pointer-events-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  ),
  month_grid: cn(defaultClassNames.month_grid, 'w-fit border-collapse'),
  weekdays: cn(defaultClassNames.weekdays),
  weekday: cn(defaultClassNames.weekday, 'h-7 w-8 px-0 text-[11px] font-normal text-muted-foreground'),
  week: cn(defaultClassNames.week),
  day: cn(defaultClassNames.day, 'h-8 w-8 p-0 text-xs'),
  day_button: cn(
    defaultClassNames.day_button,
    'h-8 w-8 rounded-md p-0 text-xs font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground',
  ),
  selected: cn(
    defaultClassNames.selected,
    'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
  ),
  today: cn(defaultClassNames.today, 'bg-accent text-accent-foreground'),
  outside: cn(defaultClassNames.outside, 'text-muted-foreground opacity-50'),
  disabled: cn(defaultClassNames.disabled, 'text-muted-foreground opacity-50'),
  hidden: cn(defaultClassNames.hidden, 'invisible'),
  range_start: cn(
    defaultClassNames.range_start,
    'bg-primary text-primary-foreground rounded-l-md rounded-r-none hover:bg-primary hover:text-primary-foreground',
  ),
  range_middle: cn(defaultClassNames.range_middle, 'bg-accent text-accent-foreground rounded-none'),
  range_end: cn(
    defaultClassNames.range_end,
    'bg-primary text-primary-foreground rounded-r-md rounded-l-none hover:bg-primary hover:text-primary-foreground',
  ),
} as const

const calendarComponents = {
  Chevron: ({
    orientation,
    className,
    size = 16,
  }: {
    orientation?: 'left' | 'right' | 'up' | 'down'
    className?: string
    size?: number
  }) =>
    orientation === 'left' || orientation === 'up' ? (
      <ChevronLeft className={cn('h-4 w-4', className)} size={size} />
    ) : (
      <ChevronRight className={cn('h-4 w-4', className)} size={size} />
    ),
}

const rangePresets = [
  { label: 'Hoy', days: 0 },
  { label: 'Ayer', days: 1 },
  { label: 'Últimos 3 días', days: 2 },
  { label: 'Últimos 7 días', days: 6 },
  { label: 'Últimos 15 días', days: 14 },
  { label: 'Últimos 30 días', days: 29 },
] as const

// ─── DatePicker (single) ──────────────────────────────────────────────────────

type DatePickerProps = {
  value: Date | undefined
  onChange: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  disabled = false,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, 'PPP', { locale: es }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[60] w-auto border-border bg-background p-0 shadow-xl opacity-100"
        align="start"
      >
        <DayPicker
          mode="single"
          locale={es}
          showOutsideDays
          selected={value}
          onSelect={(date) => {
            onChange(date)
            if (date) setOpen(false)
          }}
          defaultMonth={value}
          classNames={calendarStyles}
          components={calendarComponents}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

// ─── DateRangePicker ──────────────────────────────────────────────────────────

type DateRangePickerProps = {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Seleccionar período',
  disabled = false,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const today = React.useMemo(() => startOfDay(new Date()), [])
  const [month, setMonth] = React.useState<Date>(value?.from ?? today)

  React.useEffect(() => {
    if (value?.from) setMonth(value.from)
  }, [value?.from])

  const selectedPreset = React.useMemo(() => {
    if (!value?.from || !value.to) return null
    const from = startOfDay(value.from)
    const to = startOfDay(value.to)

    return rangePresets.find((preset) => {
      if (preset.days === 1) {
        const yesterday = addDays(today, -1)
        return from.getTime() === yesterday.getTime() && to.getTime() === yesterday.getTime()
      }
      const start = addDays(today, -preset.days)
      return from.getTime() === start.getTime() && to.getTime() === today.getTime()
    })?.label
  }, [today, value?.from, value?.to])

  const label = value?.from
    ? value.to
      ? `${format(value.from, 'dd MMM y', { locale: es })} → ${format(value.to, 'dd MMM y', { locale: es })}`
      : format(value.from, 'dd MMM y', { locale: es })
    : placeholder

  const applyPreset = (days: number) => {
    if (days === 1) {
      const yesterday = addDays(today, -1)
      onChange({ from: yesterday, to: yesterday })
      setMonth(yesterday)
      setOpen(false)
      return
    }
    const from = addDays(today, -days)
    onChange({ from, to: today })
    setMonth(from)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'justify-start text-left font-normal',
            !value?.from && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[60] w-auto border-border bg-background p-0 shadow-xl opacity-100"
        align="start"
      >
        <div className="inline-flex max-w-[90vw] items-start overflow-hidden rounded-md bg-background">
          <div className="w-28 border-r bg-muted/30 p-1">
            <div className="flex flex-col gap-1">
              {rangePresets.map((preset) => (
                <Button
                  key={preset.label}
                  variant={selectedPreset === preset.label ? 'secondary' : 'ghost'}
                  className="h-6 justify-start px-1.5 text-[11px]"
                  onClick={() => applyPreset(preset.days)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
          <DayPicker
            mode="range"
            min={1}
            locale={es}
            showOutsideDays
            selected={value}
            onSelect={(nextRange) => {
              onChange(nextRange)
              if (nextRange?.from && nextRange.to) setOpen(false)
            }}
            month={month}
            onMonthChange={setMonth}
            numberOfMonths={1}
            classNames={calendarStyles}
            components={calendarComponents}
            className="shrink-0"
            autoFocus
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
