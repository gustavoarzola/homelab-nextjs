'use client'

import { useState, useTransition, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Loader2, Pencil, FileText, AlertTriangle,
  ChevronRight, Stethoscope, FlaskConical, BookOpen, MapPin,
} from 'lucide-react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { cn } from '@/lib/utils'
import { SelectCombobox } from '@/components/select-combobox'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { MetaGrid, MetaTile } from '@/components/ui/meta'
import { FileUpload } from '@/components/file-upload'
import { TimePicker } from '@/components/time-picker'
import { FormDatePicker } from '@/components/form-date-picker'
import { formatDate } from '@/lib/format'
import { formatNombre } from '@/lib/paciente'
import { formatRut } from '@/lib/rut'
import { ExamenesPorGrupo, buildInitialGroups, appendExamGroupsToFormData } from '@/components/exam-grupo-block'
import type { ExamGroup } from '@/components/exam-grupo-block'
import type { NurseRow } from '@/lib/actions/enfermeras'
import type { ProcedimientoRow, ExamenRow, TallerRow, IsaprePrevisionRow } from '@/lib/actions/catalogos'
import type { VisitaDetalle } from '@/lib/actions/visitas'
import { EXAM_GRUPO_META } from '@/lib/exam-grupos'
import { ESTADO_VISITA_STYLES } from '@/lib/estado-colors'

import { toast } from 'sonner'
import { actualizarPrecioProcedimientoVisita, actualizarPrecioExamenVisita } from '@/lib/actions/visitas'
import { calcularCostoVisitaPreview, type VisitaFormPricingContext } from '@/lib/pricing/visita-preview'
import {
  CLP,
  ServiceTabs,
  ServiceItems,
  ServiceItem,
  DiscountInput,
  PriceInput,
  ServiceEmpty,
  Segmented,
  SummaryGroup,
} from '@/components/form-servicios'
import './form-shared.css'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PacienteData = {
  id: number
  nombres: string
  apellidoPaterno: string | null
  apellidoMaterno: string | null
  identificador: string | null
  tipoIdentificador: string | null
  fechaNacimiento: string | null
  telefonos: { telefono: string; descripcion: string | null }[]
  prevision: string | null
  residencia: string | null
  direccionFormateada: string | null
  direccion: string
  latitud: string | null
  longitud: string | null
}

type Props = {
  paciente: PacienteData
  visita?: VisitaDetalle
  enfermeras: NurseRow[]
  procedimientos: ProcedimientoRow[]
  examenes: ExamenRow[]
  talleres: TallerRow[]
  origenesContacto: { id: number; nombre: string }[]
  tiposRecargos: { id: number; label: string; precio: number }[]
  pricingContext: VisitaFormPricingContext
  isaprePrevisiones: IsaprePrevisionRow[]
  signedUrlOrdenMedica?: string | null
  onSubmit: (fd: FormData) => Promise<
    | { success: true; id: number }
    | { success: true; data: { id: number } }
    | { success: false; error: string }
  >
}

type ServiceTab = 'procedimientos' | 'examenes' | 'talleres'

// ─── ProcedimientoPriceWarning ────────────────────────────────────────────────

