'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, X, AlertCircle, ChevronDown, ChevronRight, Home } from 'lucide-react'
import { toast } from 'sonner'
import { ESTADO_VISITA_STYLES } from '@/lib/estado-colors'
import type { VisitaLifecycleDetalle, CompletarVisitaData } from '@/lib/actions/visitas'
import { formatDate } from '@/lib/format'
import { FormDatePicker } from '@/components/form-date-picker'

const CLP = (n: number) => '$' + (n || 0).toLocaleString('es-CL')

function getInitials(nombre: string): string {
  return nombre
    .split(' ')
    .filter((_, i) => i < 4 && i % 2 === 0)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// ─── Estado badge ─────────────────────────────────────────────────────────────

function EstadoBadge({ estado, size = 'sm' }: { estado: string; size?: 'sm' | 'lg' }) {
  const cfg = ESTADO_VISITA_STYLES[estado] ?? ESTADO_VISITA_STYLES['programada']!
  return (
    <span
      className="inline-block rounded-md font-medium uppercase tracking-wide"
      style={{
        background: cfg.bg,
        color: cfg.color,
        fontSize: size === 'lg' ? 11 : 10.5,
        padding: size === 'lg' ? '3px 10px' : '2px 8px',
        letterSpacing: '0.06em',
      }}
    >
      {cfg.label}
    </span>
  )
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

const MAIN_STEPS = ['programada', 'confirmada', 'realizada']
const TERMINAL_STATES = ['completada', 'no_realizada', 'cancelada'] as const

function Stepper({ estado }: { estado: string }) {
  const mainStep = MAIN_STEPS.indexOf(estado)
  const isTerminal = TERMINAL_STATES.includes(estado as typeof TERMINAL_STATES[number])
  const doneMainStep = isTerminal ? 3 : mainStep

  function Node({ label, idx }: { label: string; idx: number }) {
    const done = doneMainStep > idx
    const active = estado === MAIN_STEPS[idx]
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <div
          className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0"
          style={{
            background: done ? 'oklch(0.4 0.13 145)' : active ? 'var(--foreground)' : 'var(--background)',
            border: done || active ? 'none' : '1.5px solid var(--border)',
          }}
        >
          {done ? (
            <Check className="w-[11px] h-[11px] text-white" strokeWidth={3.5} />
          ) : active ? (
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--background)' }} />
          ) : (
            <div className="w-[6px] h-[6px] rounded-full" style={{ background: 'var(--border)' }} />
          )}
        </div>
        <span
          className="text-[12.5px] hidden sm:block"
          style={{
            fontWeight: active ? 600 : 400,
            color: done ? 'oklch(0.4 0.13 145)' : active ? 'var(--foreground)' : 'var(--muted-foreground)',
          }}
        >
          {label}
        </span>
      </div>
    )
  }

  function Pipe({ filled }: { filled: boolean }) {
    return (
      <div
        className="w-5 h-[1.5px] shrink-0 mx-1"
        style={{ background: filled ? 'oklch(0.4 0.13 145)' : 'var(--border)' }}
      />
    )
  }

  return (
    <div
      className="flex items-center gap-0 px-8 h-[52px] shrink-0 overflow-x-auto"
      style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}
    >
      <Node label="Programada" idx={0} />
      <Pipe filled={doneMainStep > 0} />
      <Node label="Confirmada" idx={1} />
      <Pipe filled={doneMainStep > 1} />
      <Node label="Realizada" idx={2} />
      <Pipe filled={doneMainStep > 2} />

      {/* Terminal fork */}
      <div className="flex items-center gap-1.5">
        {(['completada', 'no_realizada', 'cancelada'] as const).map((t, i) => {
          const isActive = estado === t
          const cfg = ESTADO_VISITA_STYLES[t]!
          return (
            <div key={t} className="flex items-center gap-1">
              {i > 0 && <span className="text-[10px] select-none" style={{ color: 'var(--border)' }}>|</span>}
              <div
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                style={{
                  background: isActive ? cfg.bg : 'transparent',
                  border: isActive ? 'none' : '1px dashed var(--border)',
                  opacity: doneMainStep < 3 && !isActive ? 0.5 : 1,
                }}
              >
                {isActive ? (
                  t === 'completada'
                    ? <Check className="w-[10px] h-[10px]" style={{ color: cfg.color }} strokeWidth={3} />
                    : <X className="w-[10px] h-[10px]" style={{ color: cfg.color }} strokeWidth={3} />
                ) : (
                  <div className="w-[5px] h-[5px] rounded-full" style={{ background: 'var(--border)' }} />
                )}
                <span
                  className="text-[11.5px] hidden sm:block"
                  style={{ fontWeight: isActive ? 600 : 400, color: isActive ? cfg.color : 'var(--muted-foreground)' }}
                >
                  {cfg.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Service group ─────────────────────────────────────────────────────────────

function SvcGroup({
  label,
  dot,
  items,
}: {
  label: string
  dot: string
  items: { id: number; nombre: string; codigo?: string | null; precio: number; meta?: string | null }[]
}) {
  if (!items.length) return null
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: 'var(--muted-foreground)' }}>
          {label}
        </span>
      </div>
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {items.map((it, i) => (
          <div
            key={it.id}
            className="flex items-center gap-3 px-3.5 py-2 text-[12.5px]"
            style={{ background: 'var(--card)', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}
          >
            {it.codigo && (
              <span
                className="font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0"
                style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
              >
                {it.codigo}
              </span>
            )}
            <span className="flex-1 min-w-0" style={{ color: 'var(--foreground)' }}>
              <span className="block truncate">{it.nombre}</span>
              {it.meta && (
                <span className="block text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {it.meta}
                </span>
              )}
            </span>
            <span className="tabular-nums shrink-0" style={{ color: 'var(--muted-foreground)' }}>{CLP(it.precio)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Left summary ─────────────────────────────────────────────────────────────

function MetaCell({ label, value, tint }: { label: string; value: string; tint?: boolean }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: 'var(--muted)' }}>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] mb-0.5" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
      <p className="text-[13px] font-medium" style={{ color: tint ? 'var(--state-visita-confirmada-fg)' : 'var(--foreground)' }}>{value}</p>
    </div>
  )
}

function VisitaSummary({ v }: { v: VisitaLifecycleDetalle }) {
  const nombre = v.pacienteNombre ?? 'Sin paciente'
  const initials = v.pacienteNombre ? getInitials(v.pacienteNombre) : '?'
  const isCompleted = v.estado === 'completada'
  const examResultsById = new Map(v.examenResultados.map((r) => [r.idExamen, r]))
  const totalServicios =
    v.procedimientos.reduce((s, x) => s + x.precio, 0) +
    v.examenes.reduce((s, x) => s + x.precio, 0) +
    v.isapreExams.reduce((s, x) => s + x.valorPagar, 0) +
    v.talleres.reduce((s, x) => s + x.precio, 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Paciente */}
      <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-3" style={{ color: 'var(--muted-foreground)' }}>Paciente</p>
        <div className="flex items-start gap-3 rounded-lg p-3" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{nombre}</p>
            {v.pacienteIdentificador && <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{v.pacienteIdentificador}</p>}
            {v.pacientePrevision && <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{v.pacientePrevision}</p>}
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {v.pacienteTelefonos.slice(0, 2).map((t, i) => <span key={i}>{t}</span>)}
              {v.pacienteDireccion && (
                <span className="flex items-center gap-1">
                  <Home className="w-[11px] h-[11px]" />
                  {v.pacienteDireccion}
                </span>
              )}
            </div>
          </div>
          {v.idPaciente && (
            <Link href={`/pacientes/${v.idPaciente}`} className="text-[11px] shrink-0 hover:opacity-80 transition-opacity" style={{ color: 'var(--state-visita-confirmada-fg)' }}>
              Ver →
            </Link>
          )}
        </div>
      </div>

      {/* Programación */}
      <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-3" style={{ color: 'var(--muted-foreground)' }}>Programación</p>
        <div className="grid grid-cols-2 gap-2">
          <MetaCell label="Fecha" value={formatDate(v.fecha)} />
          <MetaCell label="Hora" value={v.hora ?? '—'} />
          <MetaCell label="Enfermera" value={v.enfermeraNombre ?? '—'} />
          {v.origenContacto && <MetaCell label="Origen" value={v.origenContacto} tint />}
        </div>
      </div>

      {/* Cierre */}
      {isCompleted && (
        <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Check className="w-4 h-4 shrink-0" style={{ color: 'oklch(0.38 0.13 145)' }} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--muted-foreground)' }}>Cierre</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MetaCell label="Documento" value={`${v.tipoDocumento === 'factura' ? 'Factura' : 'Boleta'} N° ${v.numeroBoleta || '—'}`} />
            {v.numeroAtencion && <MetaCell label="N° atención" value={String(v.numeroAtencion)} />}
            <MetaCell label="Pago" value={v.pagado ? 'Pagado' : 'No registrado'} tint={v.pagado} />
            {v.metodoPago && <MetaCell label="Método" value={v.metodoPago} />}
            {v.fechaPago && <MetaCell label="Fecha pago" value={formatDate(v.fechaPago)} />}
            {v.resultadosTotalCount > 0 && (
              <MetaCell label="Exámenes enviados" value={`${v.resultadosEnviadosCount} de ${v.resultadosTotalCount}`} />
            )}
          </div>
        </div>
      )}

      {/* Servicios */}
      <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--muted-foreground)' }}>Servicios</p>
          {totalServicios > 0 && (
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Subtotal <strong style={{ color: 'var(--foreground)' }}>{CLP(totalServicios)}</strong>
            </span>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <SvcGroup label="Procedimientos" dot="oklch(0.45 0.1 250)" items={v.procedimientos} />
          <SvcGroup
            label="Exámenes"
            dot="oklch(0.4 0.13 145)"
            items={v.examenes.map((e) => {
              const result = examResultsById.get(e.id)
              return {
                ...e,
                meta: isCompleted && result?.enviado && result.fechaEnvio ? `Enviado el ${formatDate(result.fechaEnvio)}` : null,
              }
            })}
          />
          <SvcGroup
            label="Exámenes Isapre"
            dot="oklch(0.45 0.13 290)"
            items={v.isapreExams.map((e) => {
              const result = examResultsById.get(e.id)
              return {
                id: e.id,
                nombre: e.nombre,
                codigo: e.codigo,
                precio: e.valorPagar,
                meta: isCompleted && result?.enviado && result.fechaEnvio ? `Enviado el ${formatDate(result.fechaEnvio)}` : null,
              }
            })}
          />
          <SvcGroup label="Talleres" dot="oklch(0.5 0.12 60)" items={v.talleres} />
          {v.cobraVisita && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg text-[12.5px]" style={{ background: 'var(--muted)' }}>
              <span className="flex items-center gap-1.5" style={{ color: 'var(--foreground)' }}>
                <Home className="w-[13px] h-[13px]" style={{ color: 'var(--muted-foreground)' }} />
                Visita de enfermería
              </span>
              <span className="tabular-nums">
                {CLP(v.montoDescuento > 0 ? v.montoVisitaOriginal : v.precioVisita ?? 0)}
              </span>
            </div>
          )}
          {v.montoDescuento > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg text-[12.5px]" style={{ background: 'var(--muted)', color: 'oklch(0.55 0.18 25)' }}>
              <span>Descuento visita</span>
              <span className="tabular-nums">-{CLP(v.montoDescuento)}</span>
            </div>
          )}
          {v.surcharges.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-[12.5px]" style={{ background: 'var(--muted)' }}>
              <span style={{ color: 'var(--foreground)' }}>Recargo · <strong>{s.tipoNombre}</strong></span>
              <span className="tabular-nums">{CLP(s.precio)}</span>
            </div>
          ))}
          {v.montoInsumos > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg text-[12.5px]" style={{ background: 'var(--muted)' }}>
              <span style={{ color: 'var(--foreground)' }}>Insumos</span>
              <span className="tabular-nums">{CLP(v.montoInsumos)}</span>
            </div>
          )}
          {v.procedimientos.length === 0 && v.examenes.length === 0 && v.isapreExams.length === 0 && v.talleres.length === 0 && !v.cobraVisita && (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Sin servicios registrados.</p>
          )}
        </div>
        <div className="mt-4 pt-3 flex justify-between" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>Total</span>
          <span className="text-[15px] font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>{CLP(v.costo)}</span>
        </div>
      </div>

      {/* Notas */}
      {v.informacionAdicional && (
        <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: 'var(--muted-foreground)' }}>
            Notas <span className="normal-case font-normal ml-1">(solo visible internamente)</span>
          </p>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--foreground)' }}>{v.informacionAdicional}</p>
        </div>
      )}
    </div>
  )
}

