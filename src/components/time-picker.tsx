'use client'

import { useState, useRef, useEffect } from 'react'
import { Clock } from 'lucide-react'

// ─── Config ───────────────────────────────────────────────────────────────────

const START_HOUR = 7
const END_HOUR = 22
const INTERVAL_MINUTES = 30

// ─── Slots ────────────────────────────────────────────────────────────────────

function generateSlots(): string[] {
  const slots: string[] = []
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    for (let m = 0; m < 60; m += INTERVAL_MINUTES) {
      if (h === END_HOUR && m > 0) break
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return slots
}

const SLOTS = generateSlots()

// ─── TimePicker ───────────────────────────────────────────────────────────────

type TimePickerProps = {
  value: string | null
  onChange: (time: string | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function TimePicker({
  value,
  onChange,
  placeholder = 'Seleccionar hora',
  disabled = false,
  className,
}: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Scroll selected slot into view when popover opens
  useEffect(() => {
    if (open && selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest' })
    }
  }, [open])

  return (
    <div ref={ref} className={`relative inline-block${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: 'var(--background)',
          border: '1px solid var(--input)',
          color: value ? 'var(--foreground)' : 'var(--muted-foreground)',
        }}
      >
        <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
        <span className="flex-1 text-left">{value ?? placeholder}</span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1.5 rounded-2xl border shadow-lg"
          style={{
            backgroundColor: 'var(--popover)',
            borderColor: 'var(--border)',
            color: 'var(--popover-foreground)',
            width: '140px',
          }}
        >
          <div className="flex flex-col py-1.5" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {/* Clear option */}
            <button
              ref={value === null ? selectedRef : undefined}
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              className="mx-1.5 rounded-xl px-3 py-1.5 text-sm text-left transition-colors hover:bg-[var(--muted)] cursor-pointer"
              style={{
                color: value === null ? 'var(--primary)' : 'var(--muted-foreground)',
                fontWeight: value === null ? 500 : undefined,
              }}
            >
              Sin hora
            </button>

            {/* Divider */}
            <div className="my-1 mx-3 border-t" style={{ borderColor: 'var(--border)' }} />

            {/* Slots */}
            {SLOTS.map((slot) => {
              const isSelected = slot === value
              return (
                <button
                  key={slot}
                  ref={isSelected ? selectedRef : undefined}
                  type="button"
                  onClick={() => { onChange(slot); setOpen(false) }}
                  className="mx-1.5 rounded-xl px-3 py-1.5 text-sm text-left transition-colors cursor-pointer"
                  style={
                    isSelected
                      ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }
                      : { color: 'var(--foreground)' }
                  }
                  onMouseEnter={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--muted)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = ''
                  }}
                >
                  {slot}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
