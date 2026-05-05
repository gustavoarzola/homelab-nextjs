'use client'

import { useDraggable } from '@dnd-kit/core'
import { Clock, MapPin, Building2 } from 'lucide-react'
import type { VisitaAsignacion } from '@/lib/actions/asignacion'

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
      style={{ ...style, backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
      className="rounded-lg p-3 shadow-sm select-none"
      suppressHydrationWarning
      {...(overlay ? {} : { ...listeners, ...attributes })}
    >
      <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
        {visita.pacienteNombre || '—'}
      </p>

      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {visita.hora && (
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            <Clock className="h-3 w-3" />
            {visita.hora.slice(0, 5)}
          </span>
        )}
        {visita.comuna && (
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            <MapPin className="h-3 w-3" />
            {visita.comuna}
          </span>
        )}
        {visita.laboratorio && (
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            <Building2 className="h-3 w-3" />
            {visita.laboratorio}
          </span>
        )}
      </div>

      {(visita.procedimientos.length > 0 || visita.examenes.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {visita.procedimientos.map((p) => (
            <span
              key={p}
              className="rounded px-1.5 py-0.5 text-xs"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              {p}
            </span>
          ))}
          {visita.examenes.map((e) => (
            <span
              key={e}
              className="rounded px-1.5 py-0.5 text-xs"
              style={{ backgroundColor: 'var(--secondary)', color: 'var(--secondary-foreground)' }}
            >
              {e}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