// ─── Cancel inline ────────────────────────────────────────────────────────────

function CancelInline({
  onClose,
  onCancelar,
  isPending,
}: {
  onClose: () => void
  onCancelar: (motivo: string) => void
  isPending: boolean
}) {
  const [motivo, setMotivo] = useState('')
  return (
    <div className="rounded-xl overflow-hidden mt-1" style={{ border: '1px solid oklch(0.88 0.06 25)' }}>
      <div className="flex flex-col gap-2.5 p-3" style={{ background: 'oklch(0.97 0.025 25)' }}>
        <p className="text-[12.5px] font-semibold" style={{ color: 'oklch(0.5 0.18 25)' }}>Cancelar esta visita</p>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
            Motivo de cancelación <span style={{ color: 'oklch(0.5 0.18 25)' }}>*</span>
          </label>
          <textarea
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="¿Por qué se cancela esta visita?"
            className="w-full resize-none rounded-lg px-3 py-2 text-[13px] leading-snug outline-none"
            style={{ background: 'var(--background)', border: '1px solid var(--input)', color: 'var(--foreground)', boxSizing: 'border-box' }}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onCancelar(motivo)}
            disabled={!motivo.trim() || isPending}
            className="flex-1 h-9 rounded-lg text-[13px] font-medium transition-opacity disabled:opacity-40"
            style={{ background: 'oklch(0.5 0.18 25)', color: 'white', border: 'none' }}
          >
            {isPending ? 'Cancelando…' : 'Confirmar cancelación'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg text-[13px] px-3 transition-opacity hover:opacity-80"
            style={{ background: 'var(--card)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
          >
            Atrás
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Panel: programada ────────────────────────────────────────────────────────

function PanelProgramada({
  visitId,
  onConfirmar,
  onCancelar,
}: {
  visitId: number
  onConfirmar: () => Promise<{ success: boolean; error?: string }>
  onCancelar: (motivo: string) => Promise<{ success: boolean; error?: string }>
}) {
  const router = useRouter()
  const [showCancel, setShowCancel] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleConfirmar() {
    startTransition(async () => {
      const result = await onConfirmar()
      if (result.success) {
        toast.success('Visita confirmada')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Error al confirmar visita')
      }
    })
  }

  function handleCancelar(motivo: string) {
    startTransition(async () => {
      const result = await onCancelar(motivo)
      if (result.success) {
        toast.success('Visita cancelada')
        router.push(`/visitas/${visitId}`)
        router.refresh()
      } else {
        toast.error(result.error ?? 'Error al cancelar visita')
      }
    })
  }

  return (
    <div className="p-4 flex flex-col gap-2.5">
      <div className="flex items-start gap-2.5 p-3 rounded-lg" style={{ background: 'var(--muted)' }}>
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--muted-foreground)' }} />
        <p className="text-[12.5px] leading-snug" style={{ color: 'var(--muted-foreground)' }}>
          Al confirmar, la visita quedará fijada en la agenda. Podrás seguir editando hasta marcarla como realizada.
        </p>
      </div>
      <button
        type="button"
        onClick={handleConfirmar}
        disabled={isPending}
        className="w-full h-10 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
        style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
      >
        {isPending ? 'Procesando…' : 'Confirmar visita'}
      </button>
      {!showCancel ? (
        <button type="button" onClick={() => setShowCancel(true)} className="text-[12.5px] text-left bg-transparent border-none cursor-pointer" style={{ color: 'oklch(0.5 0.18 25)', padding: '2px 0' }}>
          Cancelar visita…
        </button>
      ) : (
        <CancelInline onClose={() => setShowCancel(false)} onCancelar={handleCancelar} isPending={isPending} />
      )}
    </div>
  )
}

// ─── Panel: confirmada ────────────────────────────────────────────────────────

function PanelConfirmada({
  visitId,
  hasAssignedNurse,
  onMarcarRealizada,
  onMarcarNoRealizada,
  onCancelar,
}: {
  visitId: number
  hasAssignedNurse: boolean
  onMarcarRealizada: () => Promise<{ success: boolean; error?: string }>
  onMarcarNoRealizada: (costo: number, concepto: string) => Promise<{ success: boolean; error?: string }>
  onCancelar: (motivo: string) => Promise<{ success: boolean; error?: string }>
}) {
  const router = useRouter()
  const [action, setAction] = useState<'no_realizada' | 'cancelar' | null>(null)
  const [costo, setCosto] = useState('')
  const [concepto, setConcepto] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleRealizada() {
    startTransition(async () => {
      const result = await onMarcarRealizada()
      if (result.success) {
        toast.success('Visita marcada como realizada')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Error al marcar como realizada')
      }
    })
  }

  function handleNoRealizada() {
    startTransition(async () => {
      const result = await onMarcarNoRealizada(Number(costo) || 0, concepto)
      if (result.success) {
        toast.success('Visita marcada como no realizada')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Error al marcar como no realizada')
      }
    })
  }

  function handleCancelar(motivo: string) {
    startTransition(async () => {
      const result = await onCancelar(motivo)
      if (result.success) {
        toast.success('Visita cancelada')
        router.push(`/visitas/${visitId}`)
        router.refresh()
      } else {
        toast.error(result.error ?? 'Error al cancelar visita')
      }
    })
  }

  return (
    <div className="p-4 flex flex-col gap-2.5">
      <button
        type="button"
        onClick={handleRealizada}
        disabled={isPending || !hasAssignedNurse}
        className="w-full h-10 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
        style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
      >
        {isPending ? 'Procesando…' : 'Marcar como realizada'}
      </button>
      {!hasAssignedNurse && (
        <div
          className="flex items-start gap-2.5 rounded-lg p-3"
          style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'oklch(0.5 0.18 25)' }} />
          <p className="text-[12.5px] leading-snug" style={{ color: 'var(--muted-foreground)' }}>
            Para marcar esta visita como realizada, primero asigna una enfermera.
          </p>
        </div>
      )}

      {/* No realizada accordion */}
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${action === 'no_realizada' ? 'var(--state-visita-no-realizada-border)' : 'var(--border)'}` }}>
        <button
          type="button"
          onClick={() => setAction(action === 'no_realizada' ? null : 'no_realizada')}
          className="w-full flex items-center justify-between px-3.5 py-2.5 text-[13px] font-medium cursor-pointer"
          style={{ background: action === 'no_realizada' ? 'var(--state-visita-no-realizada-bg)' : 'var(--card)', color: action === 'no_realizada' ? 'var(--state-visita-no-realizada-fg)' : 'var(--foreground)', border: 'none' }}
        >
          <span className="flex items-center gap-2"><X className="w-3.5 h-3.5" strokeWidth={2.5} />No realizada</span>
          <ChevronDown className="w-3.5 h-3.5 transition-transform" style={{ transform: action === 'no_realizada' ? 'rotate(180deg)' : 'none' }} />
        </button>
        {action === 'no_realizada' && (
          <div className="px-3.5 pb-3.5 pt-3 flex flex-col gap-3" style={{ background: 'var(--card)', borderTop: '1px solid var(--border)' }}>
            <p className="text-[12.5px] leading-snug" style={{ color: 'var(--muted-foreground)' }}>
              La visita no pudo realizarse. Puedes registrar un cobro por concepto de traslado u otro.
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Monto a cobrar</label>
              <div className="flex items-center h-9 rounded-lg px-3 gap-2" style={{ background: 'var(--background)', border: '1px solid var(--input)' }}>
                <span className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>$</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={costo}
                  onChange={(e) => setCosto(e.target.value)}
                  placeholder="0"
                  className="flex-1 bg-transparent border-none outline-none text-[13px]"
                  style={{ color: 'var(--foreground)' }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Concepto <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(opcional)</span></label>
              <input
                type="text"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Ej: Cobro por traslado"
                className="h-9 rounded-lg px-3 text-[13px] outline-none"
                style={{ background: 'var(--background)', border: '1px solid var(--input)', color: 'var(--foreground)' }}
              />
            </div>
            <button
              type="button"
              onClick={handleNoRealizada}
              disabled={isPending}
              className="w-full h-9 rounded-lg text-[13px] font-medium transition-opacity disabled:opacity-40"
              style={{ background: 'var(--state-visita-no-realizada-fg)', color: 'white', border: 'none' }}
            >
              {isPending ? 'Procesando…' : 'Confirmar no realizada'}
            </button>
          </div>
        )}
      </div>

      {/* Cancel */}
      {action !== 'cancelar' ? (
        <button type="button" onClick={() => setAction('cancelar')} className="text-[12.5px] text-left bg-transparent border-none cursor-pointer" style={{ color: 'oklch(0.5 0.18 25)', padding: '2px 0' }}>
          Cancelar visita…
        </button>
      ) : (
        <CancelInline onClose={() => setAction(null)} onCancelar={handleCancelar} isPending={isPending} />
      )}
    </div>
  )
}

// ─── Completion accordion section ─────────────────────────────────────────────

function CompletionSection({
  num,
  title,
  done,
  open,
  onToggle,
  summary,
  children,
}: {
  num: number
  title: string
  done: boolean
  open: boolean
  onToggle: () => void
  summary?: string | null
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl overflow-hidden mb-2" style={{ border: `1px solid ${done ? 'oklch(0.7 0.14 145 / 35%)' : 'var(--border)'}` }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 cursor-pointer text-left"
        style={{ background: done ? 'oklch(0.95 0.04 145)' : 'var(--card)', color: done ? 'oklch(0.38 0.13 145)' : 'var(--foreground)', border: 'none' }}
      >
        <div
          className="w-[22px] h-[22px] rounded-full shrink-0 flex items-center justify-center"
          style={{ background: done ? 'oklch(0.4 0.13 145)' : 'var(--muted)', border: done ? 'none' : '1.5px solid var(--border)' }}
        >
          {done ? (
            <Check className="w-[11px] h-[11px] text-white" strokeWidth={3.5} />
          ) : (
            <span className="text-[10px] font-bold" style={{ color: 'var(--muted-foreground)' }}>{num}</span>
          )}
        </div>
        <span className="flex-1 text-[13px] font-medium">{title}</span>
        {!done && !open && (
          <span className="text-[10.5px] px-1.5 py-0.5 rounded" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>Pendiente</span>
        )}
        <ChevronDown className="w-3.5 h-3.5 shrink-0 transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {!open && done && summary && (
        <div className="px-3 pb-2.5 text-[12px] leading-snug" style={{ paddingLeft: 46, color: 'var(--muted-foreground)' }}>
          {summary}
        </div>
      )}

      {open && (
        <div className="p-3 flex flex-col gap-3" style={{ borderTop: `1px solid ${done ? 'oklch(0.7 0.14 145 / 20%)' : 'var(--border)'}`, background: 'var(--card)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Panel: realizada ───────────────────────────────────���─────────────────────

type CompletionSectionId = 'facturacion' | 'pago' | 'examenes'

type CompletionError = {
  section: CompletionSectionId
  message: string
  field?: 'boleta' | 'atencion' | 'pagado' | 'metodo' | 'fechaPago'
  examIds?: number[]
}

function InlineError({ children }: { children: string }) {
  return (
    <p className="text-[11.5px] leading-snug" style={{ color: 'oklch(0.5 0.18 25)' }}>
      {children}
    </p>
  )
}

function PanelRealizada({
  visita,
  onCompletar,
}: {
  visita: VisitaLifecycleDetalle
  onCompletar: (data: CompletarVisitaData) => Promise<{ success: boolean; error?: string }>
}) {
  const router = useRouter()
  const [openSec, setOpenSec] = useState<CompletionSectionId | null>('facturacion')
  const [tipoDoc, setTipoDoc] = useState<'boleta' | 'factura'>(
    (visita.tipoDocumento as 'boleta' | 'factura') || 'boleta'
  )
  const [boleta, setBoleta] = useState(visita.numeroBoleta)
  const [atencion, setAtencion] = useState(visita.numeroAtencion ? String(visita.numeroAtencion) : '')
  const [pagado, setPagado] = useState(visita.pagado)
  const [metodo, setMetodo] = useState(visita.metodoPago ?? '')
  const [fechaPago, setFechaPago] = useState(visita.fechaPago ?? '')
  const [examenes, setExamenes] = useState<{ idExamen: number; enviado: boolean; fecha: string }[]>(() =>
    [...visita.examenes, ...visita.isapreExams].map((e) => {
      const saved = visita.examenResultados.find((r) => r.idExamen === e.id)
      return { idExamen: e.id, enviado: saved?.enviado ?? false, fecha: saved?.fechaEnvio ?? '' }
    })
  )
  const [isPending, startTransition] = useTransition()
  const [completionError, setCompletionError] = useState<CompletionError | null>(null)

  const facturacionDone = !!(tipoDoc && boleta.trim())
  const pagoDone = !!(pagado && metodo && fechaPago)
  const hasExamenes = examenes.length > 0
  const examenesDone = !hasExamenes || examenes.every((e) => e.enviado && e.fecha)
  const tasks = hasExamenes ? [facturacionDone, pagoDone, examenesDone] : [facturacionDone, pagoDone]
  const doneTasks = tasks.filter(Boolean).length
  const allDone = tasks.every(Boolean)

  function toggle(sec: typeof openSec) { setOpenSec(openSec === sec ? null : sec) }

  function updateExamen(idExamen: number, patch: Partial<{ enviado: boolean; fecha: string }>) {
    setCompletionError(null)
    setExamenes((prev) => prev.map((e) => e.idExamen === idExamen ? { ...e, ...patch } : e))
  }

  function validateCompletion(): CompletionError | null {
    if (!tipoDoc || !boleta.trim()) {
      return {
        section: 'facturacion',
        field: 'boleta',
        message: `Ingresa el N° de ${tipoDoc === 'factura' ? 'factura' : 'boleta'} antes de completar la visita.`,
      }
    }
    if (!pagado) {
      return {
        section: 'pago',
        field: 'pagado',
        message: 'Marca la visita como pagada para completar este paso.',
      }
    }
    if (!metodo) {
      return {
        section: 'pago',
        field: 'metodo',
        message: 'Selecciona el método de pago antes de completar la visita.',
      }
    }
    if (!fechaPago) {
      return {
        section: 'pago',
        field: 'fechaPago',
        message: 'Selecciona la fecha de pago antes de completar la visita.',
      }
    }

    const incompleteExams = examenes.filter((e) => !e.enviado || !e.fecha)
    if (incompleteExams.length > 0) {
      const missingDates = incompleteExams.filter((e) => e.enviado && !e.fecha).length
      const notSent = incompleteExams.length - missingDates
      const parts = [
        notSent ? `${notSent} sin marcar como enviado${notSent > 1 ? 's' : ''}` : null,
        missingDates ? `${missingDates} sin fecha de envío` : null,
      ].filter(Boolean)

      return {
        section: 'examenes',
        examIds: incompleteExams.map((e) => e.idExamen),
        message: `Completa el envío de exámenes: ${parts.join(' y ')}.`,
      }
    }

    return null
  }

  function completionErrorFromServer(message: string): CompletionError {
    const normalized = message.toLowerCase()
    if (normalized.includes('atención') || normalized.includes('atencion')) {
      return { section: 'facturacion', field: 'atencion', message }
    }
    if (normalized.includes('boleta') || normalized.includes('factura') || normalized.includes('documento')) {
      return { section: 'facturacion', field: 'boleta', message }
    }
    if (normalized.includes('método') || normalized.includes('metodo')) {
      return { section: 'pago', field: 'metodo', message }
    }
    if (normalized.includes('fecha de pago')) {
      return { section: 'pago', field: 'fechaPago', message }
    }
    if (normalized.includes('pago') || normalized.includes('pagada')) {
      return { section: 'pago', field: 'pagado', message }
    }
    if (normalized.includes('examen')) {
      return { section: 'examenes', message }
    }
    return { section: 'facturacion', message }
  }

  function handleCompletar() {
    const validationError = validateCompletion()
    if (validationError) {
      setCompletionError(validationError)
      setOpenSec(validationError.section)
      toast.error(validationError.message)
      return
    }

    setCompletionError(null)
    startTransition(async () => {
      const result = await onCompletar({
        tipoDocumento: tipoDoc,
        numeroBoleta: boleta,
        numeroAtencion: atencion ? Number(atencion) : null,
        pagado,
        metodoPago: pagado ? metodo : null,
        fechaPago: pagado ? fechaPago : null,
        examenes: examenes.filter((e) => e.enviado && e.fecha).map((e) => ({ idExamen: e.idExamen, fechaEnvio: e.fecha })),
      })
      if (result.success) {
        toast.success('Visita completada')
        router.push(`/visitas/${visita.id}`)
        router.refresh()
      } else {
        const message = result.error ?? 'Error al completar visita'
        const serverError = completionErrorFromServer(message)
        setCompletionError(serverError)
        setOpenSec(serverError.section)
        toast.error(message)
      }
    })
  }

  const facturacionSummary = facturacionDone ? `${tipoDoc === 'boleta' ? 'Boleta' : 'Factura'} N° ${boleta}${atencion ? ` · Atención ${atencion}` : ''}` : null
  const pagoSummary = pagoDone ? `Pagado el ${fechaPago} · ${metodo}` : null
  const examSent = examenes.filter((e) => e.enviado).length
  const examenesSummary = `${examSent}/${examenes.length} marcados`

  const allExamsWithMeta = [
    ...visita.examenes.map((e) => ({ ...e, grupo: e.grupoExamen })),
    ...visita.isapreExams.map((e) => ({ ...e, precio: e.valorPagar, grupoExamen: 'Isapre', grupo: 'Isapre' })),
  ]

  return (
    <div className="p-4 flex flex-col">
      {/* Progress bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1.5">
          {tasks.map((done, i) => (
            <div key={i} className="w-7 h-1 rounded-full transition-all" style={{ background: done ? 'oklch(0.4 0.13 145)' : 'var(--border)' }} />
          ))}
        </div>
        <span className="text-[11.5px]" style={{ color: 'var(--muted-foreground)' }}>{doneTasks} de {tasks.length} completadas</span>
      </div>

      {/* 1: Facturación */}
      <CompletionSection num={1} title="Facturación" done={facturacionDone} open={openSec === 'facturacion'} onToggle={() => toggle('facturacion')} summary={facturacionSummary}>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Tipo documento <span style={{ color: 'oklch(0.5 0.18 25)' }}>*</span></label>
          <div className="flex gap-2">
            {(['boleta', 'factura'] as const).map((opt) => (
              <button key={opt} type="button" onClick={() => setTipoDoc(opt)}
                className="flex-1 h-9 rounded-lg text-[13px] capitalize transition-all"
                style={{ background: tipoDoc === opt ? 'var(--foreground)' : 'var(--card)', color: tipoDoc === opt ? 'var(--background)' : 'var(--foreground)', border: `1px solid ${tipoDoc === opt ? 'var(--foreground)' : 'var(--border)'}`, fontWeight: tipoDoc === opt ? 600 : 400 }}>
                {opt}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>N° de {tipoDoc} <span style={{ color: 'oklch(0.5 0.18 25)' }}>*</span></label>
          <input value={boleta} onChange={(e) => { setCompletionError(null); setBoleta(e.target.value) }} placeholder="Ej: 001234"
            className="h-9 rounded-lg px-3 text-[13px] outline-none" style={{ background: 'var(--background)', border: `1px solid ${completionError?.field === 'boleta' ? 'oklch(0.65 0.2 25)' : 'var(--input)'}`, color: 'var(--foreground)' }} />
          {completionError?.field === 'boleta' && <InlineError>{completionError.message}</InlineError>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
            N° de atención <span className="font-normal" style={{ color: 'var(--muted-foreground)' }}>(opcional)</span>
          </label>
          <input value={atencion} onChange={(e) => { setCompletionError(null); setAtencion(e.target.value) }} placeholder="Ej: 98765" type="number"
            className="h-9 rounded-lg px-3 text-[13px] outline-none" style={{ background: 'var(--background)', border: `1px solid ${completionError?.field === 'atencion' ? 'oklch(0.65 0.2 25)' : 'var(--input)'}`, color: 'var(--foreground)' }} />
          {completionError?.field === 'atencion' && <InlineError>{completionError.message}</InlineError>}
        </div>
        {facturacionDone && (
          <button type="button" onClick={() => toggle('pago')} className="w-full h-8 rounded-lg text-[12.5px] font-medium flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90" style={{ background: 'oklch(0.4 0.13 145)', color: 'white', border: 'none' }}>
            Continuar con pago <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </CompletionSection>

      {/* 2: Pago */}
      <CompletionSection num={2} title="Pago" done={pagoDone} open={openSec === 'pago'} onToggle={() => toggle('pago')} summary={pagoSummary}>
        <button type="button" onClick={() => { setCompletionError(null); setPagado(!pagado) }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
          style={{ background: pagado ? 'oklch(0.95 0.04 145)' : 'var(--muted)', border: `1px solid ${completionError?.field === 'pagado' ? 'oklch(0.65 0.2 25)' : pagado ? 'oklch(0.7 0.14 145 / 30%)' : 'var(--border)'}` }}>
          <div className="w-5 h-5 rounded shrink-0 flex items-center justify-center" style={{ background: pagado ? 'oklch(0.4 0.13 145)' : 'var(--background)', border: pagado ? 'none' : '1.5px solid var(--border)' }}>
            {pagado && <Check className="w-[11px] h-[11px] text-white" strokeWidth={3.5} />}
          </div>
          <span className="text-[13px] font-medium" style={{ color: pagado ? 'oklch(0.38 0.13 145)' : 'var(--foreground)' }}>Marcar como pagada</span>
        </button>
        {completionError?.field === 'pagado' && <InlineError>{completionError.message}</InlineError>}
        {pagado && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Método de pago <span style={{ color: 'oklch(0.5 0.18 25)' }}>*</span></label>
              <div className="flex flex-wrap gap-2">
                {['Efectivo', 'Transferencia', 'Débito', 'Crédito'].map((opt) => (
                  <button key={opt} type="button" onClick={() => { setCompletionError(null); setMetodo(opt) }}
                    className="h-8 px-3 rounded-lg text-[12.5px] transition-all"
                    style={{ background: metodo === opt ? 'var(--foreground)' : 'var(--card)', color: metodo === opt ? 'var(--background)' : 'var(--foreground)', border: `1px solid ${completionError?.field === 'metodo' && !metodo ? 'oklch(0.65 0.2 25)' : metodo === opt ? 'var(--foreground)' : 'var(--border)'}` }}>
                    {opt}
                  </button>
                ))}
              </div>
              {completionError?.field === 'metodo' && <InlineError>{completionError.message}</InlineError>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Fecha de pago <span style={{ color: 'oklch(0.5 0.18 25)' }}>*</span></label>
              <FormDatePicker
                mode="single"
                value={fechaPago || undefined}
                onChange={(value) => { setCompletionError(null); setFechaPago(value ?? '') }}
                weekStartsOn={1}
                placeholder="Seleccionar fecha"
                className={completionError?.field === 'fechaPago' ? 'border-[oklch(0.65_0.2_25)]' : undefined}
              />
              {completionError?.field === 'fechaPago' && <InlineError>{completionError.message}</InlineError>}
            </div>
          </>
        )}
        {pagoDone && hasExamenes && (
          <button type="button" onClick={() => toggle('examenes')} className="w-full h-8 rounded-lg text-[12.5px] font-medium flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90" style={{ background: 'oklch(0.4 0.13 145)', color: 'white', border: 'none' }}>
            Continuar con exámenes <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </CompletionSection>

      {/* 3: Exámenes */}
      {hasExamenes && (
        <CompletionSection num={3} title="Envío de exámenes" done={examenesDone} open={openSec === 'examenes'} onToggle={() => toggle('examenes')} summary={examenesSummary}>
          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--muted)' }}>
              <div className="h-full rounded-full transition-all" style={{ background: 'oklch(0.4 0.13 145)', width: `${(examSent / examenes.length) * 100}%` }} />
            </div>
            <span className="text-[11.5px] tabular-nums shrink-0" style={{ color: 'var(--muted-foreground)' }}>{examSent}/{examenes.length}</span>
          </div>
          {allExamsWithMeta.map((ex) => {
            const st = examenes.find((e) => e.idExamen === ex.id)!
            const rowDone = st.enviado && st.fecha
            const rowError = completionError?.examIds?.includes(ex.id) && !rowDone
            return (
              <div key={ex.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${rowError ? 'oklch(0.65 0.2 25)' : rowDone ? 'oklch(0.7 0.14 145 / 35%)' : 'var(--border)'}` }}>
                <button type="button" onClick={() => updateExamen(ex.id, { enviado: !st.enviado, fecha: st.enviado ? '' : st.fecha })}
                  className="w-full flex items-center gap-3 px-3.5 py-3 text-left transition-all"
                  style={{ background: st.enviado ? 'oklch(0.95 0.04 145)' : 'var(--card)', border: 'none', cursor: 'pointer' }}>
                  <div className="w-[20px] h-[20px] rounded shrink-0 flex items-center justify-center" style={{ background: st.enviado ? 'oklch(0.4 0.13 145)' : 'var(--background)', border: st.enviado ? 'none' : '1.5px solid var(--border)' }}>
                    {st.enviado && <Check className="w-[10px] h-[10px] text-white" strokeWidth={3.5} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium" style={{ color: st.enviado ? 'oklch(0.38 0.13 145)' : 'var(--foreground)' }}>{ex.nombre}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[10px] px-1 py-0.5 rounded" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>{ex.codigo}</span>
                      <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{ex.grupo}</span>
                    </div>
                  </div>
                  {st.enviado && !st.fecha && <span className="text-[11px] px-2 py-0.5 rounded shrink-0" style={{ background: 'oklch(0.95 0.1 60)', color: 'oklch(0.45 0.15 60)' }}>Falta fecha</span>}
                  {rowError && !st.enviado && <span className="text-[11px] px-2 py-0.5 rounded shrink-0" style={{ background: 'oklch(0.97 0.04 25)', color: 'oklch(0.5 0.18 25)' }}>Falta enviar</span>}
                  {rowDone && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'oklch(0.4 0.13 145)' }} />}
                </button>
                {st.enviado && (
                  <div className="px-3.5 pb-3 pt-2" style={{ borderTop: '1px solid oklch(0.7 0.14 145 / 15%)', paddingLeft: 50 }}>
                    <label className="text-[12px] font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>Fecha de envío <span style={{ color: 'oklch(0.5 0.18 25)' }}>*</span></label>
                    <FormDatePicker
                      mode="single"
                      value={st.fecha || undefined}
                      onChange={(value) => updateExamen(ex.id, { fecha: value ?? '' })}
                      weekStartsOn={1}
                      placeholder="Fecha envío"
                      className={`h-8 text-[13px] ${rowError && !st.fecha ? 'border-[oklch(0.65_0.2_25)]' : ''}`}
                    />
                  </div>
                )}
              </div>
            )
          })}
          {completionError?.section === 'examenes' && <InlineError>{completionError.message}</InlineError>}
        </CompletionSection>
      )}

      {/* CTA */}
      <button
        type="button"
        onClick={handleCompletar}
        disabled={isPending}
        aria-disabled={!allDone || isPending}
        className="w-full h-12 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 transition-all mt-2 disabled:opacity-35"
        style={{ background: allDone ? 'var(--primary)' : 'var(--muted)', color: allDone ? 'var(--primary-foreground)' : 'var(--muted-foreground)', border: 'none' }}
      >
        {isPending ? 'Completando…' : allDone ? <><Check className="w-4 h-4" />Completar visita</> : 'Completar visita'}
      </button>
      {!allDone && (
        <p className="text-[11.5px] text-center mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
          Completa las {tasks.length - doneTasks} sección{tasks.length - doneTasks !== 1 ? 'es' : ''} pendiente{tasks.length - doneTasks !== 1 ? 's' : ''} para habilitar
        </p>
      )}
    </div>
  )
}

