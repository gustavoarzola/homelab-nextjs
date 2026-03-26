'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Check, ChevronDown } from 'lucide-react'

type Option = { id: number; label: string }

type BaseProps = {
  options: Option[]
  placeholder?: string
  disabled?: boolean
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
    ? props.options.filter((o) => normalize(o.label).includes(normalize(query)))
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
  const displayValue = isSingleMode && !open ? selectedOptions[0]?.label : undefined

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Pills (multi mode only) */}
      {isMulti(props) && selectedOptions.length > 0 && (
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
          onFocus={() => setOpen(true)}
          placeholder={isSingleMode && selectedOptions.length > 0 ? '' : props.placeholder}
          disabled={props.disabled}
          className="flex-1 bg-transparent outline-none"
        />
        {displayValue && (
          <span
            className="absolute left-3 right-8 pointer-events-none text-sm truncate"
            style={{ color: 'var(--foreground)' }}
            title={displayValue}
          >
            {displayValue}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            if (isSingleMode) {
              e.stopPropagation()
              props.onChange(null)
            }
          }}
          disabled={props.disabled || selectedOptions.length === 0}
          className="h-4 w-4 shrink-0 flex items-center justify-center rounded hover:opacity-70 disabled:opacity-30 disabled:cursor-default"
          style={isSingleMode && selectedOptions.length > 0 ? { color: 'var(--muted-foreground)' } : { color: 'var(--muted-foreground)' }}
        >
          {isSingleMode && selectedOptions.length > 0 ? (
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
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border shadow-lg"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
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
