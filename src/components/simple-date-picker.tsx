'use client'

import * as React from 'react'
import { CalendarIcon } from 'lucide-react'
import { type DayPickerProps } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { SimpleCalendar } from '@/components/simple-calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type SimpleDatePickerProps = {
  placeholder?: string
  className?: string
  disabled?: boolean
  calendarClassName?: string
} & DayPickerProps

export function SimpleDatePicker({
  placeholder = 'Seleccionar fecha',
  className,
  disabled = false,
  calendarClassName,
  ...calendarProps
}: SimpleDatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground shadow-xs',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto border-0 bg-transparent p-0 shadow-none"
        align="start"
        side="bottom"
        sideOffset={6}
        avoidCollisions={false}
      >
        <SimpleCalendar className={calendarClassName} {...calendarProps} />
      </PopoverContent>
    </Popover>
  )
}