// ─── Panel: completada ────────────────────────────────────────────────────────

function PanelCompletada({ v }: { v: VisitaLifecycleDetalle }) {
  function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex justify-between gap-2 text-[12.5px] py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--muted-foreground)' }}>{label}</span>
        <span style={{ color: 'var(--foreground)' }}>{value}</span>
      </div>
    )
  }

  const enviados = v.examenResultados.filter((r) => r.enviado).length

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'oklch(0.95 0.04 145)', border: '1px solid oklch(0.7 0.14 145 / 30%)' }}>
        <Check className="w-4 h-4 shrink-0" style={{ color: 'oklch(0.38 0.13 145)' }} />
        <p className="text-[13px] font-medium" style={{ color: 'oklch(0.38 0.13 145)' }}>Visita completada</p>
      </div>
      <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-2" style={{ color: 'var(--muted-foreground)' }}>Facturación</p>
        <SummaryRow label="Documento" value={`${v.tipoDocumento === 'boleta' ? 'Boleta' : 'Factura'} N° ${v.numeroBoleta}`} />
        {v.numeroAtencion && <SummaryRow label="N° atención" value={String(v.numeroAtencion)} />}
      </div>
      <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-2" style={{ color: 'var(--muted-foreground)' }}>Pago</p>
        {v.pagado ? (
          <>
            <SummaryRow label="Estado" value="Pagado" />
            {v.metodoPago && <SummaryRow label="Método" value={v.metodoPago} />}
            {v.fechaPago && <SummaryRow label="Fecha" value={v.fechaPago} />}
          </>
        ) : (
          <p className="text-[12.5px]" style={{ color: 'var(--muted-foreground)' }}>No registrado como pagado</p>
        )}
      </div>
      {v.resultadosTotalCount > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-2" style={{ color: 'var(--muted-foreground)' }}>Exámenes</p>
          <SummaryRow label="Enviados" value={`${enviados} de ${v.resultadosTotalCount}`} />
        </div>
      )}
    </div>
  )
}

