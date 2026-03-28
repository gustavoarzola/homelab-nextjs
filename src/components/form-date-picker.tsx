'use client'

import * as React from 'react'
import { CalendarIcon } from 'lucide-react'
import { type DateRange, type DayPickerProps } from 'react-day-picker'

import { formatDate, parseDateLocal } from '@/lib/format'
import { cn } from '@/lib/utils'
import { SimpleCalendar } from '@/components/simple-calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type CommonProps = {
  placeholder?: string
  className?: string
  disabled?: boolean
  calendarClassName?: string
}

type SharedCalendarProps = {
  animate?: DayPickerProps['animate']
  locale?: DayPickerProps['locale']
  weekStartsOn?: DayPickerProps['weekStartsOn']
  today?: DayPickerProps['today']
  showOutsideDays?: DayPickerProps['showOutsideDays']
  defaultMonth?: DayPickerProps['defaultMonth']
  fromMonth?: DayPickerProps['fromMonth']
  toMonth?: DayPickerProps['toMonth']
  numberOfMonths?: DayPickerProps['numberOfMonths']
  fixedWeeks?: DayPickerProps['fixedWeeks']
  disabledDays?: DayPickerProps['disabled']
}

type SingleFormDatePickerProps = CommonProps &
  SharedCalendarProps & {
    mode: 'single'
    value?: string
    onChange?: (value: string | undefined) => void
    name?: string
  }

type RangeFormValue = {
  from?: string
  to?: string
}

type RangeFormDatePickerProps = CommonProps &
  SharedCalendarProps & {
    mode: 'range'
    value?: RangeFormValue
    onChange?: (value: RangeFormValue | undefined) => void
    nameFrom?: string
    nameTo?: string
  }

export type FormDatePickerProps =
  | SingleFormDatePickerProps
  | RangeFormDatePickerProps

function toDate(value?: string): Date | undefined {
  return value ? parseDateLocal(value) : undefined
}

function toFormValue(date?: Date): string | undefined {
  if (!date) return undefined
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function atStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isSameDay(left: Date, right: Date) {
  return atStartOfDay(left).getTime() === atStartOfDay(right).getTime()
}

function isBeforeDay(left: Date, right: Date) {
  return atStartOfDay(left).getTime() < atStartOfDay(right).getTime()
}

function isAfterDay(left: Date, right: Date) {
  return atStartOfDay(left).getTime() > atStartOfDay(right).getTime()
}

function getSingleLabel(value: string | undefined, placeholder: string) {
  return value ? formatDate(value) : placeholder
}

function getRangeLabel(value: RangeFormValue | undefined, placeholder: string) {
  if (!value?.from) return placeholder
  if (!value.to) return formatDate(value.from)
  return `${formatDate(value.from)} → ${formatDate(value.to)}`
}

export function FormDatePicker(props: FormDatePickerProps) {
  const {
    placeholder = props.mode === 'range' ? 'Seleccionar rango' : 'Seleccionar fecha',
    className,
    disabled = false,
    calendarClassName,
    ...calendarProps
  } = props

  const [open, setOpen] = React.useState(false)

  if (props.mode === 'single') {
    const selected = toDate(props.value)
    const label = getSingleLabel(props.value, placeholder)

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              'flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm shadow-xs',
              props.value ? 'text-foreground' : 'text-muted-foreground',
              'disabled:cursor-not-allowed disabled:opacity-50',
              className,
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto border-0 bg-transparent p-0 shadow-none"
          align="start"
          side="bottom"
          sideOffset={6}
          avoidCollisions={false}
        >
          <SimpleCalendar
            className={calendarClassName}
            mode="single"
            selected={selected}
            animate={calendarProps.animate}
            locale={calendarProps.locale}
            weekStartsOn={calendarProps.weekStartsOn}
            today={calendarProps.today}
            showOutsideDays={calendarProps.showOutsideDays}
            defaultMonth={calendarProps.defaultMonth}
            fromMonth={calendarProps.fromMonth}
            toMonth={calendarProps.toMonth}
            numberOfMonths={calendarProps.numberOfMonths}
            fixedWeeks={calendarProps.fixedWeeks ?? true}
            disabled={calendarProps.disabledDays}
            onSelect={(date) => {
              const nextValue = toFormValue(date)
              props.onChange?.(nextValue)
              if (date) setOpen(false)
            }}
          />
        </PopoverContent>
        {props.name ? <input type="hidden" name={props.name} value={props.value ?? ''} /> : null}
      </Popover>
    )
  }

  const selectedRange: DateRange | undefined =
    props.value?.from || props.value?.to
      ? {
          from: toDate(props.value?.from),
          to: toDate(props.value?.to),
        }
      : undefined

  const label = getRangeLabel(props.value, placeholder)
  const selectedDates = [selectedRange?.from, selectedRange?.to].filter(Boolean) as Date[]

  const rangeModifiers = {
    selected: selectedDates,
    range_start: selectedRange?.from,
    range_end: selectedRange?.to,
    range_middle:
      selectedRange?.from && selectedRange?.to
        ? (date: Date) =>
            isAfterDay(date, selectedRange.from!) && isBeforeDay(date, selectedRange.to!)
        : undefined,
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm shadow-xs',
            props.value?.from ? 'text-foreground' : 'text-muted-foreground',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto border-0 bg-transparent p-0 shadow-none"
        align="start"
        side="bottom"
        sideOffset={6}
        avoidCollisions={false}
      >
        <SimpleCalendar
          className={calendarClassName}
          animate={calendarProps.animate}
          locale={calendarProps.locale}
          weekStartsOn={calendarProps.weekStartsOn}
          today={calendarProps.today}
          showOutsideDays={calendarProps.showOutsideDays}
          defaultMonth={calendarProps.defaultMonth}
          fromMonth={calendarProps.fromMonth}
          toMonth={calendarProps.toMonth}
          numberOfMonths={calendarProps.numberOfMonths}
          fixedWeeks={calendarProps.fixedWeeks ?? true}
          disabled={calendarProps.disabledDays}
          modifiers={rangeModifiers}
          onDayClick={(day, modifiers) => {
            if (modifiers.disabled || modifiers.hidden) return

            if (!selectedRange?.from || (selectedRange.from && selectedRange.to)) {
              props.onChange?.({ from: toFormValue(day), to: undefined })
              return
            }

            const from = selectedRange.from
            if (isBeforeDay(day, from)) {
              props.onChange?.({ from: toFormValue(day), to: undefined })
              return
            }

            const nextValue = {
              from: toFormValue(from),
              to: toFormValue(day),
            }

            props.onChange?.(nextValue)
            if (day && (isSameDay(day, from) || isAfterDay(day, from))) {
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
      {props.nameFrom ? <input type="hidden" name={props.nameFrom} value={props.value?.from ?? ''} /> : null}
      {props.nameTo ? <input type="hidden" name={props.nameTo} value={props.value?.to ?? ''} /> : null}
    </Popover>
  )
}
