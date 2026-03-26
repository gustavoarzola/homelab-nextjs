'use client'

import * as React from 'react'
import { addDays, format, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker, type DateRange } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const calendarStyles = {
  root: 'p-3',
  month: 'space-y-3',
  month_caption: 'flex justify-center relative items-center',
  caption_label: 'text-sm font-medium',
  nav: 'flex items-center gap-1',
  button_previous:
    'absolute left-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  button_next:
    'absolute right-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  month_grid: 'w-full border-collapse',
  weekdays: 'flex',
  weekday: 'w-9 text-[0.8rem] font-normal text-muted-foreground',
  week: 'mt-2 flex w-full',
  day: 'h-9 w-9 p-0 text-sm',
  day_button:
    'h-9 w-9 rounded-md p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground',
  selected:
    'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
  today: 'bg-accent text-accent-foreground',
  outside: 'text-muted-foreground opacity-50',
  disabled: 'text-muted-foreground opacity-50',
  hidden: 'invisible',
  range_start:
    'bg-primary text-primary-foreground rounded-l-md rounded-r-none hover:bg-primary hover:text-primary-foreground',
  range_middle: 'bg-accent text-accent-foreground rounded-none',
  range_end:
    'bg-primary text-primary-foreground rounded-r-md rounded-l-none hover:bg-primary hover:text-primary-foreground',
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
      <PopoverContent className="w-auto p-0" align="start">
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
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex w-[520px] max-w-[90vw] overflow-hidden rounded-md bg-popover">
          <div className="w-44 border-r bg-muted/40 p-2">
            <div className="flex flex-col gap-1">
              {rangePresets.map((preset) => (
                <Button
                  key={preset.label}
                  variant={selectedPreset === preset.label ? 'secondary' : 'ghost'}
                  className="h-9 justify-start px-3"
                  onClick={() => applyPreset(preset.days)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
          <DayPicker
            mode="range"
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
            autoFocus
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