// ─── Panel: no_realizada ──────────────────────────────────────────────────────

function PanelNoRealizada({ v }: { v: VisitaLifecycleDetalle }) {
  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-start gap-2.5 p-3 rounded-lg" style={{ background: 'var(--state-visita-no-realizada-bg)', border: '1px solid var(--state-visita-no-realizada-border)' }}>
        <X className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--state-visita-no-realizada-fg)' }} />
        <p className="text-[13px] font-medium" style={{ color: 'var(--state-visita-no-realizada-fg)' }}>Visita no realizada</p>
      </div>
      {v.costoTraslado > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex justify-between text-[13px]">
            <span style={{ color: 'var(--muted-foreground)' }}>{v.conceptoNoRealizada || 'Cobro'}</span>
            <span className="font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>{CLP(v.costoTraslado)}</span>
          </div>
        </div>
      )}
      {v.costoTraslado === 0 && (
        <p className="text-[12.5px]" style={{ color: 'var(--muted-foreground)' }}>Sin cobro registrado.</p>
      )}
    </div>
  )
}

// ─── Panel: cancelada ─────────────────────────────────────────────────────────

function PanelCancelada({ v }: { v: VisitaLifecycleDetalle }) {
  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-start gap-2.5 p-3 rounded-lg" style={{ background: 'var(--state-visita-cancelada-bg)', border: '1px solid var(--state-visita-cancelada-border)' }}>
        <X className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--state-visita-cancelada-fg)' }} />
        <p className="text-[13px] font-medium" style={{ color: 'var(--state-visita-cancelada-fg)' }}>Visita cancelada</p>
      </div>
      {v.motivoCancelacion && (
        <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-2" style={{ color: 'var(--muted-foreground)' }}>Motivo</p>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--foreground)' }}>{v.motivoCancelacion}</p>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  visita: VisitaLifecycleDetalle
  onConfirmar: () => Promise<{ success: boolean; error?: string }>
  onMarcarRealizada: () => Promise<{ success: boolean; error?: string }>
  onMarcarNoRealizada: (costo: number, concepto: string) => Promise<{ success: boolean; error?: string }>
  onCancelar: (motivo: string) => Promise<{ success: boolean; error?: string }>
  onCompletar: (data: CompletarVisitaData) => Promise<{ success: boolean; error?: string }>
}

const EDITABLE_STATES = ['programada', 'confirmada', 'realizada']

export function VisitaLifecycleView({
  visita,
  onConfirmar,
  onMarcarRealizada,
  onMarcarNoRealizada,
  onCancelar,
  onCompletar,
}: Props) {
  const isEditable = EDITABLE_STATES.includes(visita.estado)
  const isCompleted = visita.estado === 'completada'
  const visitCode = `V-${String(visita.id).padStart(5, '0')}`

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Stepper bar */}
      <Stepper estado={visita.estado} />

      {/* Header */}
      <div
        className="flex items-center justify-between px-8 py-4 shrink-0"
        style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{visitCode}</h1>
          <EstadoBadge estado={visita.estado} size="lg" />
          <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{CLP(visita.costo)}</span>
        </div>
        <div className="flex items-center gap-2">
          {isEditable && (
            <Link
              href={`/visitas/${visita.id}/editar`}
              className="h-9 px-4 rounded-lg text-[13px] font-medium flex items-center gap-1.5 transition-opacity hover:opacity-80"
              style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
            >
              Editar visita
            </Link>
          )}
          <Link
            href="/visitas"
            className="h-9 px-3 rounded-lg text-[13px] flex items-center transition-opacity hover:opacity-80"
            style={{ background: 'transparent', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
          >
            ← Volver
          </Link>
        </div>
      </div>

      {/* Body */}
      <div className={`flex-1 grid grid-cols-1 ${isCompleted ? '' : 'lg:grid-cols-[1fr_360px]'} gap-0 max-w-[1200px] mx-auto w-full`}>
        {/* Left: summary */}
        <div className="p-6 overflow-y-auto">
          <VisitaSummary v={visita} />
        </div>

        {/* Right: action rail */}
        {!isCompleted && (
          <div
            className="lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto shrink-0"
            style={{ background: 'var(--card)', borderLeft: '1px solid var(--border)' }}
          >
            <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: 'var(--muted-foreground)' }}>
                {visita.estado === 'cancelada' ? 'Visita cancelada' :
                 visita.estado === 'no_realizada' ? 'No realizada' :
                 'Acción'}
              </p>
            </div>

            {visita.estado === 'programada' && (
              <PanelProgramada visitId={visita.id} onConfirmar={onConfirmar} onCancelar={onCancelar} />
            )}
            {visita.estado === 'confirmada' && (
              <PanelConfirmada visitId={visita.id} hasAssignedNurse={visita.idEnfermera !== null} onMarcarRealizada={onMarcarRealizada} onMarcarNoRealizada={onMarcarNoRealizada} onCancelar={onCancelar} />
            )}
            {visita.estado === 'realizada' && (
              <PanelRealizada visita={visita} onCompletar={onCompletar} />
            )}
            {visita.estado === 'no_realizada' && <PanelNoRealizada v={visita} />}
            {visita.estado === 'cancelada' && <PanelCancelada v={visita} />}
          </div>
        )}
      </div>
    </div>
  )
}
