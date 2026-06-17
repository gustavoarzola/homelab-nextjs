'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight,
  AlertCircle,
  Check,
  X,
  Printer,
  Home,
  MapPin,
} from 'lucide-react'
import { SelectCombobox } from '@/components/select-combobox'
import { toast } from 'sonner'
import type { CotizacionVista } from '@/lib/actions/cotizaciones'
import { ESTADO_COTIZACION_STYLES } from '@/lib/estado-colors'

const CLP = (n: number) => '$' + (n || 0).toLocaleString('es-CL')

function formatTimestamp(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getInitials(nombre: string): string {
  return nombre
    .split(' ')
    .filter((_, i) => i < 4 && i % 2 === 0)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// ─── Estado config ────────────────────────────────────────────────────────────

type EstadoKey = 'creada' | 'enviada' | 'aceptada' | 'rechazada'

const ESTADO_CFG = ESTADO_COTIZACION_STYLES as Record<EstadoKey, { label: string; bg: string; color: string; step: number }>

function EstadoBadge({ estado, size = 'sm' }: { estado: string; size?: 'sm' | 'lg' }) {
  const cfg = ESTADO_CFG[estado as EstadoKey]
  const isKnown = !!cfg
  return (
    <span
      className="inline-block rounded-md font-medium uppercase tracking-wide"
      style={{
        background: isKnown ? cfg.bg : 'var(--destructive)',
        color: isKnown ? cfg.color : 'white',
        fontSize: size === 'lg' ? 11 : 10.5,
        padding: size === 'lg' ? '3px 10px' : '2px 8px',
        letterSpacing: '0.06em',
      }}
    >
      {isKnown ? cfg.label : `Inválido: ${estado}`}
    </span>
  )
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ estado }: { estado: string }) {
  const step = ESTADO_CFG[estado as EstadoKey]?.step ?? 0

  function Node({ label, done, active }: { label: string; done: boolean; active: boolean }) {
    return (
      <div className="flex items-center gap-2 shrink-0">
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
          className="text-[13px]"
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
        className="w-7 h-[1.5px] shrink-0"
        style={{ background: filled ? 'oklch(0.4 0.13 145)' : 'var(--border)' }}
      />
    )
  }

  const terminals: { id: EstadoKey; label: string }[] = [
    { id: 'aceptada',  label: 'Aceptada'  },
    { id: 'rechazada', label: 'Rechazada' },
  ]

  return (
    <div
      className="flex items-center gap-0 px-8 h-[52px] shrink-0"
      style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}
    >
      <Node label="Creada"  done={step > 0} active={estado === 'creada'}  />
      <Pipe filled={step > 0} />
      <Node label="Enviada" done={step > 1} active={estado === 'enviada'} />
      <Pipe filled={step > 1} />

      {/* Fork terminal */}
      <div className="flex items-center gap-1.5">
        {terminals.map((t, i) => {
          const isActive = estado === t.id
          const cfg = ESTADO_CFG[t.id]
          return (
            <div key={t.id} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-[11px]" style={{ color: 'var(--border)' }}>|</span>}
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{
                  background: isActive ? cfg.bg : 'transparent',
                  border: isActive ? 'none' : '1px dashed var(--border)',
                  opacity: step < 2 && !isActive ? 0.55 : 1,
                }}
              >
                {isActive ? (
                  t.id === 'aceptada'
                    ? <Check className="w-[11px] h-[11px]" style={{ color: cfg.color }} strokeWidth={3} />
                    : <X className="w-[11px] h-[11px]" style={{ color: cfg.color }} strokeWidth={3} />
                ) : (
                  <div className="w-[5px] h-[5px] rounded-full" style={{ background: 'var(--border)' }} />
                )}
                <span
                  className="text-[12.5px]"
                  style={{ fontWeight: isActive ? 600 : 400, color: isActive ? cfg.color : 'var(--muted-foreground)' }}
                >
                  {t.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Summary: left column ──────────────────────────────────────────────────────

function SvcGroup({
  label,
  dot,
  items,
}: {
  label: string
  dot: string
  items: { id: number; nombre: string; codigo: string | null; precio: number }[]
}) {
  if (!items.length) return null
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.07em]"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {label}
        </span>
      </div>
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {items.map((it, i) => (
          <div
            key={it.id}
            className="flex items-center gap-3 px-3.5 py-2 text-[12.5px]"
            style={{
              background: 'var(--card)',
              borderTop: i === 0 ? 'none' : '1px solid var(--border)',
            }}
          >
            <span
              className="font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0"
              style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
            >
              {it.codigo ?? '—'}
            </span>
            <span className="flex-1" style={{ color: 'var(--foreground)' }}>{it.nombre}</span>
            <span className="tabular-nums shrink-0" style={{ color: 'var(--foreground)' }}>{CLP(it.precio)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuoteSummary({ cot }: { cot: CotizacionVista }) {
  const displayName = cot.pacienteNombre ?? cot.nombreDestinatario ?? 'Sin destinatario'
  const initials = displayName !== 'Sin destinatario' ? getInitials(displayName) : '?'

  const subtotalServicios =
    cot.procedimientos.reduce((s, x) => s + x.precio, 0) +
    cot.examenes.reduce((s, x) => s + x.precio, 0) +
    cot.isapreExams.reduce((s, x) => s + x.valorPagar, 0) +
    cot.talleres.reduce((s, x) => s + x.precio, 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Destinatario */}
      <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-3" style={{ color: 'var(--muted-foreground)' }}>
          Destinatario
        </p>
        <div
          className="flex items-start gap-3 rounded-lg p-3"
          style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{displayName}</p>
            {cot.identificacionDestinatario && (
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{cot.identificacionDestinatario}</p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {cot.emailDestinatario && <span>{cot.emailDestinatario}</span>}
              {cot.telefonoDestinatario && <span>{cot.telefonoDestinatario}</span>}
              {cot.comuna && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-[11px] h-[11px]" />
                  {cot.comuna}
                </span>
              )}
            </div>
          </div>
          {!cot.idPaciente && (
            <span
              className="text-[10.5px] font-medium px-2 py-0.5 rounded shrink-0"
              style={{ background: 'oklch(0.88 0.07 250 / 60%)', color: 'oklch(0.45 0.1 250)' }}
            >
              Sin paciente
            </span>
          )}
        </div>
      </div>

      {/* Servicios */}
      <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--muted-foreground)' }}>
            Servicios
          </p>
          {subtotalServicios > 0 && (
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Subtotal <strong style={{ color: 'var(--foreground)' }}>{CLP(subtotalServicios)}</strong>
            </span>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <SvcGroup label="Procedimientos" dot="oklch(0.45 0.1 250)" items={cot.procedimientos} />
          <SvcGroup label="Exámenes" dot="oklch(0.4 0.13 145)" items={cot.examenes} />
          <SvcGroup
            label="Exámenes Isapre"
            dot="oklch(0.45 0.13 290)"
            items={cot.isapreExams.map((e) => ({ id: e.id, nombre: e.nombre, codigo: e.codigo, precio: e.valorPagar }))}
          />
          <SvcGroup label="Talleres" dot="oklch(0.5 0.12 60)" items={cot.talleres} />
          {cot.procedimientos.length === 0 && cot.examenes.length === 0 && cot.isapreExams.length === 0 && cot.talleres.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Sin servicios registrados.</p>
          )}
        </div>
      </div>

      {/* Cargos adicionales */}
      {(cot.cobraVisita || cot.surcharges.length > 0) && (
        <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Cargos adicionales
          </p>
          <div className="flex flex-col gap-2">
            {cot.cobraVisita && (
              <div
                className="flex items-center justify-between px-3 py-2 rounded-lg text-[13px]"
                style={{ background: 'var(--muted)' }}
              >
                <span className="flex items-center gap-1.5" style={{ color: 'var(--foreground)' }}>
                  <Home className="w-[13px] h-[13px]" style={{ color: 'var(--muted-foreground)' }} />
                  Visita de enfermería · <strong>{cot.comuna}</strong>
                </span>
                <span className="tabular-nums font-medium">{CLP(cot.precioVisita)}</span>
              </div>
            )}
            {cot.surcharges.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-[13px]"
                style={{ background: 'var(--muted)' }}
              >
                <span style={{ color: 'var(--foreground)' }}>Recargo · <strong>{s.tipoNombre}</strong></span>
                <span className="tabular-nums font-medium">{CLP(s.precio)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notas */}
      {cot.notas && (
        <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: 'var(--muted-foreground)' }}>
            Notas <span className="normal-case font-normal ml-1">(solo visible internamente)</span>
          </p>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--foreground)' }}>{cot.notas}</p>
        </div>
      )}
    </div>
  )
}

// ─── Rail: right column ───────────────────────────────────────────────────────

function RailMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-[12.5px]">
      <span style={{ color: 'var(--muted-foreground)' }}>{label}</span>
      <span style={{ color: 'var(--foreground)', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

// Panel: creada
function PanelCreada({
  cotId,
  onMarcarEnviada,
}: {
  cotId: number
  onMarcarEnviada: () => Promise<{ success: boolean; error?: string }>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleMarcar() {
    startTransition(async () => {
      const result = await onMarcarEnviada()
      if (result.success) {
        toast.success('Cotización marcada como enviada')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Error al marcar como enviada')
      }
    })
  }

  return (
    <div className="p-5 flex flex-col gap-2.5">
      <div
        className="flex items-start gap-2.5 p-3 rounded-lg"
        style={{ background: 'var(--muted)' }}
      >
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--muted-foreground)' }} />
        <p className="text-[12.5px] leading-snug" style={{ color: 'var(--muted-foreground)' }}>
          Al marcar como <strong style={{ color: 'var(--foreground)' }}>enviada</strong>, esta cotización dejará de ser editable.
        </p>
      </div>
      <button
        type="button"
        onClick={handleMarcar}
        disabled={isPending}
        className="w-full h-10 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
        style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
      >
        {isPending ? 'Procesando…' : 'Marcar como enviada'}
      </button>
      <a
        href={`/api/cotizacion-standalone/${cotId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full h-9 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
        style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
      >
        <Printer className="w-3.5 h-3.5" />
        Imprimir / PDF
      </a>
    </div>
  )
}

// Panel: enviada
function PanelEnviada({
  cotId,
  hasPaciente,
  pacientes,
  onAceptar,
  onRechazar,
}: {
  cotId: number
  hasPaciente: boolean
  pacientes: { id: number; label: string }[]
  onAceptar: (idPaciente?: number) => Promise<{ success: boolean; idVisita?: number; error?: string }>
  onRechazar: (motivo: string) => Promise<{ success: boolean; error?: string }>
}) {
  const router = useRouter()
  const [action, setAction] = useState<'aceptar' | 'rechazar' | null>(null)
  const [motivo, setMotivo] = useState('')
  const [selectedPaciente, setSelectedPaciente] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const canAceptar = hasPaciente || selectedPaciente !== null
  const canRechazar = motivo.trim().length > 0

  function handleAceptar() {
    startTransition(async () => {
      const result = await onAceptar(selectedPaciente ?? undefined)
      if (result.success && result.idVisita) {
        toast.success('Cotización aceptada. Visita creada.')
        router.push(`/visitas/${result.idVisita}`)
      } else {
        toast.error(result.error ?? 'Error al aceptar cotización')
      }
    })
  }

  function handleRechazar() {
    startTransition(async () => {
      const result = await onRechazar(motivo)
      if (result.success) {
        toast.success('Cotización rechazada')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Error al rechazar cotización')
      }
    })
  }

  return (
    <div className="p-5 flex flex-col gap-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--muted-foreground)' }}>
        Resultado de la cotización
      </p>

      {/* Aceptar */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: `1px solid ${action === 'aceptar' ? 'oklch(0.4 0.13 145)' : 'var(--border)'}` }}
      >
        <button
          type="button"
          onClick={() => setAction(action === 'aceptar' ? null : 'aceptar')}
          className="w-full flex items-center justify-between px-3.5 py-2.5 text-[13px] font-medium cursor-pointer"
          style={{
            background: action === 'aceptar' ? 'oklch(0.88 0.1 145 / 60%)' : 'var(--card)',
            color: action === 'aceptar' ? 'oklch(0.4 0.13 145)' : 'var(--foreground)',
            border: 'none',
          }}
        >
          <span className="flex items-center gap-2">
            <Check className="w-[15px] h-[15px]" strokeWidth={2.5} />
            Aceptada
          </span>
          <ChevronRight
            className="w-3.5 h-3.5 transition-transform"
            style={{ transform: action === 'aceptar' ? 'rotate(90deg)' : 'none' }}
          />
        </button>

        {action === 'aceptar' && (
          <div
            className="px-3.5 pb-3.5 pt-3 flex flex-col gap-3"
            style={{ background: 'var(--card)', borderTop: '1px solid oklch(0.7 0.14 145 / 25%)' }}
          >
            {hasPaciente ? (
              <p className="text-[12.5px] leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                La cotización tiene un paciente registrado. Al aceptar se creará la visita automáticamente.
              </p>
            ) : (
              <>
                <p className="text-[12.5px] leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                  Esta cotización no tiene paciente asociado. Selecciona uno para crear la visita.
                </p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                    Paciente <span style={{ color: 'oklch(0.5 0.18 25)' }}>*</span>
                  </label>
                  <SelectCombobox
                    mode="single"
                    options={pacientes}
                    selected={selectedPaciente}
                    onChange={setSelectedPaciente}
                    placeholder="Buscar por nombre o RUT…"
                    clearable
                  />
                </div>
              </>
            )}
            <button
              type="button"
              onClick={handleAceptar}
              disabled={!canAceptar || isPending}
              className="w-full h-9 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5 transition-opacity disabled:opacity-40"
              style={{ background: 'oklch(0.4 0.13 145)', color: 'white' }}
            >
              {isPending ? 'Creando visita…' : 'Aceptar y crear visita'}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Rechazar */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: `1px solid ${action === 'rechazar' ? 'oklch(0.5 0.18 25)' : 'var(--border)'}` }}
      >
        <button
          type="button"
          onClick={() => setAction(action === 'rechazar' ? null : 'rechazar')}
          className="w-full flex items-center justify-between px-3.5 py-2.5 text-[13px] font-medium cursor-pointer"
          style={{
            background: action === 'rechazar' ? 'oklch(0.97 0.025 25)' : 'var(--card)',
            color: action === 'rechazar' ? 'oklch(0.5 0.18 25)' : 'var(--foreground)',
            border: 'none',
          }}
        >
          <span className="flex items-center gap-2">
            <X className="w-[14px] h-[14px]" />
            Rechazada
          </span>
          <ChevronRight
            className="w-3.5 h-3.5 transition-transform"
            style={{ transform: action === 'rechazar' ? 'rotate(90deg)' : 'none' }}
          />
        </button>

        {action === 'rechazar' && (
          <div
            className="px-3.5 pb-3.5 pt-3 flex flex-col gap-2.5"
            style={{ background: 'var(--card)', borderTop: '1px solid oklch(0.6 0.18 25 / 20%)' }}
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                Motivo de rechazo <span style={{ color: 'oklch(0.5 0.18 25)' }}>*</span>
              </label>
              <textarea
                rows={3}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="¿Por qué fue rechazada esta cotización?"
                className="w-full resize-none rounded-lg px-3 py-2 text-[13px] leading-snug outline-none"
                style={{
                  background: 'var(--background)',
                  border: '1px solid var(--input)',
                  color: 'var(--foreground)',
                  boxSizing: 'border-box',
                }}
              />
              <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Queda registrado internamente.</p>
            </div>
            <button
              type="button"
              onClick={handleRechazar}
              disabled={!canRechazar || isPending}
              className="w-full h-9 rounded-lg text-[13px] font-medium flex items-center justify-center transition-opacity disabled:opacity-40"
              style={{ background: 'oklch(0.5 0.18 25)', color: 'white' }}
            >
              {isPending ? 'Procesando…' : 'Confirmar rechazo'}
            </button>
          </div>
        )}
      </div>

      <a
        href={`/api/cotizacion-standalone/${cotId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full h-9 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2 mt-0.5 transition-opacity hover:opacity-80"
        style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
      >
        <Printer className="w-3.5 h-3.5" />
        Imprimir / PDF
      </a>
    </div>
  )
}

// Panel: aceptada
function PanelAceptada({ cotId, idVisita }: { cotId: number; idVisita: number | null }) {
  return (
    <div className="p-5 flex flex-col gap-2.5">
      <div
        className="flex items-start gap-2.5 p-3 rounded-lg"
        style={{
          background: 'oklch(0.88 0.1 145 / 60%)',
          border: '1px solid oklch(0.7 0.14 145 / 35%)',
        }}
      >
        <Check className="w-[15px] h-[15px] shrink-0 mt-0.5" style={{ color: 'oklch(0.4 0.13 145)' }} strokeWidth={2.5} />
        <p className="text-[12.5px] leading-snug" style={{ color: 'oklch(0.35 0.1 145)' }}>
          Cotización aceptada.{idVisita ? ` Se creó la visita V-${String(idVisita).padStart(4, '0')}.` : ''}
        </p>
      </div>
      {idVisita && (
        <Link
          href={`/visitas/${idVisita}`}
          className="w-full h-9 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5 transition-opacity hover:opacity-80"
          style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
        >
          Ver visita V-{String(idVisita).padStart(4, '0')}
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      )}
      <a
        href={`/api/cotizacion-standalone/${cotId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full h-9 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
        style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
      >
        <Printer className="w-3.5 h-3.5" />
        Imprimir / PDF
      </a>
    </div>
  )
}

// Panel: rechazada
function PanelRechazada({ cotId, motivo, fechaRechazo }: { cotId: number; motivo: string | null; fechaRechazo: string }) {
  return (
    <div className="p-5 flex flex-col gap-2.5">
      <div
        className="rounded-lg p-3"
        style={{
          background: 'oklch(0.97 0.025 25)',
          border: '1px solid oklch(0.88 0.06 25)',
        }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-1.5"
          style={{ color: 'oklch(0.55 0.15 25)' }}
        >
          Motivo de rechazo
        </p>
        <p className="text-[12.5px] leading-relaxed" style={{ color: 'oklch(0.35 0.1 25)' }}>
          {motivo ?? 'Sin motivo registrado.'}
        </p>
        <p className="mt-2 text-[11px]" style={{ color: 'oklch(0.55 0.1 25)' }}>
          Registrado el {fechaRechazo}
        </p>
      </div>
      <a
        href={`/api/cotizacion-standalone/${cotId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full h-9 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
        style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
      >
        <Printer className="w-3.5 h-3.5" />
        Imprimir / PDF
      </a>
    </div>
  )
}

// ─── Rail wrapper ─────────────────────────────────────────────────────────────

function Rail({
  cot,
  pacientes,
  onMarcarEnviada,
  onAceptar,
  onRechazar,
}: {
  cot: CotizacionVista
  pacientes: { id: number; label: string }[]
  onMarcarEnviada: () => Promise<{ success: boolean; error?: string }>
  onAceptar: (idPaciente?: number) => Promise<{ success: boolean; idVisita?: number; error?: string }>
  onRechazar: (motivo: string) => Promise<{ success: boolean; error?: string }>
}) {
  const totalItems =
    cot.procedimientos.length + cot.examenes.length + cot.isapreExams.length + cot.talleres.length

  const updatedAtStr = formatTimestamp(cot.updatedAt ?? cot.createdAt)

  return (
    <div className="sticky top-5" style={{ height: 'fit-content' }}>
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {/* Total + meta */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--muted-foreground)' }}>
              Total cotización
            </span>
            <EstadoBadge estado={cot.estado} />
          </div>
          <p className="text-[28px] font-semibold tracking-tight mt-1" style={{ color: 'var(--foreground)' }}>
            {CLP(cot.total)}
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            <RailMeta
              label="Para"
              value={cot.pacienteNombre ?? cot.nombreDestinatario ?? '—'}
            />
            {cot.fechaEnvio && (
              <RailMeta label="Enviada" value={formatTimestamp(cot.fechaEnvio)} />
            )}
            <RailMeta label="Servicios" value={`${totalItems} ítem${totalItems !== 1 ? 's' : ''}`} />
          </div>
        </div>

        {/* Action panel */}
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {cot.estado === 'creada' && (
            <PanelCreada cotId={cot.id} onMarcarEnviada={onMarcarEnviada} />
          )}
          {cot.estado === 'enviada' && (
            <PanelEnviada
              cotId={cot.id}
              hasPaciente={!!cot.idPaciente}
              pacientes={pacientes}
              onAceptar={onAceptar}
              onRechazar={onRechazar}
            />
          )}
          {cot.estado === 'aceptada' && (
            <PanelAceptada cotId={cot.id} idVisita={cot.idVisita} />
          )}
          {cot.estado === 'rechazada' && (
            <PanelRechazada
              cotId={cot.id}
              motivo={cot.motivoRechazo}
              fechaRechazo={updatedAtStr}
            />
          )}
        </div>
      </div>

      {/* Metadata footer */}
      <div className="mt-2.5 pl-1 text-[11px] leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
        <p>Creada el {formatTimestamp(cot.createdAt)}</p>
        {cot.fechaEnvio && <p>Enviada el {formatTimestamp(cot.fechaEnvio)}</p>}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export type PacienteOpcion = { id: number; label: string }

type Props = {
  cotizacion: CotizacionVista
  pacientes: PacienteOpcion[]
  onMarcarEnviada: () => Promise<{ success: boolean; error?: string }>
  onAceptar: (idPaciente?: number) => Promise<{ success: boolean; idVisita?: number; error?: string }>
  onRechazar: (motivo: string) => Promise<{ success: boolean; error?: string }>
}

export function CotizacionLifecycleView({ cotizacion, pacientes, onMarcarEnviada, onAceptar, onRechazar }: Props) {
  const numero = `COT-${String(cotizacion.id).padStart(5, '0')}`
  const isEditable = cotizacion.estado === 'creada'

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-8 shrink-0"
        style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)', height: 60 }}
      >
        <div className="flex items-center gap-2">
          <Link
            href="/cotizaciones"
            className="text-[13px] transition-opacity hover:opacity-70"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Cotizaciones
          </Link>
          <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />
          <span className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>{numero}</span>
          <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />
          <h1 className="text-[16px] font-semibold" style={{ color: 'var(--foreground)' }}>Estado</h1>
          <EstadoBadge estado={cotizacion.estado} size="lg" />
        </div>
        <div className="flex items-center gap-2">
          {isEditable && (
            <Link
              href={`/cotizaciones/${cotizacion.id}/editar`}
              className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
            >
              Editar cotización
            </Link>
          )}
          <Link
            href="/cotizaciones"
            className="flex items-center gap-1 h-9 px-3 rounded-lg text-[13px] transition-opacity hover:opacity-80"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Volver
          </Link>
        </div>
      </div>

      {/* Stepper */}
      <Stepper estado={cotizacion.estado} />

      {/* Body */}
      <div className="grid gap-6 px-8 py-6" style={{ gridTemplateColumns: 'minmax(0,1fr) 380px' }}>
        <QuoteSummary cot={cotizacion} />
        <Rail
          cot={cotizacion}
          pacientes={pacientes}
          onMarcarEnviada={onMarcarEnviada}
          onAceptar={onAceptar}
          onRechazar={onRechazar}
        />
      </div>
    </div>
  )
}
