'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Clock } from 'lucide-react'

import { ControlTrigger } from '@/components/ui/control-trigger'

// ─── Config ───────────────────────────────────────────────────────────────────

const START_HOUR = 7
const END_HOUR = 22
const INTERVAL_MINUTES = 30
const DROPDOWN_WIDTH = 140
const DROPDOWN_MAX_HEIGHT = 300

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

type DropdownPos = { top?: number; bottom?: number; left: number }

export function TimePicker({
  value,
  onChange,
  placeholder = 'Seleccionar hora',
  disabled = false,
  className,
}: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<DropdownPos>({ top: 0, left: 0 })
  const [mounted, setMounted] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { setMounted(true) }, [])

  // El dropdown se porta a document.body (position: fixed) en vez de vivir como
  // hijo normal del trigger: `.fcard` (contenedor del form) tiene `overflow:
  // hidden` para redondear sus esquinas, y clipeaba el dropdown al vuelo. Mismo
  // patrón que ya usa SelectCombobox.
  const updatePos = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const spaceBelow = window.innerHeight - rect.bottom
    if (spaceBelow >= DROPDOWN_MAX_HEIGHT || spaceBelow >= rect.top) {
      setPos({ top: rect.bottom + 6, left: rect.left })
    } else {
      setPos({ bottom: window.innerHeight - rect.top + 6, left: rect.left })
    }
  }, [])

  useEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open, updatePos])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      const inContainer = containerRef.current?.contains(target)
      const inDropdown = dropdownRef.current?.contains(target)
      if (!inContainer && !inDropdown) setOpen(false)
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

  const dropdown = open && mounted ? createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-50 rounded-2xl border shadow-lg"
      style={{
        ...(pos.top !== undefined ? { top: pos.top } : { bottom: pos.bottom }),
        left: pos.left,
        width: DROPDOWN_WIDTH,
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-fg)',
      }}
    >
      <div className="flex flex-col py-1.5" style={{ maxHeight: DROPDOWN_MAX_HEIGHT, overflowY: 'auto' }}>
        {/* Clear option */}
        <button
          ref={value === null ? selectedRef : undefined}
          type="button"
          onClick={() => { onChange(null); setOpen(false) }}
          className="mx-1.5 rounded-xl px-3 py-1.5 text-sm text-left transition-colors hover:bg-[var(--color-surface-muted)] cursor-pointer"
          style={{
            color: value === null ? 'var(--color-primary)' : 'var(--color-fg-muted)',
            fontWeight: value === null ? 500 : undefined,
          }}
        >
          Sin hora
        </button>

        {/* Divider */}
        <div className="my-1 mx-3 border-t" style={{ borderColor: 'var(--color-border)' }} />

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
                  ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-fg)' }
                  : { color: 'var(--color-fg)' }
              }
              onMouseEnter={(e) => {
                if (!isSelected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-surface-muted)'
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
    </div>,
    document.body,
  ) : null

  return (
    <div ref={containerRef} className={`relative inline-block${className ? ` ${className}` : ''}`}>
      <ControlTrigger
        ref={triggerRef}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        icon={<Clock className="hl-affix" />}
        label={value ?? placeholder}
        isPlaceholder={!value}
        className="transition-colors hover:opacity-80"
      />

      {dropdown}
    </div>
  )
}
