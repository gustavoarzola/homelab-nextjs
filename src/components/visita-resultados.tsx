'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ChevronLeft, FlaskConical, Microscope } from 'lucide-react'
import { FormDatePicker } from '@/components/form-date-picker'
import type { VisitaResultadosDetalle, ExamenResultadoItem } from '@/lib/actions/resultados'

type ItemState = {
  idExamen: number
  enviado: boolean
  fechaEnvio: string | null
}

type Props = {
  idVisita: number
  pacienteNombre: string
  visitaFecha: string
  initialResultados: VisitaResultadosDetalle
  onSave: (fd: FormData) => Promise<{ success: true; enviados: number; total: number } | { success: false; error: string }>
}

export function VisitaResultados({ idVisita, pacienteNombre, visitaFecha, initialResultados, onSave }: Props) {
  const [items, setItems] = useState<ItemState[]>(() =>
    initialResultados.items.map((i) => ({
      idExamen: i.idExamen,
      enviado: i.enviado,
      fechaEnvio: i.fechaEnvio,
    }))
  )
  const [savedCounts, setSavedCounts] = useState({
    enviados: initialResultados.enviados,
    total: initialResultados.total,
  })
  const [isPending, startTransition] = useTransition()

  const liveEnviados = items.filter((i) => i.enviado).length
  const liveTotal = items.length

  function updateItem(idExamen: number, patch: Partial<ItemState>) {
    setItems((prev) => prev.map((item) => item.idExamen === idExamen ? { ...item, ...patch } : item))
  }

  function handleSave() {
    const fd = new FormData()
    fd.set('idVisita', String(idVisita))
    fd.set('itemCount', String(items.length))
    items.forEach((item, i) => {
      fd.set(`item_idExamen_${i}`, String(item.idExamen))
      fd.set(`item_enviado_${i}`, String(item.enviado))
      fd.set(`item_fechaEnvio_${i}`, item.fechaEnvio ?? '')
    })
    startTransition(async () => {
      const result = await onSave(fd)
      if (result.success) {
        setSavedCounts({ enviados: result.enviados, total: result.total })
        toast.success('Resultados guardados')
      } else {
        toast.error(result.error)
      }
    })
  }

  const standardItems = initialResultados.items
    .filter((i) => i.tipo === 'estandar')
    .map((i) => items.find((s) => s.idExamen === i.idExamen)!)
    .filter(Boolean)
  const isapreItems = initialResultados.items
    .filter((i) => i.tipo === 'isapre')
    .map((i) => items.find((s) => s.idExamen === i.idExamen)!)
    .filter(Boolean)

  const examMeta = new Map<number, ExamenResultadoItem>(
    initialResultados.items.map((i) => [i.idExamen, i])
  )

  const allSent = savedCounts.total > 0 && savedCounts.enviados >= savedCounts.total

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Sticky header */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between gap-4 px-8 py-4"
        style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--background)' }}
      >
        <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
          <Link
            href="/visitas"
            className="hover:underline transition-opacity"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Visitas
          </Link>
          <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
          <Link
            href={`/visitas/${idVisita}`}
            className="hover:underline transition-opacity"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Visita #{idVisita}
          </Link>
          <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
          <span style={{ color: 'var(--foreground)' }}>Resultados</span>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-lg px-4 py-2 text-[13px] font-medium transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'var(--foreground)', color: 'var(--background)' }}
        >
          {isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <div className="p-8">
        {/* Info header */}
        <div className="mb-6">
          <h1 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            {pacienteNombre}
          </h1>
          <p className="mt-0.5 text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
            Visita {visitaFecha}
          </p>
        </div>

        {/* Progress card */}
        <div
          className="mb-6 rounded-xl border p-5"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
              Resultados enviados
            </span>
            <span
              className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold tabular-nums"
              style={{
                backgroundColor: allSent ? 'oklch(0.6 0.118 184.704 / 12%)' : 'oklch(0.7 0.15 60 / 15%)',
                color: allSent ? 'oklch(0.45 0.118 184.704)' : 'oklch(0.40 0.15 60)',
              }}
            >
              {savedCounts.enviados}/{savedCounts.total}
            </span>
          </div>
          {savedCounts.total > 0 ? (
            <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--muted)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.round((liveEnviados / liveTotal) * 100)}%`,
                  backgroundColor: allSent ? 'oklch(0.6 0.118 184.704)' : 'oklch(0.65 0.15 60)',
                }}
              />
            </div>
          ) : (
            <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
              Esta visita no tiene exámenes registrados.
            </p>
          )}
        </div>

        {/* Exam groups */}
        {standardItems.length > 0 && (
          <ExamGroup
            title="Exámenes estándar"
            icon={<FlaskConical className="h-4 w-4" />}
            items={standardItems}
            examMeta={examMeta}
            onUpdate={updateItem}
          />
        )}

        {isapreItems.length > 0 && (
          <div className={standardItems.length > 0 ? 'mt-4' : ''}>
            <ExamGroup
              title="Exámenes ISAPRE"
              icon={<Microscope className="h-4 w-4" />}
              items={isapreItems}
              examMeta={examMeta}
              onUpdate={updateItem}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function ExamGroup({
  title,
  icon,
  items,
  examMeta,
  onUpdate,
}: {
  title: string
  icon: React.ReactNode
  items: ItemState[]
  examMeta: Map<number, ExamenResultadoItem>
  onUpdate: (idExamen: number, patch: Partial<ItemState>) => void
}) {
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
    >
      <div
        className="flex items-center gap-2 px-5 py-3.5"
        style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--muted)' }}
      >
        <span style={{ color: 'var(--muted-foreground)' }}>{icon}</span>
        <span className="text-[13px] font-medium" style={{ color: 'var(--foreground)' }}>{title}</span>
      </div>

      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {items.map((item) => {
          const meta = examMeta.get(item.idExamen)
          if (!meta) return null
          return (
            <ExamRow
              key={item.idExamen}
              item={item}
              meta={meta}
              onUpdate={onUpdate}
            />
          )
        })}
      </div>
    </div>
  )
}

function ExamRow({
  item,
  meta,
  onUpdate,
}: {
  item: ItemState
  meta: ExamenResultadoItem
  onUpdate: (idExamen: number, patch: Partial<ItemState>) => void
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      {/* Checkbox */}
      <input
        type="checkbox"
        id={`enviado-${item.idExamen}`}
        checked={item.enviado}
        onChange={(e) => {
          const enviado = e.target.checked
          onUpdate(item.idExamen, { enviado, fechaEnvio: enviado ? item.fechaEnvio : null })
        }}
        className="h-4 w-4 shrink-0 rounded"
        style={{ accentColor: 'var(--foreground)', cursor: 'pointer' }}
      />

      {/* Exam info */}
      <label
        htmlFor={`enviado-${item.idExamen}`}
        className="flex min-w-0 flex-1 flex-col gap-0.5 cursor-pointer"
      >
        <span className="text-[13px] font-medium truncate" style={{ color: 'var(--foreground)' }}>
          {meta.nombre}
        </span>
        <div className="flex items-center gap-2">
          {meta.codigo && (
            <span
              className="rounded px-1.5 py-0.5 text-[11px] font-mono"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
            >
              {meta.codigo}
            </span>
          )}
          <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
            {meta.grupoExamen}
          </span>
        </div>
      </label>

      {/* Date picker — only when checked */}
      <div className="w-48 shrink-0">
        {item.enviado && (
          <FormDatePicker
            mode="single"
            value={item.fechaEnvio ?? undefined}
            onChange={(v) => onUpdate(item.idExamen, { fechaEnvio: v ?? null })}
            placeholder="Fecha envío"
          />
        )}
      </div>
    </div>
  )
}
