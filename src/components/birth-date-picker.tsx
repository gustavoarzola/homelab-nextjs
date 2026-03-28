'use client'

import * as React from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { SelectCombobox } from '@/components/select-combobox'

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function parseDateParts(value?: string) {
  if (!value) return { day: '', month: '', year: '' }

  const [year, month, day] = value.split('-')

  return {
    day: day ?? '',
    month: month ?? '',
    year: year ?? '',
  }
}

function getDaysInMonth(year: string, month: string) {
  const yearNumber = Number(year)
  const monthNumber = Number(month)

  if (!yearNumber || !monthNumber) return 31

  return new Date(yearNumber, monthNumber, 0).getDate()
}

function toFormValue(day: string, month: string, year: string) {
  if (!day || !month || !year) return ''

  const dayNumber = Number(day)
  const monthNumber = Number(month)
  const yearNumber = Number(year)

  if (!dayNumber || !monthNumber || !yearNumber) return ''

  const maxDays = getDaysInMonth(year, month)
  if (dayNumber > maxDays) return ''

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

type BirthDatePickerProps = {
  value?: string
  onChange?: (value: string | undefined) => void
  name?: string
  disabled?: boolean
  className?: string
  fromYear?: number
  toYear?: number
}

export function BirthDatePicker({
  value,
  onChange,
  name,
  disabled = false,
  className,
  fromYear = 1900,
  toYear = new Date().getFullYear(),
}: BirthDatePickerProps) {
  const initialParts = React.useMemo(() => parseDateParts(value), [value])
  const [day, setDay] = React.useState(initialParts.day)
  const [month, setMonth] = React.useState(initialParts.month)
  const [year, setYear] = React.useState(initialParts.year)

  React.useEffect(() => {
    const nextParts = parseDateParts(value)
    setDay(nextParts.day)
    setMonth(nextParts.month)
    setYear(nextParts.year)
  }, [value])

  React.useEffect(() => {
    const maxDays = getDaysInMonth(year, month)
    if (day && Number(day) > maxDays) {
      setDay('')
      onChange?.(undefined)
    }
  }, [day, month, year, onChange])

  const formValue = React.useMemo(() => toFormValue(day, month, year), [day, month, year])

  React.useEffect(() => {
    onChange?.(formValue || undefined)
  }, [formValue, onChange])

  const years = React.useMemo(() => {
    const items: { id: number; label: string }[] = []
    for (let current = toYear; current >= fromYear; current -= 1) {
      items.push({ id: current, label: String(current) })
    }
    return items
  }, [fromYear, toYear])

  const maxDays = getDaysInMonth(year, month)
  const days = Array.from({ length: maxDays }, (_, index) => {
    const value = index + 1
    return { id: value, label: String(value).padStart(2, '0') }
  })
  const months = MONTHS.map((item, index) => ({
    id: index + 1,
    label: item,
  }))

  const selectedDay = day ? Number(day) : null
  const selectedMonth = month ? Number(month) : null
  const selectedYear = year ? Number(year) : null
  const hasValue = Boolean(day || month || year)

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="grid grid-cols-[minmax(0,88px)_minmax(0,1fr)_minmax(0,104px)_auto] gap-2">
        <div className="min-w-0">
          <SelectCombobox
            mode="single"
            options={days}
            selected={selectedDay}
            onChange={(value) => setDay(value ? String(value).padStart(2, '0') : '')}
            placeholder="Día"
            disabled={disabled}
            clearable={false}
          />
        </div>

        <div className="min-w-0">
          <SelectCombobox
            mode="single"
            options={months}
            selected={selectedMonth}
            onChange={(value) => setMonth(value ? String(value).padStart(2, '0') : '')}
            placeholder="Mes"
            disabled={disabled}
            clearable={false}
          />
        </div>

        <div className="min-w-0">
          <SelectCombobox
            mode="single"
            options={years}
            selected={selectedYear}
            onChange={(value) => setYear(value ? String(value) : '')}
            placeholder="Año"
            disabled={disabled}
            clearable={false}
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setDay('')
            setMonth('')
            setYear('')
          }}
          disabled={disabled || !hasValue}
          className="flex h-10 w-8 items-center justify-center text-muted-foreground transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Limpiar fecha de nacimiento"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {name ? <input type="hidden" name={name} value={formValue} /> : null}
    </div>
  )
}
