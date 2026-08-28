'use client'

import { Fragment, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, X, ChevronDown, ChevronRight, Home } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ESTADO_VISITA_STYLES } from '@/lib/estado-colors'
import type {
  VisitaLifecycleDetalle,
  CompletarVisitaData,
  FacturacionVisitaData,
  PagoVisitaData,
  EnvioExamenVisitaItem,
} from '@/lib/actions/visitas'
import { formatDate } from '@/lib/format'
import { FormDatePicker } from '@/components/form-date-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Callout } from '@/components/ui/callout'
import { MetaTile, MetaGrid } from '@/components/ui/meta'
import { Step, Pipe } from '@/components/ui/stepper'
import './visita-lifecycle-view.css'

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

// ─── Stepper ──────────────────────────────────────────────────────────────────

const MAIN_STEPS = ['programada', 'confirmada', 'realizada']
const TERMINAL_STATES = ['completada', 'no_realizada', 'cancelada'] as const

function Stepper({ estado }: { estado: string }) {
  const mainStep = MAIN_STEPS.indexOf(estado)
  const isTerminal = TERMINAL_STATES.includes(estado as typeof TERMINAL_STATES[number])
  const doneMainStep = isTerminal ? 3 : mainStep

  function status(idx: number) {
    if (doneMainStep > idx) return 'done' as const
    if (estado === MAIN_STEPS[idx]) return 'active' as const
    return 'todo' as const
  }

  return (
    <div className="lifebar">
      <div className="hl-stepper">
        <Step status={status(0)}>Programada</Step>
        <Pipe filled={doneMainStep > 0} />
        <Step status={status(1)}>Confirmada</Step>
        <Pipe filled={doneMainStep > 1} />
        <Step status={status(2)}>Realizada</Step>
      </div>

      {/* Terminal fork */}
      <div className={cn('fork', isTerminal && 'is-live')}>
        {(['completada', 'no_realizada', 'cancelada'] as const).map((t, i) => {
          const isActive = estado === t
          const cfg = ESTADO_VISITA_STYLES[t]!
          const tone = t === 'completada' ? 'ok' : t === 'no_realizada' ? 'bad' : 'gray'
          return (
            <Fragment key={t}>
              {i > 0 && <span className="bar">|</span>}
              <span className={cn('fork__opt', isActive && 'is-on', isActive && tone)}>
                {isActive ? (t === 'completada' ? <Check /> : <X />) : <span className="d" />}
                <span className="hidden sm:inline">{cfg.label}</span>
              </span>
            </Fragment>
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
  footer,
}: {
  label: string
  dot: string
  items: { id: number; nombre: string; codigo?: string | null; precio: number; meta?: string | null; detalle?: string | null }[]
  footer?: React.ReactNode
}) {
  if (!items.length) return null
  return (
    <div className="svcgroup">
      <div className="svcgroup__head">
        <span className="d" style={{ background: dot }} />
        <span className="hl-label">{label}</span>
      </div>
      <div className="svclist">
        {items.map((it) => (
          <div key={it.id} className="svclist__row">
            {it.codigo && <Chip>{it.codigo}</Chip>}
            <span className="nm">
              <span className="block truncate">{it.nombre}</span>
              {it.meta && <small>{it.meta}</small>}
              {it.detalle && <small>{it.detalle}</small>}
            </span>
            <span className="pr hl-tnum">{CLP(it.precio)}</span>
          </div>
        ))}
        {footer && (
          <div className="svclist__row" style={{ background: 'var(--color-surface-muted)', fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Left summary ─────────────────────────────────────────────────────────────

function VisitaSummary({ v }: { v: VisitaLifecycleDetalle }) {
  const nombre = v.pacienteNombre ?? 'Sin paciente'
  const initials = v.pacienteNombre ? getInitials(v.pacienteNombre) : '?'
  const isCompleted = v.estado === 'completada'
  const examResultsById = new Map(v.examenResultados.map((r) => [r.idExamen, r]))
  const totalServicios =
    v.procedimientos.reduce((s, x) => s + x.precio, 0) -
    v.montoDescuentoProcedimientos +
    v.examenes.reduce((s, x) => s + x.precio, 0) +
    v.isapreExams.reduce((s, x) => s + x.valorPagar, 0) +
    v.talleres.reduce((s, x) => s + x.precio, 0)

  return (
    <div className="flex flex-col gap-3.5">
      {/* Paciente */}
      <div className="dcard">
        <div className="dcard__head"><span className="hl-label">Paciente</span></div>
        <div className="patient">
          <span className="hl-avatar">{initials}</span>
          <div className="flex-1 min-w-0">
            <b>{nombre}</b>
            {v.pacienteIdentificador && <p className="hl-mono" style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>{v.pacienteIdentificador}</p>}
            {v.pacientePrevision && <p style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>{v.pacientePrevision}</p>}
            <div className="lines">
              {v.pacienteTelefonos.slice(0, 2).map((t, i) => <span key={i}>{t}</span>)}
              {v.pacienteDireccion && (
                <span><Home />{v.pacienteDireccion}</span>
              )}
            </div>
          </div>
          {v.idPaciente && (
            <Link href={`/pacientes/${v.idPaciente}`} style={{ fontSize: 'var(--text-sm)', color: 'var(--brand-blue-fg)', flexShrink: 0 }}>
              Ver →
            </Link>
          )}
        </div>
      </div>

      {/* Programación */}
      <div className="dcard">
        <div className="dcard__head"><span className="hl-label">Programación</span></div>
        <MetaGrid>
          <MetaTile label="Fecha" value={formatDate(v.fecha)} />
          <MetaTile label="Hora" value={v.hora ?? '—'} />
          <MetaTile label="Enfermera" value={v.enfermeraNombre ?? '—'} />
          {v.origenContacto && (
            <MetaTile label="Origen" value={<span style={{ color: 'var(--estado-confirmada-fg)' }}>{v.origenContacto}</span>} />
          )}
        </MetaGrid>
      </div>

      {/* Cierre */}
      {isCompleted && (
        <div className="dcard">
          <div className="dcard__head" style={{ marginBottom: 12 }}>
            <span className="hl-label" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Check style={{ width: 14, height: 14, color: 'var(--ok-fg)' }} />Cierre
            </span>
          </div>
          <MetaGrid>
            <MetaTile label="Documento" value={`${v.tipoDocumento === 'factura' ? 'Factura' : 'Boleta'} N° ${v.numeroBoleta || '—'}`} />
            {v.numeroAtencion && <MetaTile label="N° atención" value={String(v.numeroAtencion)} />}
            <MetaTile label="Pago" value={v.pagado ? <span style={{ color: 'var(--estado-confirmada-fg)' }}>Pagado</span> : 'No registrado'} />
            {v.metodoPago && <MetaTile label="Método" value={v.metodoPago} />}
            {v.fechaPago && <MetaTile label="Fecha pago" value={formatDate(v.fechaPago)} />}
            {v.resultadosTotalCount > 0 && (
              <MetaTile label="Exámenes enviados" value={`${v.resultadosEnviadosCount} de ${v.resultadosTotalCount}`} />
            )}
          </MetaGrid>
        </div>
      )}

      {/* Servicios */}
      <div className="dcard">
        <div className="dcard__head">
          <span className="hl-label">Servicios</span>
          {totalServicios > 0 && (
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>
              Subtotal <strong className="hl-tnum" style={{ color: 'var(--color-fg)' }}>{CLP(totalServicios)}</strong>
            </span>
          )}
        </div>
        <div className="flex flex-col gap-3.5">
          <SvcGroup
            label="Procedimientos"
            dot="var(--tag-blue-dot)"
            items={v.procedimientos.map((p) => ({
              ...p,
              detalle: p.descuento > 0 ? `Descuento: -${CLP(p.descuento)}` : null,
            }))}
          />
          {v.montoDescuentoProcedimientos > 0 && (
            <div className="lineitem" style={{ color: 'var(--color-destructive)' }}>
              <span>Descuento procedimientos</span>
              <span className="pr">-{CLP(v.montoDescuentoProcedimientos)}</span>
            </div>
          )}
          <SvcGroup
            label="Exámenes"
            dot="var(--tag-green-dot)"
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
            dot="var(--tag-violet-dot)"
            items={v.isapreExams.map((e) => {
              const result = examResultsById.get(e.id)
              return {
                id: e.id,
                nombre: e.nombre,
                codigo: e.codigo,
                precio: e.valorPagar,
                meta: isCompleted && result?.enviado && result.fechaEnvio ? `Enviado el ${formatDate(result.fechaEnvio)}` : null,
                detalle: `Valor total ${CLP(e.valorCompleto)} · Bonifica isapre ${CLP(e.valorCompleto - e.valorPagar)}`,
              }
            })}
            footer={
              v.isapreExams.length > 0 ? (
                <>
                  <span>Valor total isapre (referencia, no incluido en el total)</span>
                  <span className="pr hl-tnum shrink-0">{CLP(v.isapreExams.reduce((s, e) => s + e.valorCompleto, 0))}</span>
                </>
              ) : null
            }
          />
          <SvcGroup label="Talleres" dot="var(--tag-amber-dot)" items={v.talleres} />
          {v.cobraVisita && (
            <div className="lineitem">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Home />
                Visita de enfermería
              </span>
              <span className="pr hl-tnum">
                {CLP(v.montoDescuento > 0 ? v.montoVisitaOriginal : v.precioVisita ?? 0)}
              </span>
            </div>
          )}
          {v.montoDescuento > 0 && (
            <div className="lineitem" style={{ color: 'var(--color-destructive)' }}>
              <span>
                Descuento visita{' '}
                {v.descuentoTipo === 'porcentaje' ? `(${v.descuentoValor}%)` : `(${CLP(v.descuentoValor)})`}
              </span>
              <span className="pr hl-tnum">-{CLP(v.montoDescuento)}</span>
            </div>
          )}
          {v.surcharges.map((s) => (
            <div key={s.id} className="lineitem">
              <span>Recargo · <strong>{s.tipoNombre}</strong></span>
              <span className="pr hl-tnum">{CLP(s.precio)}</span>
            </div>
          ))}
          {v.montoInsumos > 0 && (
            <div className="lineitem">
              <span>Insumos</span>
              <span className="pr hl-tnum">{CLP(v.montoInsumos)}</span>
            </div>
          )}
          {v.procedimientos.length === 0 && v.examenes.length === 0 && v.isapreExams.length === 0 && v.talleres.length === 0 && !v.cobraVisita && (
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-fg-muted)' }}>Sin servicios registrados.</p>
          )}
        </div>
        <div className="hl-kv hl-kv--total" style={{ marginTop: 16 }}>
          <dt>Total</dt>
          <dd className="hl-tnum">{CLP(v.costo)}</dd>
        </div>
      </div>

      {/* Notas */}
      {v.informacionAdicional && (
        <div className="dcard">
          <div className="dcard__head" style={{ marginBottom: 8 }}>
            <span className="hl-label">
              Notas <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(solo visible internamente)</span>
            </span>
          </div>
          <p style={{ fontSize: 'var(--text-base)', lineHeight: 1.6, color: 'var(--color-fg)' }}>{v.informacionAdicional}</p>
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
    <div className="rounded-xl overflow-hidden mt-1" style={{ border: '1px solid color-mix(in oklch, var(--color-destructive) 30%, var(--color-border))' }}>
      <div className="flex flex-col gap-2.5 p-3" style={{ background: 'var(--color-destructive-soft)' }}>
        <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-destructive)' }}>Cancelar esta visita</p>
        <div className="hl-fieldgroup">
          <label>
            Motivo de cancelación <span className="req">*</span>
          </label>
          <div className="hl-input" style={{ height: 'auto', padding: '10px 12px', alignItems: 'flex-start' }}>
            <textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="¿Por qué se cancela esta visita?"
              className="w-full resize-none"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" className="flex-1 wfull" onClick={() => onCancelar(motivo)} disabled={!motivo.trim() || isPending}>
            {isPending ? 'Cancelando…' : 'Confirmar cancelación'}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Atrás
          </Button>
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
    <div className="act__body">
      <Callout tone="info">
        Al confirmar, la visita quedará fijada en la agenda. Podrás seguir editando hasta marcarla como realizada.
      </Callout>
      <Button className="wfull" onClick={handleConfirmar} disabled={isPending}>
        {isPending ? 'Procesando…' : 'Confirmar visita'}
      </Button>
      {!showCancel ? (
        <button type="button" onClick={() => setShowCancel(true)} className="text-left bg-transparent border-none cursor-pointer" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-destructive)', padding: '2px 0' }}>
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
    <div className="act__body">
      <Button className="wfull" onClick={handleRealizada} disabled={isPending || !hasAssignedNurse}>
        {isPending ? 'Procesando…' : 'Marcar como realizada'}
      </Button>
      {!hasAssignedNurse && (
        <Callout tone="warn">Para marcar esta visita como realizada, primero asigna una enfermera.</Callout>
      )}

      {/* No realizada accordion */}
      <div className={cn('hl-disclosure', action === 'no_realizada' && 'is-open')} style={{ overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setAction(action === 'no_realizada' ? null : 'no_realizada')}
          style={{ width: '100%', border: 0, background: 'transparent', cursor: 'pointer' }}
        >
          <span className="flex items-center gap-2" style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>
            <X style={{ width: 14, height: 14 }} strokeWidth={2.5} />No realizada
            <ChevronDown className="chev" style={{ marginLeft: 'auto', transform: action === 'no_realizada' ? 'rotate(180deg)' : 'none' }} />
          </span>
        </button>
        {action === 'no_realizada' && (
          <div className="hl-disclosure__body">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)', lineHeight: 1.5 }}>
              La visita no pudo realizarse. Puedes registrar un cobro por concepto de traslado u otro.
            </p>
            <div className="hl-fieldgroup">
              <label>Monto a cobrar</label>
              <div className="hl-input">
                <span className="hl-affix" style={{ width: 'auto', height: 'auto' }}>$</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={costo}
                  onChange={(e) => setCosto(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="hl-fieldgroup">
              <label>Concepto <span style={{ color: 'var(--color-fg-muted)', fontWeight: 400 }}>(opcional)</span></label>
              <div className="hl-input">
                <input
                  type="text"
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  placeholder="Ej: Cobro por traslado"
                />
              </div>
            </div>
            <Button variant="secondary" className="wfull" onClick={handleNoRealizada} disabled={isPending}>
              {isPending ? 'Procesando…' : 'Confirmar no realizada'}
            </Button>
          </div>
        )}
      </div>

      {/* Cancel */}
      {action !== 'cancelar' ? (
        <button type="button" onClick={() => setAction('cancelar')} className="text-left bg-transparent border-none cursor-pointer" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-destructive)', padding: '2px 0' }}>
          Cancelar visita…
        </button>
      ) : (
        <CancelInline onClose={() => setAction(null)} onCancelar={handleCancelar} isPending={isPending} />
      )}
    </div>
  )
}

// ─── Completion accordion section ─────────────────────────────────────────────

type SectionStatus = 'guardado' | 'sin-guardar' | 'pendiente'

function CompletionSection({
  num,
  title,
  done,
  dirty,
  open,
  onToggle,
  summary,
  children,
}: {
  num: number
  title: string
  done: boolean
  dirty?: boolean
  open: boolean
  onToggle: () => void
  summary?: string | null
  children: React.ReactNode
}) {
  const status: SectionStatus = dirty ? 'sin-guardar' : done ? 'guardado' : 'pendiente'
  return (
    <div className={cn('cs', done && 'is-completo', open && 'is-open')}>
      <button type="button" onClick={onToggle} className="cs__head">
        <span className="cs__num">{done ? <Check style={{ width: 11, height: 11 }} strokeWidth={3.5} /> : num}</span>
        <span className="cs__title">{title}</span>
        {!open && status === 'sin-guardar' && (
          <span style={{ fontSize: 'var(--text-xs)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--warn-bg)', color: 'var(--warn-fg)' }}>Sin guardar</span>
        )}
        {!open && status === 'pendiente' && (
          <span style={{ fontSize: 'var(--text-xs)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface-muted)', color: 'var(--color-fg-muted)' }}>Pendiente</span>
        )}
        {!open && status === 'guardado' && (
          <span style={{ fontSize: 'var(--text-xs)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--ok-bg)', color: 'var(--ok-fg)' }}>Guardado</span>
        )}
        <ChevronDown className="cs__chev" />
      </button>

      {!open && done && summary && (
        <div className="cs__summary">{summary}</div>
      )}

      {open && <div className="cs__body">{children}</div>}
    </div>
  )
}

// ─── Panel: realizada ───────────────────────────────────────────────────────

type CompletionSectionId = 'facturacion' | 'pago' | 'examenes'

type CompletionError = {
  section: CompletionSectionId
  message: string
  field?: 'boleta' | 'atencion' | 'pagado' | 'metodo' | 'fechaPago'
  examIds?: number[]
}

function InlineError({ children }: { children: string }) {
  return (
    <p style={{ fontSize: 'var(--text-xs)', lineHeight: 1.4, color: 'var(--color-destructive)' }}>
      {children}
    </p>
  )
}

function PanelRealizada({
  visita,
  onCompletar,
  onGuardarFacturacion,
  onGuardarPago,
  onGuardarExamenes,
}: {
  visita: VisitaLifecycleDetalle
  onCompletar: (data: CompletarVisitaData) => Promise<{ success: boolean; error?: string }>
  onGuardarFacturacion: (data: FacturacionVisitaData) => Promise<{ success: boolean; error?: string }>
  onGuardarPago: (data: PagoVisitaData) => Promise<{ success: boolean; error?: string }>
  onGuardarExamenes: (examenes: EnvioExamenVisitaItem[]) => Promise<{ success: boolean; error?: string }>
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

  // Última versión guardada en el servidor de cada sección — se usa para detectar cambios sin guardar.
  const [savedFacturacion, setSavedFacturacion] = useState({ tipoDoc, boleta, atencion })
  const [savedPago, setSavedPago] = useState({ pagado, metodo, fechaPago })
  const [savedExamenes, setSavedExamenes] = useState(examenes)

  const [isPending, startTransition] = useTransition()
  const [isPendingFacturacion, startFacturacionTransition] = useTransition()
  const [isPendingPago, startPagoTransition] = useTransition()
  const [isPendingExamenes, startExamenesTransition] = useTransition()
  const [completionError, setCompletionError] = useState<CompletionError | null>(null)

  const facturacionDone = !!(tipoDoc && boleta.trim())
  const pagoDone = !!(pagado && metodo && fechaPago)
  const hasExamenes = examenes.length > 0
  const examenesDone = !hasExamenes || examenes.every((e) => e.enviado && e.fecha)
  const tasks = hasExamenes ? [facturacionDone, pagoDone, examenesDone] : [facturacionDone, pagoDone]
  const doneTasks = tasks.filter(Boolean).length
  const allDone = tasks.every(Boolean)

  const facturacionDirty = tipoDoc !== savedFacturacion.tipoDoc || boleta !== savedFacturacion.boleta || atencion !== savedFacturacion.atencion
  const pagoDirty = pagado !== savedPago.pagado || metodo !== savedPago.metodo || fechaPago !== savedPago.fechaPago
  const examenesDirty = examenes.some((e) => {
    const s = savedExamenes.find((x) => x.idExamen === e.idExamen)
    return !s || s.enviado !== e.enviado || s.fecha !== e.fecha
  })
  const hayCambiosSinGuardar = facturacionDirty || pagoDirty || (hasExamenes && examenesDirty)

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

  function handleGuardarFacturacion(advance: boolean) {
    setCompletionError(null)
    startFacturacionTransition(async () => {
      const data: FacturacionVisitaData = {
        tipoDocumento: tipoDoc,
        numeroBoleta: boleta,
        numeroAtencion: atencion ? Number(atencion) : null,
      }
      const result = await onGuardarFacturacion(data)
      if (result.success) {
        toast.success('Facturación guardada')
        setSavedFacturacion({ tipoDoc, boleta, atencion })
        if (advance) setOpenSec('pago')
        router.refresh()
      } else {
        const message = result.error ?? 'Error al guardar la facturación'
        const serverError = completionErrorFromServer(message)
        setCompletionError(serverError)
        toast.error(message)
      }
    })
  }

  function handleGuardarPago(advance: boolean) {
    setCompletionError(null)
    startPagoTransition(async () => {
      const data: PagoVisitaData = {
        pagado,
        metodoPago: pagado ? metodo : null,
        fechaPago: pagado ? fechaPago : null,
      }
      const result = await onGuardarPago(data)
      if (result.success) {
        toast.success('Pago guardado')
        setSavedPago({ pagado, metodo, fechaPago })
        if (advance) setOpenSec('examenes')
        router.refresh()
      } else {
        const message = result.error ?? 'Error al guardar el pago'
        const serverError = completionErrorFromServer(message)
        setCompletionError(serverError)
        toast.error(message)
      }
    })
  }

  function handleGuardarExamenes() {
    setCompletionError(null)
    startExamenesTransition(async () => {
      const data: EnvioExamenVisitaItem[] = examenes.map((e) => ({
        idExamen: e.idExamen,
        enviado: e.enviado,
        fechaEnvio: e.enviado ? (e.fecha || null) : null,
      }))
      const result = await onGuardarExamenes(data)
      if (result.success) {
        toast.success('Envío de exámenes guardado')
        setSavedExamenes(examenes)
        router.refresh()
      } else {
        const message = result.error ?? 'Error al guardar el envío de exámenes'
        const serverError = completionErrorFromServer(message)
        setCompletionError(serverError)
        toast.error(message)
      }
    })
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
    <div className="act__body">
      {/* Progress bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {tasks.map((done, i) => (
            <div key={i} style={{ width: 28, height: 4, borderRadius: 'var(--radius-full)', background: done ? 'var(--ok-fg)' : 'var(--color-border)' }} />
          ))}
        </div>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>{doneTasks} de {tasks.length} completadas</span>
      </div>

      {/* 1: Facturación */}
      <CompletionSection num={1} title="Facturación" done={facturacionDone} dirty={facturacionDirty} open={openSec === 'facturacion'} onToggle={() => toggle('facturacion')} summary={facturacionSummary}>
        <div className="hl-fieldgroup">
          <label>Tipo documento <span className="req">*</span></label>
          <div className="segm" style={{ display: 'flex', gap: 8, background: 'transparent', border: 0, padding: 0 }}>
            {(['boleta', 'factura'] as const).map((opt) => (
              <Button key={opt} type="button" variant={tipoDoc === opt ? 'default' : 'secondary'} className="flex-1 capitalize" onClick={() => setTipoDoc(opt)}>
                {opt}
              </Button>
            ))}
          </div>
        </div>
        <div className="hl-fieldgroup">
          <label>N° de {tipoDoc} <span className="req">*</span></label>
          <div className="hl-input" style={completionError?.field === 'boleta' ? { borderColor: 'var(--color-destructive)' } : undefined}>
            <input value={boleta} onChange={(e) => { setCompletionError(null); setBoleta(e.target.value) }} placeholder="Ej: 001234" />
          </div>
          {completionError?.field === 'boleta' && <InlineError>{completionError.message}</InlineError>}
        </div>
        <div className="hl-fieldgroup">
          <label>
            N° de atención <span style={{ fontWeight: 400, color: 'var(--color-fg-muted)' }}>(opcional)</span>
          </label>
          <div className="hl-input" style={completionError?.field === 'atencion' ? { borderColor: 'var(--color-destructive)' } : undefined}>
            <input value={atencion} onChange={(e) => { setCompletionError(null); setAtencion(e.target.value) }} placeholder="Ej: 98765" type="number" min="1" max="2147483647" />
          </div>
          {completionError?.field === 'atencion' && <InlineError>{completionError.message}</InlineError>}
        </div>
        <Button className="wfull hl-btn--sm" style={{ background: 'var(--ok-fg)', borderColor: 'var(--ok-fg)' }} onClick={() => handleGuardarFacturacion(facturacionDone)} disabled={!facturacionDirty || isPendingFacturacion}>
          {isPendingFacturacion ? 'Guardando…' : facturacionDone ? <>Guardar y continuar <ChevronRight style={{ width: 14, height: 14 }} /></> : 'Guardar'}
        </Button>
      </CompletionSection>

      {/* 2: Pago */}
      <CompletionSection num={2} title="Pago" done={pagoDone} dirty={pagoDirty} open={openSec === 'pago'} onToggle={() => toggle('pago')} summary={pagoSummary}>
        <button
          type="button"
          onClick={() => { setCompletionError(null); setPagado(!pagado) }}
          className={cn('pay-toggle', pagado && 'is-on')}
          style={completionError?.field === 'pagado' ? { borderColor: 'var(--color-destructive)' } : undefined}
        >
          <span className="hl-checkbox" data-checked={pagado ? '' : undefined}>
            {pagado && <Check style={{ width: 11, height: 11 }} strokeWidth={3.5} />}
          </span>
          <b>Marcar como pagada</b>
        </button>
        {completionError?.field === 'pagado' && <InlineError>{completionError.message}</InlineError>}
        {pagado && (
          <>
            <div className="hl-fieldgroup">
              <label>Método de pago <span className="req">*</span></label>
              <div className="flex flex-wrap gap-2">
                {['Efectivo', 'Transferencia', 'Débito', 'Crédito'].map((opt) => (
                  <Button key={opt} type="button" size="sm" variant={metodo === opt ? 'default' : 'secondary'} onClick={() => { setCompletionError(null); setMetodo(opt) }}>
                    {opt}
                  </Button>
                ))}
              </div>
              {completionError?.field === 'metodo' && <InlineError>{completionError.message}</InlineError>}
            </div>
            <div className="hl-fieldgroup">
              <label>Fecha de pago <span className="req">*</span></label>
              <FormDatePicker
                mode="single"
                value={fechaPago || undefined}
                onChange={(value) => { setCompletionError(null); setFechaPago(value ?? '') }}
                weekStartsOn={1}
                placeholder="Seleccionar fecha"
                className={completionError?.field === 'fechaPago' ? 'has-error' : undefined}
              />
              {completionError?.field === 'fechaPago' && <InlineError>{completionError.message}</InlineError>}
            </div>
          </>
        )}
        <Button className="wfull hl-btn--sm" style={{ background: 'var(--ok-fg)', borderColor: 'var(--ok-fg)' }} onClick={() => handleGuardarPago(pagoDone && hasExamenes)} disabled={!pagoDirty || isPendingPago}>
          {isPendingPago ? 'Guardando…' : pagoDone && hasExamenes ? <>Guardar y continuar <ChevronRight style={{ width: 14, height: 14 }} /></> : 'Guardar'}
        </Button>
      </CompletionSection>

      {/* 3: Exámenes */}
      {hasExamenes && (
        <CompletionSection num={3} title="Envío de exámenes" done={examenesDone} dirty={examenesDirty} open={openSec === 'examenes'} onToggle={() => toggle('examenes')} summary={examenesSummary}>
          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="hl-progress flex-1">
              <i style={{ width: `${(examSent / examenes.length) * 100}%` }} />
            </div>
            <span className="hl-tnum shrink-0" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>{examSent}/{examenes.length}</span>
          </div>

          {allExamsWithMeta.map((ex) => {
            const st = examenes.find((e) => e.idExamen === ex.id)!
            const rowDone = st.enviado && st.fecha
            const rowError = completionError?.examIds?.includes(ex.id) && !rowDone
            return (
              <div key={ex.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${rowError ? 'var(--color-destructive)' : rowDone ? 'color-mix(in oklch, var(--ok-fg) 30%, var(--color-border))' : 'var(--color-border)'}` }}>
                <button type="button" onClick={() => updateExamen(ex.id, { enviado: !st.enviado, fecha: st.enviado ? '' : st.fecha })}
                  className="w-full flex items-center gap-3 px-3.5 py-3 text-left transition-all"
                  style={{ background: st.enviado ? 'var(--ok-bg)' : 'var(--color-surface)', border: 'none', cursor: 'pointer' }}>
                  <span className="hl-checkbox" data-checked={st.enviado ? '' : undefined}>
                    {st.enviado && <Check style={{ width: 10, height: 10 }} strokeWidth={3.5} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: st.enviado ? 'var(--ok-fg)' : 'var(--color-fg)' }}>{ex.nombre}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Chip>{ex.codigo}</Chip>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>{ex.grupo}</span>
                    </div>
                  </div>
                  {st.enviado && !st.fecha && <span style={{ fontSize: 'var(--text-xs)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--warn-bg)', color: 'var(--warn-fg)' }}>Falta fecha</span>}
                  {rowError && !st.enviado && <span style={{ fontSize: 'var(--text-xs)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-destructive-soft)', color: 'var(--color-destructive)' }}>Falta enviar</span>}
                  {rowDone && <Check style={{ width: 14, height: 14, color: 'var(--ok-fg)' }} />}
                </button>
                {st.enviado && (
                  <div className="px-3.5 pb-3 pt-2" style={{ borderTop: '1px solid color-mix(in oklch, var(--ok-fg) 15%, var(--color-border))', paddingLeft: 50 }}>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, display: 'block', marginBottom: 4, color: 'var(--color-fg-muted)' }}>Fecha de envío <span className="req">*</span></label>
                    <FormDatePicker
                      mode="single"
                      value={st.fecha || undefined}
                      onChange={(value) => updateExamen(ex.id, { fecha: value ?? '' })}
                      weekStartsOn={1}
                      placeholder="Fecha envío"
                      className={rowError && !st.fecha ? 'has-error' : undefined}
                    />
                  </div>
                )}
              </div>
            )
          })}
          {completionError?.section === 'examenes' && <InlineError>{completionError.message}</InlineError>}
          <Button className="wfull hl-btn--sm" style={{ background: 'var(--ok-fg)', borderColor: 'var(--ok-fg)' }} onClick={() => handleGuardarExamenes()} disabled={!examenesDirty || isPendingExamenes}>
            {isPendingExamenes ? 'Guardando…' : 'Guardar'}
          </Button>
        </CompletionSection>
      )}

      {/* CTA */}
      <Button className="wfull" style={{ height: 48, fontSize: 'var(--text-md)', fontWeight: 700, marginTop: 8 }} onClick={handleCompletar} disabled={isPending} aria-disabled={!allDone || isPending}>
        {isPending ? 'Completando…' : allDone ? <><Check />Completar visita</> : 'Completar visita'}
      </Button>
      {!allDone && (
        <p style={{ fontSize: 'var(--text-sm)', textAlign: 'center', marginTop: 6, color: 'var(--color-fg-muted)' }}>
          Completa las {tasks.length - doneTasks} sección{tasks.length - doneTasks !== 1 ? 'es' : ''} pendiente{tasks.length - doneTasks !== 1 ? 's' : ''} para habilitar
        </p>
      )}
      {allDone && hayCambiosSinGuardar && (
        <p style={{ fontSize: 'var(--text-sm)', textAlign: 'center', marginTop: 6, color: 'var(--warn-fg)' }}>
          Hay cambios sin guardar en pantalla — se guardarán al completar la visita
        </p>
      )}
    </div>
  )
}

// ─── Panel: completada ────────────────────────────────────────────────────────

function PanelCompletada({ v }: { v: VisitaLifecycleDetalle }) {
  const enviados = v.examenResultados.filter((r) => r.enviado).length

  return (
    <div className="act__body">
      <Callout tone="ok">Visita completada</Callout>
      <div className="dcard" style={{ padding: 16 }}>
        <span className="hl-label" style={{ display: 'block', marginBottom: 8 }}>Facturación</span>
        <div className="hl-kv"><dt>Documento</dt><dd>{`${v.tipoDocumento === 'boleta' ? 'Boleta' : 'Factura'} N° ${v.numeroBoleta}`}</dd></div>
        {v.numeroAtencion && <div className="hl-kv"><dt>N° atención</dt><dd>{v.numeroAtencion}</dd></div>}
      </div>
      <div className="dcard" style={{ padding: 16 }}>
        <span className="hl-label" style={{ display: 'block', marginBottom: 8 }}>Pago</span>
        {v.pagado ? (
          <>
            <div className="hl-kv"><dt>Estado</dt><dd>Pagado</dd></div>
            {v.metodoPago && <div className="hl-kv"><dt>Método</dt><dd>{v.metodoPago}</dd></div>}
            {v.fechaPago && <div className="hl-kv"><dt>Fecha</dt><dd>{v.fechaPago}</dd></div>}
          </>
        ) : (
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-fg-muted)' }}>No registrado como pagado</p>
        )}
      </div>
      {v.resultadosTotalCount > 0 && (
        <div className="dcard" style={{ padding: 16 }}>
          <span className="hl-label" style={{ display: 'block', marginBottom: 8 }}>Exámenes</span>
          <div className="hl-kv"><dt>Enviados</dt><dd>{`${enviados} de ${v.resultadosTotalCount}`}</dd></div>
        </div>
      )}
    </div>
  )
}

// ─── Panel: no_realizada ──────────────────────────────────────────────────────

function PanelNoRealizada({ v }: { v: VisitaLifecycleDetalle }) {
  return (
    <div className="act__body">
      <Callout tone="bad">Visita no realizada</Callout>
      {v.costoTraslado > 0 && (
        <div className="dcard" style={{ padding: 16 }}>
          <div className="hl-kv"><dt>{v.conceptoNoRealizada || 'Cobro'}</dt><dd className="hl-tnum" style={{ fontWeight: 600 }}>{CLP(v.costoTraslado)}</dd></div>
        </div>
      )}
      {v.costoTraslado === 0 && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>Sin cobro registrado.</p>
      )}
    </div>
  )
}

// ─── Panel: cancelada ─────────────────────────────────────────────────────────

function PanelCancelada({ v }: { v: VisitaLifecycleDetalle }) {
  return (
    <div className="act__body">
      <Callout tone="bad">Visita cancelada</Callout>
      {v.motivoCancelacion && (
        <div className="dcard" style={{ padding: 16 }}>
          <span className="hl-label" style={{ display: 'block', marginBottom: 8 }}>Motivo</span>
          <p style={{ fontSize: 'var(--text-base)', lineHeight: 1.6, color: 'var(--color-fg)' }}>{v.motivoCancelacion}</p>
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
  onGuardarFacturacion: (data: FacturacionVisitaData) => Promise<{ success: boolean; error?: string }>
  onGuardarPago: (data: PagoVisitaData) => Promise<{ success: boolean; error?: string }>
  onGuardarExamenes: (examenes: EnvioExamenVisitaItem[]) => Promise<{ success: boolean; error?: string }>
}

const EDITABLE_STATES = ['programada', 'confirmada', 'realizada']

export function VisitaLifecycleView({
  visita,
  onConfirmar,
  onMarcarRealizada,
  onMarcarNoRealizada,
  onCancelar,
  onCompletar,
  onGuardarFacturacion,
  onGuardarPago,
  onGuardarExamenes,
}: Props) {
  const isEditable = EDITABLE_STATES.includes(visita.estado)
  const isCompleted = visita.estado === 'completada'
  const visitCode = `V-${String(visita.id).padStart(5, '0')}`
  const cfg = ESTADO_VISITA_STYLES[visita.estado] ?? ESTADO_VISITA_STYLES['programada']!

  const actTitle =
    visita.estado === 'cancelada' ? 'Visita cancelada' :
    visita.estado === 'no_realizada' ? 'No realizada' :
    'Acción'

  return (
    <div className="hl-root">
      {/* Stepper bar — escapa el padding de .app-body para quedar edge-to-edge, mismo
          truco que usa el dashboard (-m-8 en el código anterior a este paso). */}
      <div style={{ margin: '-28px -32px 20px' }}>
        <Stepper estado={visita.estado} />
      </div>

      {/* Header */}
      <div className="page-head">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {visitCode}
            <Badge badgeClass={cfg.badgeClass}>{cfg.label}</Badge>
          </h1>
          <p className="page-head__meta hl-tnum">{CLP(visita.costo)}</p>
        </div>
        <div className="page-head__actions">
          {isEditable && (
            <Button variant="secondary" asChild>
              <Link href={`/visitas/${visita.id}/editar`}>Editar visita</Link>
            </Button>
          )}
          <Button variant="ghost" asChild>
            <Link href="/visitas">← Volver</Link>
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className={isCompleted ? '' : 'split'}>
        {/* Left: summary */}
        <div style={{ minWidth: 0 }}>
          <VisitaSummary v={visita} />
        </div>

        {/* Right: action rail */}
        {!isCompleted && (
          <div className="hl-rail" style={{ position: 'sticky', top: 20 }}>
            <div className="hl-rail__card">
              <div className="act__head">
                <h3>{actTitle}</h3>
              </div>

              {visita.estado === 'programada' && (
                <PanelProgramada visitId={visita.id} onConfirmar={onConfirmar} onCancelar={onCancelar} />
              )}
              {visita.estado === 'confirmada' && (
                <PanelConfirmada visitId={visita.id} hasAssignedNurse={visita.idEnfermera !== null} onMarcarRealizada={onMarcarRealizada} onMarcarNoRealizada={onMarcarNoRealizada} onCancelar={onCancelar} />
              )}
              {visita.estado === 'realizada' && (
                <PanelRealizada
                  visita={visita}
                  onCompletar={onCompletar}
                  onGuardarFacturacion={onGuardarFacturacion}
                  onGuardarPago={onGuardarPago}
                  onGuardarExamenes={onGuardarExamenes}
                />
              )}
              {visita.estado === 'no_realizada' && <PanelNoRealizada v={visita} />}
              {visita.estado === 'cancelada' && <PanelCancelada v={visita} />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
