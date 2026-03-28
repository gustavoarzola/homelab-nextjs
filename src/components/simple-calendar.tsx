'use client'

import * as React from 'react'
import { DayPicker, getDefaultClassNames } from 'react-day-picker'
import { es } from 'date-fns/locale'

import { cn } from '@/lib/utils'

type SimpleCalendarProps = React.ComponentProps<typeof DayPicker>
const defaultClassNames = getDefaultClassNames()

export function SimpleCalendar({ className, ...props }: SimpleCalendarProps) {
  return (
    <div className={cn('inline-block', className)}>
      <div
        className={cn(
          'w-fit rounded-md border border-black/8 bg-background p-2 text-[0.78rem] shadow-sm',
          '[&_.rdp-day]:text-[0.78rem] [&_.rdp-day_button]:text-[0.78rem]',
          '[&_.rdp-range_start_.rdp-day_button]:rounded-full',
          '[&_.rdp-range_end_.rdp-day_button]:rounded-full',
          '[&_.rdp-weekday]:text-[0.72rem]',
        )}
        style={
          {
            '--rdp-day-width': '32px',
            '--rdp-day-height': '32px',
            '--rdp-day_button-width': '30px',
            '--rdp-day_button-height': '30px',
            '--rdp-nav_button-width': '1.65rem',
            '--rdp-nav_button-height': '1.65rem',
            '--rdp-nav-height': '2rem',
            '--rdp-weekday-padding': '0.15rem 0',
            '--rdp-months-gap': '1.5rem',
            '--rdp-selected-border': '0px solid transparent',
          } as React.CSSProperties
        }
      >
        <DayPicker
          showOutsideDays
          locale={es}
          classNames={{
            month_caption: cn(defaultClassNames.month_caption, 'justify-start pl-2'),
            caption_label: cn(defaultClassNames.caption_label, 'text-base font-semibold'),
          }}
          modifiersStyles={{
            selected: { fontSize: '0.78rem', fontWeight: 600 },
            range_start: { fontSize: '0.78rem', fontWeight: 600 },
            range_middle: { fontSize: '0.78rem', fontWeight: 600 },
            range_end: { fontSize: '0.78rem', fontWeight: 600 },
          }}
          modifiersClassNames={{
            today:
              'rounded-full bg-black/[0.06] font-medium text-black/80',
          }}
          {...props}
        />
      </div>
    </div>
  )
}