function ProcedimientoPriceWarning({
  procedimiento, savedPrice, idVisita, onDismiss,
}: {
  procedimiento: ProcedimientoRow
  savedPrice: number
  idVisita: number
  onDismiss: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const handleActualizar = () => {
    startTransition(async () => {
      await actualizarPrecioProcedimientoVisita(idVisita, procedimiento.id)
      onDismiss()
    })
  }
  return (
    <div className="hl-callout hl-callout--warn" style={{ marginTop: 8, alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <AlertTriangle />
        <span>
          <span style={{ fontWeight: 500 }}>{procedimiento.nombre}</span>
          {' — Precio cambió: '}
          <span style={{ textDecoration: 'line-through' }}>${savedPrice.toLocaleString('es-CL')}</span>
          {' → '}
          <span style={{ fontWeight: 600 }}>${procedimiento.precio.toLocaleString('es-CL')}</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <Button type="button" size="sm" onClick={handleActualizar} disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          Actualizar
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onDismiss}>
          Mantener
        </Button>
      </div>
    </div>
  )
}

// ─── ExamenPriceWarning ───────────────────────────────────────────────────────

function ExamenPriceWarning({
  examen, savedPrice, idVisita, onDismiss,
}: {
  examen: ExamenRow
  savedPrice: number
  idVisita: number
  onDismiss: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const handleActualizar = () => {
    startTransition(async () => {
      await actualizarPrecioExamenVisita(idVisita, examen.id)
      onDismiss()
    })
  }
  return (
    <div className="hl-callout hl-callout--warn" style={{ marginTop: 8, alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <AlertTriangle />
        <span>
          <span style={{ fontWeight: 500 }}>{examen.nombre}</span>
          {' — Precio cambió: '}
          <span style={{ textDecoration: 'line-through' }}>${savedPrice.toLocaleString('es-CL')}</span>
          {' → '}
          <span style={{ fontWeight: 600 }}>${examen.precio.toLocaleString('es-CL')}</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <Button type="button" size="sm" onClick={handleActualizar} disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          Actualizar
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onDismiss}>
          Mantener
        </Button>
      </div>
    </div>
  )
}

// ─── MapPreview ────────────────────────────────────────────────────────────────

function MapPreview({ lat, lng }: { lat: string; lng: string }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)

  useEffect(() => {
    const container = mapRef.current
    if (!container || !lat || !lng) return
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    if (isNaN(latNum) || isNaN(lngNum)) return

    setOptions({ key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '', v: 'weekly' })
    Promise.all([importLibrary('maps'), importLibrary('marker')]).then(([mapsLib, markerLib]) => {
      if (!container.isConnected) return
      const { Map } = mapsLib as google.maps.MapsLibrary
      const { AdvancedMarkerElement } = markerLib as google.maps.MarkerLibrary
      const position = { lat: latNum, lng: lngNum }
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new Map(container, {
          center: position,
          zoom: 15,
          mapId: 'visita-paciente-map',
          disableDefaultUI: true,
          zoomControl: true,
        })
      } else {
        mapInstanceRef.current.setCenter(position)
      }
      if (markerRef.current) markerRef.current.map = null
      markerRef.current = new AdvancedMarkerElement({ map: mapInstanceRef.current, position })
    })
  }, [lat, lng])

  return <div ref={mapRef} className="h-full w-full" />
}

// ─── PacienteCard ─────────────────────────────────────────────────────────────

function PacienteCard({ paciente }: { paciente: PacienteData }) {
  const nombreDisplay = formatNombre(paciente)
  const fechaDisplay = paciente.fechaNacimiento ? formatDate(paciente.fechaNacimiento) : null
  const telefonosDisplay = paciente.telefonos.length > 0
    ? paciente.telefonos.map((t) => t.descripcion ? `${t.telefono} (${t.descripcion})` : t.telefono).join(' · ')
    : null

  const fields = [
    telefonosDisplay && { label: paciente.telefonos.length === 1 ? 'Teléfono' : 'Teléfonos', value: telefonosDisplay },
    fechaDisplay       && { label: 'Nacimiento',  value: fechaDisplay },
    paciente.prevision && { label: 'Previsión',   value: paciente.prevision },
    paciente.residencia && { label: 'Residencia', value: paciente.residencia },
    (paciente.direccionFormateada || paciente.direccion) && {
      label: 'Dirección',
      value: paciente.direccionFormateada || paciente.direccion,
    },
  ].filter(Boolean) as { label: string; value: string }[]

  const hasMap = !!(paciente.latitud && paciente.longitud)

  return (
    <div className="dcard">
      <div className="dcard__head" style={{ marginBottom: 16, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span className="hl-avatar" style={{ width: 44, height: 44, fontSize: 'var(--text-md)' }}>
            {(paciente.nombres?.charAt(0) ?? '') + (paciente.apellidoPaterno?.charAt(0) ?? '')}
          </span>
          <div>
            <p style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>{nombreDisplay}</p>
            {paciente.identificador && (
              <p className="hl-mono" style={{ marginTop: 2, fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>
                {paciente.tipoIdentificador === 'rut' && formatRut(paciente.identificador)}
                {paciente.tipoIdentificador === 'pasaporte' && `Pasaporte ${paciente.identificador}`}
                {!paciente.tipoIdentificador && paciente.identificador}
              </p>
            )}
          </div>
        </div>
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/pacientes/${paciente.id}`}>
            <Pencil />
            Editar datos
          </Link>
        </Button>
      </div>

      <div className="flex" style={{ minHeight: 130, gap: 20 }}>
        <div className="flex-1">
          {fields.length > 0 ? (
            <MetaGrid>
              {fields.map(({ label, value }) => (
                <MetaTile key={label} label={label} value={value} />
              ))}
            </MetaGrid>
          ) : (
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-fg-muted)' }}>Sin datos adicionales registrados.</p>
          )}
        </div>

        {hasMap && (
          <div style={{ width: 200, flexShrink: 0, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            <MapPreview lat={paciente.latitud!} lng={paciente.longitud!} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── VisitaForm ────────────────────────────────────────────────────────────────

export function VisitaForm({
  paciente,
  visita,
  enfermeras,
  procedimientos,
  examenes,
  talleres,
  origenesContacto,
  tiposRecargos,
  pricingContext,
  isaprePrevisiones,
  signedUrlOrdenMedica,
  onSubmit,
}: Props) {
  const router = useRouter()
  const isEdit = !!visita
  const [activeTab, setActiveTab] = useState<ServiceTab>('procedimientos')

  const [selectedProcedures, setSelectedProcedures] = useState<number[]>(visita?.procedureIds ?? [])
  const [procedureDiscountMap, setProcedureDiscountMap] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {}
    visita?.procedurePrices.forEach(({ idProcedimiento, descuento }) => { map[idProcedimiento] = String(descuento) })
    return map
  })
  const [descuentoProcedimientosAfectaPagoEnfermera, setDescuentoProcedimientosAfectaPagoEnfermera] = useState(
    visita?.descuentoProcedimientosAfectaPagoEnfermera ?? false,
  )
  const [examGroups, setExamGroups] = useState<ExamGroup[]>(() =>
    buildInitialGroups(
      visita?.examIds ?? [],
      visita?.examPrices ?? [],
      visita?.isapreExams ?? [],
      examenes,
    )
  )
  const [selectedTallers, setSelectedTallers] = useState<number[]>(visita?.tallerIds ?? [])
  const [tallerPriceMap, setTallerPriceMap] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {}
    visita?.tallerPrices.forEach(({ idTaller, precio }) => { map[idTaller] = String(precio) })
    return map
  })
  const [dismissedPriceWarnings, setDismissedPriceWarnings] = useState<Set<number>>(new Set())
  const [dismissedExamWarnings, setDismissedExamWarnings] = useState<Set<number>>(new Set())
  const [selectedEnfermeraId, setSelectedEnfermeraId] = useState<number | null>(visita?.idEnfermera ?? null)
  const [selectedOrigenContactoId, setSelectedOrigenContactoId] = useState<number | null>(visita?.idOrigenContacto ?? null)
  const [selectedFecha, setSelectedFecha] = useState<string | null>(visita?.fecha ?? null)
  const [selectedHora, setSelectedHora] = useState<string | null>(visita?.hora?.slice(0, 5) ?? null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  const [cobraVisita, setCobraVisita] = useState(visita?.cobraVisita ?? false)
  const [selectedSurcharges, setSelectedSurcharges] = useState<number[]>(visita?.surchargeIds ?? [])
  const [montoInsumos, setMontoInsumos] = useState(String(visita?.montoInsumos ?? 0))
  const [aplicaDescuento, setAplicaDescuento] = useState((visita?.descuentoValor ?? 0) > 0)
  const [descuentoTipo, setDescuentoTipo] = useState<'monto' | 'porcentaje'>(visita?.descuentoTipo ?? 'monto')
  const [descuentoValor, setDescuentoValor] = useState(String(visita?.descuentoValor ?? 0))
  const [descuentoAfectaPagoEnfermera, setDescuentoAfectaPagoEnfermera] = useState(
    visita?.descuentoAfectaPagoEnfermera ?? false,
  )

  // Orden médica
  const [keyOrdenMedica, setKeyOrdenMedica] = useState<string | null>(visita?.keyOrdenMedica ?? null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (!selectedFecha) { setError('La fecha es obligatoria'); return }

    const fd = new FormData(e.currentTarget)
    selectedProcedures.forEach((id) => {
      fd.append('procedure_ids', String(id))
      fd.set(`procedimiento_descuento_${id}`, procedureDiscountMap[id] ?? '0')
    })
    fd.set('descuentoProcedimientosAfectaPagoEnfermera', String(descuentoProcedimientosAfectaPagoEnfermera))
    appendExamGroupsToFormData(fd, examGroups)
    selectedTallers.forEach((id) => {
      fd.append('taller_ids', String(id))
      fd.set(`taller_precio_${id}`, tallerPriceMap[id] ?? '0')
    })
    selectedSurcharges.forEach((id) => fd.append('surcharge_ids', String(id)))
    fd.set('cobraVisita', String(cobraVisita))
    fd.set('montoInsumos', montoInsumos)
    fd.set('descuentoTipo', descuentoTipo)
    fd.set('descuentoValor', aplicaDescuento ? descuentoValor : '0')
    fd.set('descuentoAfectaPagoEnfermera', String(descuentoAfectaPagoEnfermera))

    startTransition(async () => {
      const result = await onSubmit(fd)
      if (result.success) {
        const visitId = 'data' in result ? result.data.id : result.id
        toast.success(isEdit ? 'Cambios guardados' : 'Visita creada')
        router.push(`/visitas/${visitId}`)
      } else {
        const msg = result.error ?? 'Error desconocido'
        setError(msg)
        toast.error(msg)
        setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
      }
    })
  }

  // Options
  const procedimientosOptions = procedimientos.map((p) => ({ id: p.id, label: p.nombre, code: p.codigo }))
  const talleresOptions = talleres.filter((t) => t.activo).map((t) => ({ id: t.id, label: t.nombre, code: t.codigo }))
  const enfermerasOptions = enfermeras.map((e) => ({ id: e.id, label: formatNombre(e) }))
  const origenesContactoOptions = origenesContacto.map((o) => ({ id: o.id, label: o.nombre }))
  const regularExamIds = examGroups
    .filter((g) => EXAM_GRUPO_META[g.grupoId].tipo === 'catalogo')
    .flatMap((g) => g.exams.map((e) => e.id))

  const isapreBlock = examGroups.find((g) => EXAM_GRUPO_META[g.grupoId].tipo === 'isapre')

  const costoPreview = useMemo(
    () => calcularCostoVisitaPreview({
      selectedProcedureIds: selectedProcedures,
      selectedExamIds: regularExamIds,
      selectedTallerIds: selectedTallers,
      tallerPriceMap,
      catalogProcedurePrices: procedimientos.map((p) => ({ id: p.id, precio: p.precio })),
      savedProcedurePrices: visita?.procedurePrices,
      procedureDiscounts: selectedProcedures.map((id) => ({
        idProcedimiento: id,
        descuento: parseInt(procedureDiscountMap[id] ?? '0') || 0,
      })),
      savedExamPrices: visita?.examPrices,
      pricingContext,
      cobraVisita,
      surchargeItems: selectedSurcharges.map((id) => ({
        precio: visita?.surchargePrices.find((s) => s.idTipoRecargo === id)?.precio ?? tiposRecargos.find((t) => t.id === id)?.precio ?? 0,
      })),
      isapreExams: (isapreBlock?.exams ?? []).map((e) => ({
        valorPagar: e.tipo === 'isapre' ? (Number(e.valorPagar.replace(/[^\d]/g, '')) || 0) : 0,
      })),
      montoInsumos: parseInt(montoInsumos) || 0,
      descuentoTipo,
      descuentoValor: aplicaDescuento ? parseInt(descuentoValor) || 0 : 0,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedProcedures, examGroups, selectedTallers, tallerPriceMap, procedimientos, visita, pricingContext, cobraVisita, selectedSurcharges, tiposRecargos, montoInsumos, aplicaDescuento, descuentoTipo, descuentoValor, procedureDiscountMap],
  )

  // Compute which tabs have undismissed price warnings (for warning dot)
  const hasProcWarning = isEdit && visita && visita.estado !== 'realizada'
    ? selectedProcedures.some((id) => {
        if (dismissedPriceWarnings.has(id)) return false
        const saved = visita.procedurePrices.find((p) => p.idProcedimiento === id)
        if (!saved) return false
        const proc = procedimientos.find((p) => p.id === id)
        return proc && proc.precio !== saved.precio
      })
    : false

  const hasExamWarning = isEdit && visita && visita.estado !== 'realizada'
    ? regularExamIds.some((id) => {
        if (dismissedExamWarnings.has(id)) return false
        const saved = visita.examPrices.find((e) => e.idExamen === id)
        if (!saved || saved.precio === 0) return false
        const examen = examenes.find((e) => e.id === id)
        return examen && examen.precio !== saved.precio
      })
    : false

  const totalExamCount = examGroups.reduce((s, g) => s + g.exams.length, 0)

  const tabs: { id: ServiceTab; label: string; count: number; hasWarning: boolean; Icon: typeof Stethoscope }[] = [
    { id: 'procedimientos', label: 'Procedimientos', count: selectedProcedures.length, hasWarning: hasProcWarning, Icon: Stethoscope },
    { id: 'examenes',       label: 'Exámenes',       count: totalExamCount,            hasWarning: hasExamWarning, Icon: FlaskConical },
    { id: 'talleres',       label: 'Talleres',        count: selectedTallers.length,    hasWarning: false,         Icon: BookOpen },
  ]

  // Enfermera display name for rail
  const enfermeraNombre = enfermeras.find((e) => e.id === selectedEnfermeraId)
  const enfermeraLabel = enfermeraNombre ? formatNombre(enfermeraNombre) : '—'

  const cfg = isEdit && visita.estado ? (ESTADO_VISITA_STYLES[visita.estado] ?? ESTADO_VISITA_STYLES.creada!) : null
  const examsBadgeOk = isEdit && visita && visita.resultadosEnviadosCount > 0 && visita.resultadosEnviadosCount >= totalExamCount

  return (
    <>
      {/* ── Sticky header ── */}
      <div className="edit-bar">
        <div className="edit-bar__crumb">
          <button
            type="button"
            onClick={() => router.push('/visitas')}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit' }}
          >
            Visitas
          </button>
          <ChevronRight style={{ width: 14, height: 14 }} />
        </div>
        <h1>
          {isEdit ? `Visita #${visita.id}` : 'Nueva visita'}
          {isEdit && cfg && <Badge badgeClass={cfg.badgeClass}>{cfg.label}</Badge>}
        </h1>

        <span className="edit-bar__spacer" />

        <Button variant="ghost" asChild>
          <Link href={isEdit ? `/visitas/${visita.id}` : '/visitas'}>Cancelar</Link>
        </Button>
        {isEdit && (
          <Button variant="secondary" asChild>
            <Link href={`/api/cotizacion/${visita.id}`} target="_blank" rel="noopener noreferrer">
              <FileText />
              Cotización PDF
            </Link>
          </Button>
        )}
        <Button type="submit" form="visita-form" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          {isEdit ? 'Guardar cambios' : 'Crear visita'}
        </Button>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div ref={errorRef} className="hl-callout hl-callout--bad mx-8 mt-4">
          <AlertTriangle />
          <div>{error}</div>
        </div>
      )}

      {/* ── Two-column form ── */}
      <form
        id="visita-form"
        onSubmit={handleSubmit}
        className="grid gap-5 px-8 py-6"
        style={{ gridTemplateColumns: 'minmax(0,1fr) 340px', alignItems: 'start' }}
      >
        <input type="hidden" name="idPaciente" value={paciente.id} />
        {isEdit && <input type="hidden" name="id" value={visita.id} />}
        <input type="hidden" name="idEnfermera" value={selectedEnfermeraId ?? ''} />
        <input type="hidden" name="idOrigenContacto" value={selectedOrigenContactoId ?? ''} />
        <input type="hidden" name="hora" value={selectedHora ?? ''} />
        {/* ── LEFT column ── */}
        <div className="flex flex-col gap-5">

          {/* Paciente */}
          <PacienteCard paciente={paciente} />

          {/* Agenda */}
          <section className="fcard">
            <div className="fcard__head">
              <div>
                <h2>Agenda</h2>
                <p>Fecha, hora y quién realiza la visita.</p>
              </div>
            </div>
            <div className="fcard__body">
              <div className="ed-grid3">
                <FieldGroup label="Fecha" required>
                  <FormDatePicker
                    mode="single"
                    name="fecha"
                    value={selectedFecha ?? undefined}
                    onChange={(value) => setSelectedFecha(value ?? null)}
                    disabled={isPending}
                    weekStartsOn={1}
                    placeholder="Seleccionar fecha"
                    className="w-full"
                  />
                </FieldGroup>

                <FieldGroup label="Hora">
                  <TimePicker value={selectedHora} onChange={setSelectedHora} disabled={isPending} className="w-full" />
                </FieldGroup>

                <FieldGroup label="Enfermera">
                  <SelectCombobox
                    mode="single"
                    options={enfermerasOptions}
                    selected={selectedEnfermeraId}
                    onChange={setSelectedEnfermeraId}
                    placeholder="Buscar enfermera…"
                    disabled={isPending}
                  />
                </FieldGroup>

                <FieldGroup label="Origen de contacto">
                  <SelectCombobox
                    mode="single"
                    options={origenesContactoOptions}
                    selected={selectedOrigenContactoId}
                    onChange={setSelectedOrigenContactoId}
                    placeholder="Buscar origen…"
                    disabled={isPending}
                  />
                </FieldGroup>
              </div>
            </div>
          </section>

          {/* Servicios — tabbed */}
          <section className="fcard">
            <div className="fcard__head">
              <div>
                <h2>Servicios</h2>
                <p>Procedimientos y exámenes usan precios del catálogo. Los talleres permiten precio personalizado.</p>
              </div>
              {(costoPreview.subtotalProcedimientos + costoPreview.subtotalExamenes + costoPreview.subtotalTalleres) > 0 && (
                <span style={{ fontSize: 'var(--text-base)', color: 'var(--color-fg-muted)', flexShrink: 0 }}>
                  Subtotal{' '}
                  <span className="hl-tnum" style={{ fontWeight: 600, color: 'var(--color-fg)' }}>
                    {CLP(costoPreview.subtotalProcedimientos + costoPreview.subtotalExamenes + costoPreview.subtotalTalleres)}
                  </span>
                </span>
              )}
            </div>

            <div className="fcard__body">
              {/* Tab strip */}
              <ServiceTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

              {/* Tab: Procedimientos */}
              {activeTab === 'procedimientos' && (
                <div>
                  <div className="mb-4">
                    <SelectCombobox
                      options={procedimientosOptions}
                      selected={selectedProcedures}
                      onChange={(ids) => {
                        setSelectedProcedures(ids)
                        setDismissedPriceWarnings((prev) => {
                          const next = new Set(prev)
                          for (const id of prev) { if (!ids.includes(id)) next.delete(id) }
                          return next
                        })
                      }}
                      placeholder="Buscar procedimiento…"
                      disabled={isPending}
                      showPills={false}
                    />
                  </div>
                  {selectedProcedures.length === 0 ? (
                    <ServiceEmpty>Sin procedimientos seleccionados.</ServiceEmpty>
                  ) : (
                    <ServiceItems>
                      {selectedProcedures.map((id) => {
                        const proc = procedimientos.find((p) => p.id === id)
                        if (!proc) return null
                        const savedEntry = visita?.procedurePrices.find((p) => p.idProcedimiento === id)
                        const precio = savedEntry?.precio ?? proc.precio
                        const priceChanged = savedEntry && savedEntry.precio !== proc.precio && !dismissedPriceWarnings.has(id)
                        const descuento = Math.min(parseInt(procedureDiscountMap[id] ?? '0') || 0, precio)
                        return (
                          <ServiceItem
                            key={id}
                            codigo={proc.codigo}
                            nombre={proc.nombre}
                            warning={priceChanged && <AlertTriangle style={{ width: 14, height: 14, color: 'var(--warn-fg)', flexShrink: 0 }} />}
                            price={<>{descuento > 0 && <s>{CLP(precio)}</s>}{CLP(precio - descuento)}</>}
                            onRemove={() => setSelectedProcedures((prev) => prev.filter((x) => x !== id))}
                          >
                            <DiscountInput
                              value={procedureDiscountMap[id] ?? '0'}
                              max={precio}
                              onChange={(v) => setProcedureDiscountMap((prev) => ({ ...prev, [id]: v }))}
                              disabled={isPending}
                            />
                          </ServiceItem>
                        )
                      })}
                    </ServiceItems>
                  )}
                  {costoPreview.montoDescuentoProcedimientos > 0 && (
                    <div className="mt-3 flex items-start gap-3 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
                      <Checkbox
                        id="descuentoProcedimientosAfectaPagoEnfermera"
                        checked={descuentoProcedimientosAfectaPagoEnfermera}
                        onCheckedChange={(checked) => setDescuentoProcedimientosAfectaPagoEnfermera(checked === true)}
                        disabled={isPending}
                        className="mt-0.5"
                      />
                      <label
                        htmlFor="descuentoProcedimientosAfectaPagoEnfermera"
                        className="cursor-pointer"
                        style={{ fontSize: 'var(--text-sm)', lineHeight: 1.4, color: 'var(--color-fg-muted)' }}
                      >
                        Descuento de procedimientos afecta el pago de la enfermera (si no está marcado, la enfermera cobra sobre el valor original de los procedimientos)
                      </label>
                    </div>
                  )}
                  {isEdit && visita && visita.estado !== 'realizada' && selectedProcedures.map((procId) => {
                    if (dismissedPriceWarnings.has(procId)) return null
                    const savedEntry = visita.procedurePrices.find((p) => p.idProcedimiento === procId)
                    if (!savedEntry) return null
                    const proc = procedimientos.find((p) => p.id === procId)
                    if (!proc || proc.precio === savedEntry.precio) return null
                    return (
                      <ProcedimientoPriceWarning
                        key={procId}
                        procedimiento={proc}
                        savedPrice={savedEntry.precio}
                        idVisita={visita.id}
                        onDismiss={() => setDismissedPriceWarnings((prev) => new Set([...prev, procId]))}
                      />
                    )
                  })}
                </div>
              )}

              {/* Tab: Exámenes */}
              {activeTab === 'examenes' && (
                <div className="space-y-3">
                  <ExamenesPorGrupo
                    groups={examGroups}
                    setGroups={setExamGroups}
                    allExams={examenes}
                    isaprePrevisiones={isaprePrevisiones}
                  />
                  {isEdit && visita && visita.estado !== 'realizada' && regularExamIds.map((examId) => {
                    if (dismissedExamWarnings.has(examId)) return null
                    const savedEntry = visita.examPrices.find((e) => e.idExamen === examId)
                    if (!savedEntry || savedEntry.precio === 0) return null
                    const examen = examenes.find((e) => e.id === examId)
                    if (!examen || examen.precio === savedEntry.precio) return null
                    return (
                      <ExamenPriceWarning
                        key={examId}
                        examen={examen}
                        savedPrice={savedEntry.precio}
                        idVisita={visita.id}
                        onDismiss={() => setDismissedExamWarnings((prev) => new Set([...prev, examId]))}
                      />
                    )
                  })}
                </div>
              )}

              {/* Tab: Talleres */}
              {activeTab === 'talleres' && (
                <div>
                  <div className="mb-4">
                    <SelectCombobox
                      options={talleresOptions}
                      selected={selectedTallers}
                      onChange={(ids) => {
                        setSelectedTallers(ids)
                        setTallerPriceMap((prev) => {
                          const next = { ...prev }
                          for (const key of Object.keys(next)) {
                            if (!ids.includes(Number(key))) delete next[Number(key)]
                          }
                          return next
                        })
                      }}
                      placeholder="Buscar taller…"
                      disabled={isPending}
                      showPills={false}
                    />
                  </div>
                  {selectedTallers.length === 0 ? (
                    <ServiceEmpty>Sin talleres seleccionados.</ServiceEmpty>
                  ) : (
                    <ServiceItems>
                      {selectedTallers.map((id) => {
                        const taller = talleres.find((t) => t.id === id)
                        if (!taller) return null
                        return (
                          <ServiceItem
                            key={id}
                            codigo={taller.codigo}
                            nombre={taller.nombre}
                            price={null}
                            onRemove={() => setSelectedTallers((prev) => prev.filter((x) => x !== id))}
                          >
                            <PriceInput
                              value={tallerPriceMap[id] ?? ''}
                              onChange={(v) => setTallerPriceMap((prev) => ({ ...prev, [id]: v }))}
                              disabled={isPending}
                            />
                          </ServiceItem>
                        )
                      })}
                    </ServiceItems>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Cargos adicionales — cobrar visita + recargo */}
          <section className="fcard">
            <div className="fcard__head">
              <div>
                <h2>Cargos adicionales</h2>
              </div>
            </div>
            <div className="fcard__body">
              <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {/* Visita */}
                <div className="fpanel">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="cobraVisita"
                      checked={cobraVisita}
                      onCheckedChange={(checked) => setCobraVisita(checked === true)}
                      disabled={isPending}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <label htmlFor="cobraVisita" className="cursor-pointer" style={{ fontSize: 'var(--text-base)', fontWeight: 500, lineHeight: 1.3 }}>
                          Cobrar visita
                        </label>
                        {cobraVisita && costoPreview.costoVisitaEnfermeriaOriginal > 0 && (
                          <span className="hl-tnum" style={{ fontSize: 'var(--text-base)', fontWeight: 600, flexShrink: 0 }}>
                            {costoPreview.montoDescuento > 0 && (
                              <span style={{ marginRight: 6, fontWeight: 400, textDecoration: 'line-through', color: 'var(--color-fg-muted)' }}>
                                {CLP(costoPreview.costoVisitaEnfermeriaOriginal)}
                              </span>
                            )}
                            {CLP(costoPreview.costoVisitaEnfermeria)}
                          </span>
                        )}
                      </div>
                      <p style={{ marginTop: 4, fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>
                        {cobraVisita && !costoPreview.precioVisitaConfigurado
                          ? 'Sin precio configurado para esta comuna'
                          : 'Precio según comuna del paciente'
                        }
                      </p>
                      {cobraVisita && !pricingContext.comunaEncontrada && (
                        <p style={{ marginTop: 4, fontSize: 'var(--text-sm)', color: 'var(--color-destructive)' }}>
                          {pricingContext.comunaPaciente
                            ? `La comuna "${pricingContext.comunaPaciente}" del paciente no está en el catálogo — se aplica el precio base. Agrégala en Comunas para asignarle un precio propio.`
                            : 'El paciente no tiene comuna registrada — se aplica el precio base.'}
                        </p>
                      )}
                    </div>
                  </div>

                  {cobraVisita && (
                    <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="aplicaDescuento"
                          checked={aplicaDescuento}
                          onCheckedChange={(checked) => setAplicaDescuento(checked === true)}
                          disabled={isPending}
                          className="mt-0.5"
                        />
                        <label htmlFor="aplicaDescuento" className="cursor-pointer" style={{ fontSize: 'var(--text-base)', fontWeight: 500, lineHeight: 1.3 }}>
                          Aplicar descuento
                        </label>
                      </div>

                      {aplicaDescuento && (
                        <div className="mt-3 space-y-3 pl-7">
                          <div className="ed-dcto-row">
                            <Segmented
                              options={[{ value: 'monto', label: 'Monto fijo' }, { value: 'porcentaje', label: 'Porcentaje' }]}
                              value={descuentoTipo}
                              onChange={setDescuentoTipo}
                            />
                            <div className="hl-input flex-1">
                              <span className="hl-affix" style={{ width: 'auto', height: 'auto' }}>
                                {descuentoTipo === 'porcentaje' ? '%' : '$'}
                              </span>
                              <input
                                type="number"
                                min="0"
                                max={descuentoTipo === 'porcentaje' ? 100 : undefined}
                                value={descuentoValor}
                                onChange={(e) => setDescuentoValor(e.target.value)}
                                placeholder="0"
                                disabled={isPending}
                                className="hl-tnum"
                              />
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id="descuentoAfectaPagoEnfermera"
                              checked={descuentoAfectaPagoEnfermera}
                              onCheckedChange={(checked) => setDescuentoAfectaPagoEnfermera(checked === true)}
                              disabled={isPending}
                              className="mt-0.5"
                            />
                            <label htmlFor="descuentoAfectaPagoEnfermera" className="cursor-pointer" style={{ fontSize: 'var(--text-sm)', lineHeight: 1.4, color: 'var(--color-fg-muted)' }}>
                              Afecta el pago de la enfermera (si no está marcado, la enfermera cobra sobre el valor original de la visita)
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Recargos */}
                <div className="fpanel">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>Recargos</span>
                    {costoPreview.subtotalRecargos > 0 && (
                      <span className="hl-tnum" style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>
                        {CLP(costoPreview.subtotalRecargos)}
                      </span>
                    )}
                  </div>
                  <SelectCombobox
                    mode="multi"
                    options={tiposRecargos}
                    selected={selectedSurcharges}
                    onChange={setSelectedSurcharges}
                    placeholder="Agregar recargo…"
                    disabled={isPending}
                    showPills={false}
                  />
                  {selectedSurcharges.length > 0 && (
                    <div className="mt-2">
                      <ServiceItems>
                        {selectedSurcharges.map((id) => {
                          const tipo = tiposRecargos.find((t) => t.id === id)
                          if (!tipo) return null
                          const precio = visita?.surchargePrices.find((s) => s.idTipoRecargo === id)?.precio ?? tipo.precio
                          return (
                            <ServiceItem
                              key={id}
                              nombre={tipo.label}
                              price={CLP(precio)}
                              onRemove={() => setSelectedSurcharges((prev) => prev.filter((x) => x !== id))}
                              disabled={isPending}
                            />
                          )
                        })}
                      </ServiceItems>
                    </div>
                  )}
                </div>

                {/* Insumos */}
                <div className="col-span-2 fpanel">
                  <label htmlFor="montoInsumosInput" style={{ display: 'block', marginBottom: 10, fontSize: 'var(--text-base)', fontWeight: 500 }}>
                    Monto de insumos
                  </label>
                  <div className="hl-input" style={{ maxWidth: 220 }}>
                    <span className="hl-affix" style={{ width: 'auto', height: 'auto' }}>$</span>
                    <input
                      id="montoInsumosInput"
                      type="number"
                      min="0"
                      value={montoInsumos}
                      onChange={(e) => setMontoInsumos(e.target.value)}
                      placeholder="0"
                      disabled={isPending}
                      className="hl-tnum"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Orden médica ── */}
          <section className="fcard">
            <div className="fcard__head">
              <div>
                <h2>Orden médica</h2>
                <p>Imagen de la orden original (JPG, PNG, WEBP). Máximo 10 MB. Se adjunta al correo de asignación.</p>
              </div>
            </div>
            <div className="fcard__body">
              <input type="hidden" name="keyOrdenMedica" value={keyOrdenMedica ?? ''} />
              <FileUpload
                folder="visitas"
                accept="image/jpeg,image/png,image/webp,image/gif"
                currentKey={keyOrdenMedica}
                signedUrl={signedUrlOrdenMedica}
                onUploaded={setKeyOrdenMedica}
                disabled={isPending}
              />
            </div>
          </section>

          {/* Información adicional */}
          <section className="fcard">
            <div className="fcard__head">
              <div>
                <h2>Información adicional</h2>
                <p>Notas internas del equipo de enfermería.</p>
              </div>
            </div>
            <div className="fcard__body">
              <div className="hl-input" style={{ height: 'auto', alignItems: 'flex-start', padding: '10px 12px' }}>
                <textarea
                  name="informacionAdicional"
                  rows={3}
                  defaultValue={visita?.informacionAdicional ?? ''}
                  disabled={isPending}
                  className="w-full resize-none"
                  placeholder="Notas para el equipo de enfermería…"
                />
              </div>
            </div>
          </section>
        </div>

        {/* ── RIGHT — sticky rail ── */}
        <aside style={{ position: 'sticky', top: 76, height: 'fit-content' }}>
          <div className="hl-rail__card">
            {/* Estado de la visita */}
            <div className="hl-rail__head">
              <h3>Estado de la visita</h3>
              {isEdit && cfg && <Badge badgeClass={cfg.badgeClass}>{cfg.label}</Badge>}
            </div>
            <div className="hl-rail__body">
              <div className="hl-kv"><dt>Fecha</dt><dd>{selectedFecha ? formatDate(selectedFecha) : '—'}</dd></div>
              <div className="hl-kv"><dt>Hora</dt><dd>{selectedHora ?? '—'}</dd></div>
              <div className="hl-kv"><dt>Enfermera</dt><dd>{enfermeraLabel}</dd></div>

              {/* Resumen de costos */}
              <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 4, paddingTop: 14, display: 'grid', gap: 12, minWidth: 0 }}>
                <span className="hl-label">Resumen de costos</span>
                <SummaryGroup
                  tone="blue"
                  label="Procedimientos"
                  items={[
                    ...selectedProcedures.flatMap((id) => {
                      const p = procedimientos.find((x) => x.id === id)
                      if (!p) return []
                      const saved = visita?.procedurePrices.find((x) => x.idProcedimiento === id)
                      return [{ name: p.nombre, price: saved?.precio ?? p.precio }]
                    }),
                    ...(costoPreview.montoDescuentoProcedimientos > 0
                      ? [{ name: 'Descuento procedimientos', price: -costoPreview.montoDescuentoProcedimientos }]
                      : []),
                  ]}
                  subtotal={costoPreview.subtotalProcedimientos}
                />
                <SummaryGroup
                  tone="green"
                  label="Exámenes"
                  items={[
                    ...regularExamIds.flatMap((id) => {
                      const e = examenes.find((x) => x.id === id)
                      if (!e) return []
                      const saved = visita?.examPrices.find((x) => x.idExamen === id)
                      return [{ name: e.nombre, price: saved?.precio ?? e.precio }]
                    }),
                    ...(isapreBlock?.exams ?? []).map((e) => ({
                      name: e.nombre,
                      price: e.tipo === 'isapre' ? (Number(e.valorPagar.replace(/[^\d]/g, '')) || 0) : 0,
                    })),
                  ]}
                  subtotal={costoPreview.subtotalExamenes}
                />
                <SummaryGroup
                  tone="violet"
                  label="Talleres"
                  items={selectedTallers.map((id) => {
                    const t = talleres.find((x) => x.id === id)!
                    return { name: t?.nombre ?? '', price: parseInt(tallerPriceMap[id] ?? '0') || 0 }
                  })}
                  subtotal={costoPreview.subtotalTalleres}
                />
                <SummaryGroup
                  tone="amber"
                  label="Adicionales"
                  items={[
                    ...(cobraVisita ? [{ name: `Visita enfermería`, price: costoPreview.costoVisitaEnfermeriaOriginal }] : []),
                    ...(costoPreview.montoDescuento > 0 ? [{ name: 'Descuento visita', price: -costoPreview.montoDescuento }] : []),
                    ...selectedSurcharges.map((id) => {
                      const tipo = tiposRecargos.find((t) => t.id === id)
                      const precio = visita?.surchargePrices.find((s) => s.idTipoRecargo === id)?.precio ?? tipo?.precio ?? 0
                      return { name: tipo?.label ?? '', price: precio }
                    }),
                    ...(costoPreview.montoInsumos > 0 ? [{ name: 'Insumos', price: costoPreview.montoInsumos }] : []),
                  ]}
                  subtotal={costoPreview.costoVisitaEnfermeria + costoPreview.subtotalRecargos + costoPreview.montoInsumos}
                />
              </div>

              {/* Total */}
              <div className="hl-kv hl-kv--total">
                <dt>Total visita</dt>
                <dd className="hl-tnum">{CLP(costoPreview.total)}</dd>
              </div>
              {visita?.numeroBoleta && (
                <p className="fhint">
                  {visita.tipoDocumento === 'boleta' ? 'Boleta' : 'Factura'} {visita.numeroBoleta}
                </p>
              )}
            </div>
          </div>

          {/* Link a resultados de exámenes */}
          {isEdit && totalExamCount > 0 && (
            <div className="fcard" style={{ marginTop: 8 }}>
              <Link
                href={`/visitas/${visita.id}`}
                className="flex items-center justify-between gap-2 transition-opacity hover:opacity-70"
                style={{ padding: '14px 18px', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-fg)' }}
              >
                <span>Resultados de exámenes</span>
                <span className={cn('hl-badge', examsBadgeOk ? 'is-ok' : 'is-warn', 'hl-tnum')}>
                  {visita.resultadosEnviadosCount}/{totalExamCount}
                </span>
              </Link>
            </div>
          )}

          {isEdit && (
            <p className="fhint" style={{ marginTop: 12, paddingLeft: 8 }}>
              Visita #{visita.id}
            </p>
          )}
        </aside>
      </form>
    </>
  )
}
