'use client'

import * as React from 'react'
import { CalendarIcon } from 'lucide-react'
import { type DayPickerProps } from 'react-day-picker'

import { SimpleCalendar } from '@/components/simple-calendar'
import { ControlTrigger } from '@/components/ui/control-trigger'
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
        <ControlTrigger
          disabled={disabled}
          icon={<CalendarIcon className="hl-affix" />}
          label={placeholder}
          isPlaceholder
          className={className}
        />
      </PopoverTrigger>
      <PopoverContent
        className="w-auto border-0 bg-transparent p-0 shadow-none"
        align="start"
        side="bottom"
        sideOffset={6}
        collisionPadding={8}
      >
        <SimpleCalendar className={calendarClassName} {...calendarProps} />
      </PopoverContent>
    </Popover>
  )
}
