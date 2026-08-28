'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Check,
  X,
  Printer,
  Home,
  ChevronDown,
} from 'lucide-react'
import { SelectCombobox } from '@/components/select-combobox'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { CotizacionVista } from '@/lib/actions/cotizaciones'
import { ESTADO_COTIZACION_STYLES } from '@/lib/estado-colors'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Tag } from '@/components/ui/tag'
import { Callout } from '@/components/ui/callout'
import { MetaTile, MetaGrid } from '@/components/ui/meta'
import { Step, Pipe } from '@/components/ui/stepper'
import './cotizacion-lifecycle-view.css'

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

const ESTADO_CFG = ESTADO_COTIZACION_STYLES as Record<EstadoKey, { label: string; badgeClass: string; step: number }>

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CFG[estado as EstadoKey]
  if (!cfg) return <Badge badgeClass="is-cot-rechazada">Inválido: {estado}</Badge>
  return <Badge badgeClass={cfg.badgeClass}>{cfg.label}</Badge>
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ estado }: { estado: string }) {
  const step = ESTADO_CFG[estado as EstadoKey]?.step ?? 0

  return (
    <div className="stepbar">
      <div className="hl-stepper">
        <Step status={step > 0 ? 'done' : estado === 'creada' ? 'active' : 'todo'}>Creada</Step>
        <Pipe filled={step > 0} />
        <Step status={step > 1 ? 'done' : estado === 'enviada' ? 'active' : 'todo'}>Enviada</Step>
        <Pipe filled={step > 1} />
        {estado === 'rechazada' ? (
          <Step status="bad">Rechazada</Step>
        ) : estado === 'aceptada' ? (
          <Step status="done">Aceptada</Step>
        ) : (
          <div className="flex items-center gap-2">
            <Step status="todo">Aceptada</Step>
            <span style={{ color: 'var(--color-fg-subtle)', fontSize: 11 }}>o</span>
            <Step status="todo">Rechazada</Step>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Summary: left column ──────────────────────────────────────────────────────

function SvcGroup({
  label,
  dotTone,
  items,
}: {
  label: string
  dotTone: 'blue' | 'green' | 'violet' | 'amber'
  items: { id: number; nombre: string; codigo: string | null; precio: number }[]
}) {
  if (!items.length) return null
  return (
    <>
      <div className="sect-title">
        <span className="hl-label" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: `var(--tag-${dotTone}-dot)` }} />
          {label}
        </span>
        <span className="hl-tnum" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>
          {items.length} ítem{items.length !== 1 ? 's' : ''} · {CLP(items.reduce((s, x) => s + x.precio, 0))}
        </span>
      </div>
      <div style={{ padding: '2px 18px' }}>
        {items.map((it) => (
          <div key={it.id} className="item-line">
            <div className="item-line__left">
              {it.codigo && <Chip>{it.codigo}</Chip>}
              <span>{it.nombre}</span>
            </div>
            <span className="hl-tnum">{CLP(it.precio)}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function QuoteSummary({ cot }: { cot: CotizacionVista }) {
  const displayName = cot.pacienteNombre ?? cot.nombreDestinatario ?? 'Sin destinatario'
  const initials = displayName !== 'Sin destinatario' ? getInitials(displayName) : '?'

  const sinServicios = cot.procedimientos.length === 0 && cot.examenes.length === 0 && cot.isapreExams.length === 0 && cot.talleres.length === 0

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Destinatario */}
      <div className="hl-card">
        <div className="hl-label" style={{ marginBottom: 14 }}>Destinatario</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <span className="hl-avatar" style={{ width: 40, height: 40, fontSize: 'var(--text-md)' }}>{initials}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>{displayName}</div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--color-fg-muted)', marginTop: 2 }}>
              {[cot.emailDestinatario, cot.telefonoDestinatario].filter(Boolean).join(' · ')}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {cot.identificacionDestinatario && <Chip>{cot.identificacionDestinatario}</Chip>}
              {cot.comuna && <Tag noDot>{cot.comuna}</Tag>}
              {!cot.idPaciente && <Tag tone="amber">Sin paciente asociado</Tag>}
            </div>
          </div>
        </div>
      </div>

      {/* Servicios + cargos adicionales */}
      <div className="hl-card hl-card--flush">
        <SvcGroup label="Procedimientos" dotTone="blue" items={cot.procedimientos} />
        {cot.montoDescuentoProcedimientos > 0 && (
          <div className="item-line" style={{ padding: '0 18px', color: 'var(--color-destructive)' }}>
            <span>Descuento procedimientos</span>
            <span className="hl-tnum">-{CLP(cot.montoDescuentoProcedimientos)}</span>
          </div>
        )}
        <SvcGroup label="Exámenes" dotTone="green" items={cot.examenes} />
        <SvcGroup
          label="Exámenes Isapre"
          dotTone="violet"
          items={cot.isapreExams.map((e) => ({ id: e.id, nombre: e.nombre, codigo: e.codigo, precio: e.valorPagar }))}
        />
        <SvcGroup label="Talleres" dotTone="amber" items={cot.talleres} />
        {sinServicios && (
          <p style={{ padding: 18, margin: 0, fontSize: 'var(--text-base)', color: 'var(--color-fg-muted)' }}>Sin servicios registrados.</p>
        )}

        {(cot.cobraVisita || cot.surcharges.length > 0 || cot.montoInsumos > 0) && (
          <>
            <div className="sect-title"><span className="hl-label">Cargos adicionales</span></div>
            <div style={{ padding: '2px 18px 12px' }}>
              {cot.cobraVisita && (
                <div className="item-line">
                  <div className="item-line__left">
                    <Home style={{ width: 13, height: 13, color: 'var(--color-fg-muted)' }} />
                    <span>Visita a domicilio · <strong>{cot.comuna}</strong></span>
                  </div>
                  <span className="hl-tnum">{CLP(cot.montoDescuento > 0 ? cot.montoVisitaOriginal : cot.precioVisita)}</span>
                </div>
              )}
              {cot.montoDescuento > 0 && (
                <div className="item-line" style={{ color: 'var(--color-destructive)' }}>
                  <span>Descuento visita</span>
                  <span className="hl-tnum">-{CLP(cot.montoDescuento)}</span>
                </div>
              )}
              {cot.surcharges.map((s) => (
                <div key={s.id} className="item-line">
                  <div className="item-line__left"><span>Recargo</span><Tag tone="amber">{s.tipoNombre}</Tag></div>
                  <span className="hl-tnum">{CLP(s.precio)}</span>
                </div>
              ))}
              {cot.montoInsumos > 0 && (
                <div className="item-line">
                  <span>Insumos</span>
                  <span className="hl-tnum">{CLP(cot.montoInsumos)}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Notas */}
      {cot.notas && (
        <div className="hl-card">
          <div className="hl-label" style={{ marginBottom: 10 }}>
            Notas <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(solo visible internamente)</span>
          </div>
          <p style={{ margin: 0, fontSize: 'var(--text-base)', lineHeight: 1.6, color: 'var(--color-fg-muted)' }}>{cot.notas}</p>
        </div>
      )}
    </div>
  )
}

// ─── Panels: right column ───────────────────────────────────────────────────────

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
    <div className="hl-rail__body">
      <Callout tone="info">
        Al marcar como <strong>enviada</strong>, esta cotización dejará de ser editable.
      </Callout>
      <Button className="wfull" onClick={handleMarcar} disabled={isPending}>
        {isPending ? 'Procesando…' : 'Marcar como enviada'}
      </Button>
      <Button variant="secondary" className="wfull" asChild>
        <a href={`/api/cotizacion-standalone/${cotId}`} target="_blank" rel="noopener noreferrer">
          <Printer />
          Imprimir / PDF
        </a>
      </Button>
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
    <div className="hl-rail__body">
      <span className="hl-label">Resultado de la cotización</span>

      {/* Aceptar */}
      <div className={cn('hl-disclosure', action === 'aceptar' && 'is-open')} style={{ overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setAction(action === 'aceptar' ? null : 'aceptar')}
          style={{ width: '100%', border: 0, background: 'transparent', cursor: 'pointer', padding: '9px 12px' }}
        >
          <span className="flex items-center gap-2" style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>
            <Check style={{ width: 15, height: 15 }} strokeWidth={2.5} />
            Aceptada
            <ChevronDown className="chev" style={{ marginLeft: 'auto', transform: action === 'aceptar' ? 'rotate(180deg)' : 'none' }} />
          </span>
        </button>
        {action === 'aceptar' && (
          <div className="hl-disclosure__body">
            {hasPaciente ? (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)', lineHeight: 1.5 }}>
                La cotización tiene un paciente registrado. Al aceptar se creará la visita automáticamente.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)', lineHeight: 1.5 }}>
                  Esta cotización no tiene paciente asociado. Selecciona uno para crear la visita.
                </p>
                <div className="hl-fieldgroup">
                  <label>Paciente <span className="req">*</span></label>
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
            <Button className="wfull" onClick={handleAceptar} disabled={!canAceptar || isPending}>
              {isPending ? 'Creando visita…' : 'Aceptar y crear visita'}
            </Button>
          </div>
        )}
      </div>

      {/* Rechazar */}
      <div className={cn('hl-disclosure hl-disclosure--danger', action === 'rechazar' && 'is-open')} style={{ overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setAction(action === 'rechazar' ? null : 'rechazar')}
          style={{ width: '100%', border: 0, background: 'transparent', cursor: 'pointer', padding: '9px 12px' }}
        >
          <span className="flex items-center gap-2" style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>
            <X style={{ width: 14, height: 14 }} />
            Rechazada
            <ChevronDown className="chev" style={{ marginLeft: 'auto', transform: action === 'rechazar' ? 'rotate(180deg)' : 'none' }} />
          </span>
        </button>
        {action === 'rechazar' && (
          <div className="hl-disclosure__body">
            <div className="hl-fieldgroup">
              <label>Motivo de rechazo <span className="req">*</span></label>
              <div className="hl-input" style={{ height: 'auto', padding: '10px 12px', alignItems: 'flex-start' }}>
                <textarea
                  rows={3}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="¿Por qué fue rechazada esta cotización?"
                  className="w-full resize-none"
                />
              </div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>Queda registrado internamente.</span>
            </div>
            <Button variant="destructive" className="wfull" onClick={handleRechazar} disabled={!canRechazar || isPending}>
              {isPending ? 'Procesando…' : 'Confirmar rechazo'}
            </Button>
          </div>
        )}
      </div>

      <Button variant="secondary" className="wfull" asChild>
        <a href={`/api/cotizacion-standalone/${cotId}`} target="_blank" rel="noopener noreferrer">
          <Printer />
          Imprimir / PDF
        </a>
      </Button>
    </div>
  )
}

// Panel: aceptada
function PanelAceptada({ cotId, idVisita }: { cotId: number; idVisita: number | null }) {
  return (
    <div className="hl-rail__body">
      <Callout tone="ok">
        Cotización aceptada.{idVisita ? ` Se creó la visita V-${String(idVisita).padStart(4, '0')}.` : ''}
      </Callout>
      {idVisita && (
        <Button variant="secondary" className="wfull" asChild>
          <Link href={`/visitas/${idVisita}`}>Ver visita V-{String(idVisita).padStart(4, '0')}</Link>
        </Button>
      )}
      <Button variant="secondary" className="wfull" asChild>
        <a href={`/api/cotizacion-standalone/${cotId}`} target="_blank" rel="noopener noreferrer">
          <Printer />
          Imprimir / PDF
        </a>
      </Button>
    </div>
  )
}

// Panel: rechazada
function PanelRechazada({ cotId, motivo, fechaRechazo }: { cotId: number; motivo: string | null; fechaRechazo: string }) {
  return (
    <div className="hl-rail__body">
      <Callout tone="bad">
        <b style={{ display: 'block' }}>Motivo de rechazo</b>
        {motivo ?? 'Sin motivo registrado.'}
        <span style={{ display: 'block', marginTop: 6, fontSize: 'var(--text-xs)' }}>Registrado el {fechaRechazo}</span>
      </Callout>
      <Button variant="secondary" className="wfull" asChild>
        <a href={`/api/cotizacion-standalone/${cotId}`} target="_blank" rel="noopener noreferrer">
          <Printer />
          Imprimir / PDF
        </a>
      </Button>
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

  return (
    <div className="hl-rail" style={{ position: 'sticky', top: 20 }}>
      <div className="hl-rail__card">
        <div className="hl-rail__head"><h3>Resumen</h3></div>
        <div className="hl-rail__body">
          <MetaGrid>
            <MetaTile label="Total" value={<span className="hl-tnum" style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>{CLP(cot.total)}</span>} />
            <MetaTile label="Para" value={cot.pacienteNombre ?? cot.nombreDestinatario ?? '—'} />
            {cot.fechaEnvio && <MetaTile label="Enviada" value={formatTimestamp(cot.fechaEnvio)} />}
            <MetaTile label="Servicios" value={`${totalItems} ítem${totalItems !== 1 ? 's' : ''}`} />
          </MetaGrid>
        </div>

        {/* Action panel */}
        <div style={{ borderTop: '1px solid var(--color-border)' }}>
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
              fechaRechazo={formatTimestamp(cot.updatedAt ?? cot.createdAt)}
            />
          )}
        </div>
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
  const extra = cotizacion.estado === 'enviada' && cotizacion.fechaEnvio ? ` · enviada el ${formatTimestamp(cotizacion.fechaEnvio)}`
    : cotizacion.estado === 'aceptada' ? ` · aceptada el ${formatTimestamp(cotizacion.updatedAt)}`
    : cotizacion.estado === 'rechazada' ? ` · rechazada el ${formatTimestamp(cotizacion.updatedAt)}`
    : ''

  return (
    <div className="hl-root">
      <div style={{ margin: '-28px -32px 20px' }}>
        <Stepper estado={cotizacion.estado} />
      </div>

      {/* Header */}
      <div className="page-head">
        <div>
          <div className="page-head__crumb">
            <Link href="/cotizaciones">Cotizaciones</Link><span className="sep">/</span><span className="hl-mono">{numero}</span>
          </div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {numero}
            <EstadoBadge estado={cotizacion.estado} />
          </h1>
          <p className="page-head__meta">Creada el {formatTimestamp(cotizacion.createdAt)}{extra}</p>
        </div>
        <div className="page-head__actions">
          {isEditable && (
            <Button variant="secondary" asChild>
              <Link href={`/cotizaciones/${cotizacion.id}/editar`}>Editar cotización</Link>
            </Button>
          )}
          <Button variant="ghost" asChild>
            <Link href="/cotizaciones">Volver</Link>
          </Button>
        </div>
      </div>

      <div className="split">
        <div style={{ minWidth: 0 }}>
          <QuoteSummary cot={cotizacion} />
        </div>
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
