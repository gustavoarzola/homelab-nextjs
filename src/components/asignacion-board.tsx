'use client'

import { useState, useMemo, useTransition } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  guardarAsignaciones,
  getVisitasParaAsignacion,
  type VisitaAsignacion,
} from '@/lib/actions/asignacion'
import { AsignacionCard } from '@/components/asignacion-card'
import { AsignacionMap } from '@/components/asignacion-map'
import { FormDatePicker } from '@/components/form-date-picker'
import { SelectCombobox } from '@/components/select-combobox'
import { Button } from '@/components/ui/button'
import { Tag } from '@/components/ui/tag'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  initialFecha: string
  initialVisitas: VisitaAsignacion[]
  enfermeras: { id: number; nombre: string; comunaResidencia: string | null }[]
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

function DropZone({
  id,
  label,
  visitas,
  empty,
}: {
  id: string
  label: string
  visitas: VisitaAsignacion[]
  empty: string
}) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {label && (
        <p className="hl-label" style={{ marginBottom: 8 }}>
          {label} ({visitas.length})
        </p>
      )}
      <div
        ref={setNodeRef}
        data-testid={`dropzone-${id}`}
        className="flex-1 overflow-y-auto p-2 transition-colors"
        style={{
          background: isOver ? 'var(--brand-blue-soft)' : 'var(--color-surface-muted)',
          border: `2px dashed ${isOver ? 'var(--brand-blue)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-md)',
          minHeight: '200px',
        }}
      >
        {visitas.length === 0 ? (
          <p className="flex h-full items-center justify-center" style={{ fontSize: 'var(--text-base)', color: 'var(--color-fg-muted)' }}>
            {empty}
          </p>
        ) : (
          <div className="space-y-2">
            {visitas.map((v) => (
              <AsignacionCard key={v.id} visita={v} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── AsignacionBoard ──────────────────────────────────────────────────────────

export function AsignacionBoard({ initialFecha, initialVisitas, enfermeras }: Props) {
  const [fecha, setFecha] = useState(initialFecha)
  const [visitas, setVisitas] = useState<VisitaAsignacion[]>(initialVisitas)
  const [localAssignments, setLocalAssignments] = useState<Map<number, number | null>>(new Map())
  const [selectedNurseId, setSelectedNurseId] = useState<number | null>(null)
  const [activeVisita, setActiveVisita] = useState<VisitaAsignacion | null>(null)
  const [isPending, startTransition] = useTransition()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Derived state
  const effectiveVisitas = useMemo(
    () =>
      visitas.map((v) => ({
        ...v,
        idEnfermera: localAssignments.has(v.id) ? localAssignments.get(v.id)! : v.idEnfermera,
      })),
    [visitas, localAssignments],
  )

  const unassigned = useMemo(
    () => effectiveVisitas.filter((v) => v.idEnfermera === null),
    [effectiveVisitas],
  )

  const nurseVisitas = useMemo(
    () => (selectedNurseId ? effectiveVisitas.filter((v) => v.idEnfermera === selectedNurseId) : []),
    [effectiveVisitas, selectedNurseId],
  )

  const isDirty = localAssignments.size > 0

  // ── Date change ─────────────────────────────────────────────────────────────

  function handleDateChange(newFecha: string) {
    if (isDirty) {
      if (!confirm('Hay cambios sin guardar. ¿Desea cambiar la fecha y perderlos?')) return
      setLocalAssignments(new Map())
    }
    startTransition(async () => {
      const nuevasVisitas = await getVisitasParaAsignacion(newFecha)
      setFecha(newFecha)
      setVisitas(nuevasVisitas)
    })
  }

  // ── DnD ─────────────────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    const v = effectiveVisitas.find((v) => v.id === event.active.id)
    setActiveVisita(v ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveVisita(null)
    const { active, over } = event
    if (!over) return

    const visitaId = active.id as number
    const zoneId = over.id as string

    setLocalAssignments((prev) => {
      const next = new Map(prev)
      if (zoneId === 'nurse' && selectedNurseId !== null) {
        next.set(visitaId, selectedNurseId)
      } else if (zoneId === 'unassigned') {
        next.set(visitaId, null)
      }
      return next
    })
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  function handleSave() {
    const cambios = [...localAssignments.entries()].map(([idVisita, idEnfermera]) => ({
      idVisita,
      idEnfermera,
    }))
    startTransition(async () => {
      const result = await guardarAsignaciones(cambios)
      if (result.success) {
        const nuevasVisitas = await getVisitasParaAsignacion(fecha)
        setVisitas(nuevasVisitas)
        setLocalAssignments(new Map())
        toast.success('Asignaciones guardadas')
      } else {
        toast.error(result.error ?? 'Error al guardar')
      }
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>
              Asignación de visitas
            </h1>
            <FormDatePicker
              mode="single"
              value={fecha}
              onChange={(value) => value && handleDateChange(value)}
              disabled={isPending}
              weekStartsOn={1}
              placeholder="Seleccionar fecha"
              className="w-[170px]"
            />
            {isPending && <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--color-fg-muted)' }} />}
          </div>
          {isDirty && (
            <Button onClick={handleSave} disabled={isPending}>
              <Save />
              Guardar cambios
            </Button>
          )}
        </div>

        {/* 3-column layout with fixed header row */}
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_1fr_1fr] grid-rows-[auto_1fr] gap-4">
          {/* Headers row */}
          <p className="hl-label">
            Sin asignar ({unassigned.length})
          </p>
          <div className="flex items-start gap-2">
            <p className="hl-label" style={{ paddingTop: 8 }}>
              Enfermera
            </p>
            <div className="flex-1">
              <SelectCombobox
                mode="single"
                options={enfermeras.map((e) => ({ id: e.id, label: e.nombre }))}
                selected={selectedNurseId}
                onChange={setSelectedNurseId}
                placeholder="— Seleccionar —"
                disabled={isPending}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="hl-label">
              Mapa ({nurseVisitas.filter((v) => v.latitud && v.longitud).length} ubicaciones)
            </p>
            {selectedNurseId !== null && (() => {
              const comuna = enfermeras.find((e) => e.id === selectedNurseId)?.comunaResidencia
              return comuna ? (
                <p className="flex items-center gap-2" style={{ fontSize: 'var(--text-base)', color: 'var(--color-fg-muted)' }}>
                  Comuna de residencia enfermera
                  <Tag noDot>{comuna}</Tag>
                </p>
              ) : null
            })()}
          </div>

          {/* Content row */}
          <DropZone
            id="unassigned"
            label=""
            visitas={unassigned}
            empty="No hay visitas sin asignar"
          />

          <DropZone
            id="nurse"
            label=""
            visitas={nurseVisitas}
            empty={selectedNurseId ? 'Sin visitas asignadas' : 'Selecciona una enfermera para ver sus visitas'}
          />

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-hidden" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
              <AsignacionMap visitas={nurseVisitas} />
            </div>
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeVisita && <AsignacionCard visita={activeVisita} overlay />}
      </DragOverlay>
    </DndContext>
  )
}
