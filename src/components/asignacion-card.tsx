'use client'

import { useDraggable } from '@dnd-kit/core'
import { Clock, MapPin } from 'lucide-react'
import type { VisitaAsignacion } from '@/lib/actions/asignacion'
import { Chip } from '@/components/ui/chip'
import { Tag } from '@/components/ui/tag'

type Props = {
  visita: VisitaAsignacion
  overlay?: boolean
}

export function AsignacionCard({ visita, overlay = false }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: visita.id,
    disabled: overlay,
  })

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.3 : 1,
    cursor: overlay ? 'grabbing' : 'grab',
  }

  return (
    <div
      ref={setNodeRef}
      data-testid="asignacion-card"
      data-visita-id={visita.id}
      style={{ ...style, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 12 }}
      className="relative shadow-sm select-none"
      suppressHydrationWarning
      {...(overlay ? {} : { ...listeners, ...attributes })}
    >
      <span className="absolute right-2 top-2">
        <Chip>#{visita.id}</Chip>
      </span>

      <p className="pr-14 truncate" style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>
        {visita.pacienteNombre || '—'}
      </p>

      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {visita.hora && (
          <span className="flex items-center gap-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>
            <Clock className="h-3 w-3" />
            {visita.hora.slice(0, 5)}
          </span>
        )}
        {visita.comuna && (
          <span className="flex items-center gap-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>
            <MapPin className="h-3 w-3" />
            {visita.comuna}
          </span>
        )}
      </div>

      {(visita.procedimientos.length > 0 || visita.examenes.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {visita.procedimientos.map((p) => (
            <Tag key={p} tone="blue">{p}</Tag>
          ))}
          {visita.examenes.map((e) => (
            <Tag key={e} tone="green">{e}</Tag>
          ))}
        </div>
      )}
    </div>
  )
}
