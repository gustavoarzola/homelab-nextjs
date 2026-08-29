'use client'

// ============================================================================
// Primitivos compartidos de la sección "Servicios" (y piezas afines) de los
// formularios de visita y cotización.
// ----------------------------------------------------------------------------
// Extraídos de `visita-form.tsx` (paso 07 del plan de migración al DS, que
// había quedado mejor implementado que `cotizacion-form.tsx`, paso 08) para
// que ambos formularios rendericen exactamente lo mismo — ver
// docs/plan-design-system/13-homologacion-formularios.md. Son puramente
// presentacionales: cada formulario sigue dueño de su propio estado
// (selección, mapas de descuento/precio) y les pasa callbacks.
// ============================================================================

import type { ReactNode, ComponentType } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'

export const CLP = (n: number) => '$' + (n || 0).toLocaleString('es-CL')

// ─── ServiceTabs ────────────────────────────────────────────────────────────
// Strip de tabs "Procedimientos / Exámenes / Talleres" — `.ed-tabs`.

export function ServiceTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; count: number; hasWarning?: boolean; Icon: ComponentType<{ style?: React.CSSProperties }> }[]
  active: T
  onChange: (id: T) => void
}) {
  return (
    <div className="ed-tabs">
      {tabs.map(({ id, label, count, hasWarning, Icon: TabIcon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-selected={active === id}
          style={{ position: 'relative' }}
        >
          <TabIcon style={{ width: 14, height: 14 }} />
          {label}
          {count > 0 && <span className="count">{count}</span>}
          {hasWarning && active !== id && <span className="ed-tab-dot" />}
        </button>
      ))}
    </div>
  )
}

// ─── ServiceItems / ServiceItem ─────────────────────────────────────────────
// Lista de ítems seleccionados (procedimiento/examen/taller/recargo) — `.ed-items`/`.ed-item*`.

export function ServiceItems({ children }: { children: ReactNode }) {
  return <div className="ed-items">{children}</div>
}

export function ServiceItem({
  codigo,
  nombre,
  warning,
  price,
  children,
  onRemove,
  disabled,
}: {
  /** Código de catálogo (Chip). Si se omite, `nombre` ocupa todo el ancho — patrón de recargos. */
  codigo?: string
  nombre: string
  /** Ícono/aviso junto al nombre (p.ej. deriva de precio en visitas). */
  warning?: ReactNode
  /** Precio a mostrar — puede incluir un `<s>` con el precio tachado antes del neto. */
  price: ReactNode
  /** Input de descuento/precio propio del ítem (`DiscountInput`/`PriceInput`). */
  children?: ReactNode
  onRemove: () => void
  disabled?: boolean
}) {
  return (
    <div className="ed-item">
      {codigo ? (
        <div className="ed-item__main">
          <Chip>{codigo}</Chip>
          <span className="ed-item__nm">{nombre}</span>
          {warning}
        </div>
      ) : (
        <span className="ed-item__nm" style={{ flex: 1 }}>{nombre}</span>
      )}
      <span className="ed-item__pr">{price}</span>
      {children}
      <Button type="button" variant="ghost" size="icon" onClick={onRemove} disabled={disabled}>
        <X />
      </Button>
    </div>
  )
}

// ─── DiscountInput / PriceInput ─────────────────────────────────────────────
// Pill `.ed-dcto` — el `<span>` y el `<input>` deben quedar como hermanos
// directos: e2e/visita-con-descuento.spec.ts selecciona con
// `span:text-is("Desc. $") + input[type="number"]`.

export function DiscountInput({
  value,
  onChange,
  max,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  max?: number
  disabled?: boolean
}) {
  return (
    <div className="ed-dcto">
      <span>Desc. $</span>
      <input
        type="number"
        min="0"
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        disabled={disabled}
      />
    </div>
  )
}

export function PriceInput({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div className="ed-dcto">
      <span>$</span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        disabled={disabled}
      />
    </div>
  )
}

// ─── ServiceEmpty ────────────────────────────────────────────────────────────

export function ServiceEmpty({ children }: { children: ReactNode }) {
  return <div className="ed-empty">{children}</div>
}

// ─── Segmented ───────────────────────────────────────────────────────────────
// Control segmentado genérico — `.segm` (usado hoy por el toggle Monto fijo/Porcentaje).

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div className="segm">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          disabled={disabled}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── SummaryGroup ─────────────────────────────────────────────────────────────
// Grupo de línea del rail de resumen de costos — `.rail-g*`.

export function SummaryGroup({
  label,
  tone,
  items,
  subtotal,
}: {
  label: string
  tone: 'blue' | 'green' | 'violet' | 'amber'
  items: { name: string; price: number }[]
  subtotal: number
}) {
  if (!items.length || subtotal === 0) {
    return (
      <div className="rail-g__item" style={{ paddingLeft: 0 }}>
        <span>{label}</span>
        <span>—</span>
      </div>
    )
  }

  return (
    <div className="rail-g">
      <div className="rail-g__head">
        <span>
          <span className="d" style={{ background: `var(--tag-${tone}-dot)` }} />
          {label}
        </span>
        <b className="hl-tnum">{CLP(subtotal)}</b>
      </div>
      {items.filter((i) => i.price !== 0).map((item, idx) => (
        <div key={idx} className="rail-g__item" style={item.price < 0 ? { color: 'var(--color-destructive)' } : undefined}>
          <span className="truncate">{item.name}</span>
          <span>{item.price < 0 ? `-${CLP(Math.abs(item.price))}` : CLP(item.price)}</span>
        </div>
      ))}
    </div>
  )
}
