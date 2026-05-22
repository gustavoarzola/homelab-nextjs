'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Check, ChevronDown } from 'lucide-react'

type Option = { id: number; label: string; code?: string; tag?: { label: string; bg: string; color: string } }

type BaseProps = {
  options: Option[]
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  showPills?: boolean
}

type MultiProps = BaseProps & {
  mode?: 'multi'
  selected: number[]
  onChange: (ids: number[]) => void
}

type SingleProps = BaseProps & {
  mode: 'single'
  selected: number | null
  onChange: (id: number | null) => void
}

type Props = MultiProps | SingleProps

function isMulti(p: Props): p is MultiProps {
  return p.mode !== 'single'
}

export function SelectCombobox(props: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const normalize = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  const filtered = query.trim()
    ? props.options.filter((o) =>
        normalize(o.label).includes(normalize(query)) ||
        (o.code && normalize(o.code).includes(normalize(query)))
      )
    : props.options

  const selectedOptions = props.options.filter((o) => {
    if (isMulti(props)) {
      return props.selected.includes(o.id)
    } else {
      return o.id === props.selected
    }
  })

  const handleSelectMulti = (id: number) => {
    if (!isMulti(props)) return
    if (props.selected.includes(id)) {
      props.onChange(props.selected.filter((s) => s !== id))
    } else {
      props.onChange([...props.selected, id])
    }
    setQuery('')
  }

  const handleSelectSingle = (id: number) => {
    if (isMulti(props)) return
    props.onChange(id)
    setQuery('')
    setOpen(false)
  }

  const handleRemoveMulti = (id: number, e: React.MouseEvent) => {
    if (!isMulti(props)) return
    e.stopPropagation()
    props.onChange(props.selected.filter((s) => s !== id))
  }

  const handleRemoveSingle = (e: React.MouseEvent) => {
    if (isMulti(props)) return
    e.stopPropagation()
    props.onChange(null)
  }

  const isSingleMode = !isMulti(props)
  const isClearable = props.clearable ?? true
  const showPills = props.showPills ?? true
  const displayValue = isSingleMode && !open ? selectedOptions[0]?.label : undefined

  const openDropdown = () => {
    if (props.disabled) return
    setOpen(true)
  }

  return (
    <div ref={containerRef} className={`relative w-full${open ? ' z-[120]' : ''}`}>
      {/* Pills (multi mode only) */}
      {isMulti(props) && showPills && selectedOptions.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedOptions.map((o) => (
            <span
              key={o.id}
              className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
            >
              {o.label}
              <button
                type="button"
                onClick={(e) => handleRemoveMulti(o.id, e)}
                disabled={props.disabled}
                className="rounded hover:opacity-70 disabled:opacity-30"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm relative"
        style={{
          backgroundColor: 'var(--background)',
          border: '1px solid var(--input)',
          color: 'var(--foreground)',
          opacity: props.disabled ? 0.5 : 1,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={isSingleMode && !open ? '' : query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={openDropdown}
          onClick={openDropdown}
          placeholder=''
          disabled={props.disabled}
          className="flex-1 bg-transparent pr-6 outline-none"
        />
        {displayValue ? (
          <span
            className="absolute left-3 right-8 pointer-events-none text-sm truncate"
            style={{ color: 'var(--foreground)' }}
            title={displayValue}
          >
            {displayValue}
          </span>
        ) : !open && !query && props.placeholder && selectedOptions.length === 0 ? (
          <span
            className="absolute left-3 right-8 pointer-events-none text-sm truncate"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {props.placeholder}
          </span>
        ) : null}
        <button
          type="button"
          onClick={(e) => {
            if (isSingleMode && isClearable) {
              e.stopPropagation()
              props.onChange(null)
              return
            }

            e.stopPropagation()
            const nextOpen = !open
            setOpen(nextOpen)
            if (nextOpen) {
              requestAnimationFrame(() => {
                inputRef.current?.focus()
              })
            }
          }}
          disabled={props.disabled || (isSingleMode && isClearable && selectedOptions.length === 0)}
          className="absolute right-3 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded hover:opacity-70 disabled:opacity-30 disabled:cursor-default"
          style={isSingleMode && selectedOptions.length > 0 ? { color: 'var(--muted-foreground)' } : { color: 'var(--muted-foreground)' }}
        >
          {isSingleMode && isClearable && selectedOptions.length > 0 ? (
            <X className="h-4 w-4" />
          ) : (
            <ChevronDown
              className="h-4 w-4"
              style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
            />
          )}
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-[130] mt-1 w-full overflow-hidden rounded-lg border shadow-xl"
          style={{
            backgroundColor: 'oklch(1 0 0 / 1)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Sin resultados
            </div>
          ) : (
            <ul className="max-h-52 overflow-y-auto">
              {filtered.map((o) => {
                const isSelected = isMulti(props)
                  ? props.selected.includes(o.id)
                  : o.id === props.selected
                return (
                  <li
                    key={o.id}
                    onClick={() => {
                      if (isMulti(props)) {
                        handleSelectMulti(o.id)
                      } else {
                        handleSelectSingle(o.id)
                      }
                    }}
                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:opacity-80"
                    style={{
                      backgroundColor: isSelected ? 'var(--accent)' : undefined,
                      color: isSelected ? 'var(--accent-foreground)' : 'var(--foreground)',
                    }}
                  >
                    <Check
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ opacity: isSelected ? 1 : 0 }}
                    />
                    {o.code && (
                      <span
                        className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px]"
                        style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
                      >
                        {o.code}
                      </span>
                    )}
                    {o.tag && (
                      <span
                        className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium"
                        style={{ backgroundColor: o.tag.bg, color: o.tag.color }}
                      >
                        {o.tag.label}
                      </span>
                    )}
                    {o.label}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
