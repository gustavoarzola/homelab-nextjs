'use client'

import { useState, useTransition, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, FileText, AlertTriangle } from 'lucide-react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { SelectCombobox } from '@/components/select-combobox'
import { Checkbox } from '@/components/ui/checkbox'
import { TimePicker } from '@/components/time-picker'
import { FormDatePicker } from '@/components/form-date-picker'
import { formatDate } from '@/lib/format'
import { formatNombre } from '@/lib/paciente'
import { formatRut } from '@/lib/rut'
import { EXAM_GRUPO_LABELS, type ExamGrupo } from '@/lib/exam-grupos'
import type { NurseRow } from '@/lib/actions/enfermeras'
import type { LaboratorioRow } from '@/lib/actions/laboratorios'
import type { ProcedimientoRow, ExamenRow, TallerRow } from '@/lib/actions/catalogos'
import type { VisitaDetalle } from '@/lib/actions/visitas'
import { actualizarPrecioProcedimientoVisita, actualizarPrecioExamenVisita } from '@/lib/actions/visitas'
import { calcularCostoVisitaPreview, type VisitaFormPricingContext } from '@/lib/pricing/visita-preview'

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
  laboratorios: LaboratorioRow[]
  procedimientos: ProcedimientoRow[]
  examenes: ExamenRow[]
  talleres: TallerRow[]
  origenesContacto: { id: number; nombre: string }[]
  tiposRecargos: { id: number; label: string }[]
  pricingContext: VisitaFormPricingContext
  onSubmit: (fd: FormData) => Promise<{ success: true; id: number } | { success: false; error: string }>
}

// ─── ProcedimientoPriceWarning ────────────────────────────────────────────────

function ProcedimientoPriceWarning({
  procedimiento,
  savedPrice,
  idVisita,
  onDismiss,
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
    <div
      className="mt-2 flex items-center justify-between gap-4 rounded-lg px-4 py-2.5 text-sm"
      style={{ backgroundColor: 'oklch(0.8 0.12 80 / 15%)', border: '1px solid oklch(0.7 0.12 80 / 40%)' }}
    >
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'oklch(0.6 0.14 70)' }} />
        <span style={{ color: 'var(--foreground)' }}>
          <span className="font-medium">{procedimiento.nombre}</span>
          <span style={{ color: 'var(--muted-foreground)' }}>
            {' '}— Precio cambió:{' '}
            <span className="line-through">${savedPrice.toLocaleString('es-CL')}</span>
            {' → '}
            <span className="font-medium">${procedimiento.precio.toLocaleString('es-CL')}</span>
          </span>
        </span>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={handleActualizar}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          Actualizar
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80"
          style={{ border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
        >
          Mantener
        </button>
      </div>
    </div>
  )
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const inputClass = 'w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50'
const inputStyle = {
  backgroundColor: 'var(--background)',
  border: '1px solid var(--input)',
  color: 'var(--foreground)',
}
const labelClass = 'text-sm font-medium'
const labelStyle = { color: 'var(--foreground)' }
const sectionClass = 'rounded-xl border'
const sectionStyle = { backgroundColor: 'var(--card)', borderColor: 'var(--border)' }
const sectionTitleClass = 'mb-4 text-sm font-semibold uppercase tracking-wide'
const sectionTitleStyle = { color: 'var(--muted-foreground)' }

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
    ? paciente.telefonos
        .map((t) => t.descripcion ? `${t.telefono} (${t.descripcion})` : t.telefono)
        .join(' · ')
    : null

  const fields = [
    telefonosDisplay && {
      label: paciente.telefonos.length === 1 ? 'Teléfono' : 'Teléfonos',
      value: telefonosDisplay,
    },
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
    <div className="overflow-hidden rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between gap-4 border-b px-6 py-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          <p className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            {nombreDisplay}
          </p>
          {paciente.identificador && (
            <p className="mt-0.5 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {paciente.tipoIdentificador === 'rut' && formatRut(paciente.identificador)}
              {paciente.tipoIdentificador === 'pasaporte' && `Pasaporte ${paciente.identificador}`}
              {!paciente.tipoIdentificador && paciente.identificador}
            </p>
          )}
        </div>
        <Link
          href={`/pacientes/${paciente.id}`}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar datos
        </Link>
      </div>

      {/* Body */}
      <div className="flex" style={{ minHeight: '180px' }}>
        {/* Data */}
        <div className="flex-1 p-6">
          {fields.length > 0 ? (
            <dl className="flex flex-col gap-2.5">
              {fields.map(({ label, value }) => (
                <div key={label} className="flex gap-3 text-sm">
                  <dt className="w-24 shrink-0 font-medium" style={{ color: 'var(--muted-foreground)' }}>
                    {label}
                  </dt>
                  <dd style={{ color: 'var(--foreground)' }}>{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Sin datos adicionales registrados.
            </p>
          )}
        </div>

        {/* Map */}
        {hasMap && (
          <div
            className="w-2/5 shrink-0 overflow-hidden border-l"
            style={{ borderColor: 'var(--border)' }}
          >
            <MapPreview lat={paciente.latitud!} lng={paciente.longitud!} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ExamenPriceWarning ───────────────────────────────────────────────────────

function ExamenPriceWarning({
  examen,
  savedPrice,
  idVisita,
  onDismiss,
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
    <div
      className="mt-2 flex items-center justify-between gap-4 rounded-lg px-4 py-2.5 text-sm"
      style={{ backgroundColor: 'oklch(0.8 0.12 80 / 15%)', border: '1px solid oklch(0.7 0.12 80 / 40%)' }}
    >
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'oklch(0.6 0.14 70)' }} />
        <span style={{ color: 'var(--foreground)' }}>
          <span className="font-medium">{examen.nombre}</span>
          <span style={{ color: 'var(--muted-foreground)' }}>
            {' '}— Precio cambió:{' '}
            <span className="line-through">${savedPrice.toLocaleString('es-CL')}</span>
            {' → '}
            <span className="font-medium">${examen.precio.toLocaleString('es-CL')}</span>
          </span>
        </span>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={handleActualizar}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          Actualizar
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80"
          style={{ border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
        >
          Mantener
        </button>
      </div>
    </div>
  )
}

// ─── VisitaForm ────────────────────────────────────────────────────────────────

export function VisitaForm({
  paciente,
  visita,
  enfermeras,
  laboratorios,
  procedimientos,
  examenes,
  talleres,
  origenesContacto,
  pricingContext,
  tiposRecargos,
  onSubmit,
}: Props) {
  const router = useRouter()
  const isEdit = !!visita
  const [selectedProcedures, setSelectedProcedures] = useState<number[]>(visita?.procedureIds ?? [])
  const [selectedExams, setSelectedExams] = useState<number[]>(visita?.examIds ?? [])
  const [selectedTallers, setSelectedTallers] = useState<number[]>(visita?.tallerIds ?? [])
  const [tallerPriceMap, setTallerPriceMap] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {}
    visita?.tallerPrices.forEach(({ idTaller, precio }) => { map[idTaller] = String(precio) })
    return map
  })
  const [dismissedPriceWarnings, setDismissedPriceWarnings] = useState<Set<number>>(new Set())
  const [dismissedExamWarnings, setDismissedExamWarnings] = useState<Set<number>>(new Set())
  const [selectedEnfermeraId, setSelectedEnfermeraId] = useState<number | null>(visita?.idEnfermera ?? null)
  const [selectedLaboratorioId, setSelectedLaboratorioId] = useState<number | null>(visita?.idLaboratorio ?? null)
  const [selectedOrigenContactoId, setSelectedOrigenContactoId] = useState<number | null>(
    visita?.origenContacto ? origenesContacto.find((o) => o.nombre === visita.origenContacto)?.id ?? null : null
  )
  const [selectedTipoDocumentoId, setSelectedTipoDocumentoId] = useState<number | null>(
    visita?.tipoDocumento ? (visita.tipoDocumento === 'boleta' ? 0 : 1) : null
  )
  const [selectedEstadoId, setSelectedEstadoId] = useState<number | null>(
    visita?.estado
      ? visita.estado === 'creada' ? 0
      : visita.estado === 'confirmada' ? 1
      : visita.estado === 'realizada' ? 2
      : visita.estado === 'no_realizada' ? 4
      : 3
      : null
  )
  const [selectedFecha, setSelectedFecha] = useState<string | null>(visita?.fecha ?? null)
  const [selectedHora, setSelectedHora] = useState<string | null>(visita?.hora?.slice(0, 5) ?? null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [cobraVisita, setCobraVisita] = useState(visita?.cobraVisita ?? false)

  // Pago y resultados
  const [pagado, setPagado] = useState(visita?.pagado ?? false)
  const [metodoPago, setMetodoPago] = useState<number | null>(
    visita?.metodoPago === 'transferencia' ? 0 : visita?.metodoPago === 'cheque' ? 1 : visita?.metodoPago === 'efectivo' ? 2 : null
  )
  const [fechaPago, setFechaPago] = useState<string | null>(visita?.fechaPago ?? null)
  const [resultadosEnviados, setResultadosEnviados] = useState(visita?.resultadosEnviados ?? false)
  const [fechaEnvioResultados, setFechaEnvioResultados] = useState<string | null>(visita?.fechaEnvioResultados ?? null)

  // Recargos
  const [montoRecargo, setMontoRecargo] = useState<string>(visita?.montoRecargo ? String(visita.montoRecargo) : '')
  const [selectedIdTipoRecargo, setSelectedIdTipoRecargo] = useState<number | null>(visita?.idTipoRecargo ?? null)

  const estadoActual = selectedEstadoId === 0 ? 'creada'
    : selectedEstadoId === 1 ? 'confirmada'
    : selectedEstadoId === 2 ? 'realizada'
    : selectedEstadoId === 4 ? 'no_realizada'
    : selectedEstadoId === 3 ? 'cancelada'
    : ''

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!selectedFecha) {
      setError('La fecha es obligatoria')
      return
    }

    const fd = new FormData(e.currentTarget)
    selectedProcedures.forEach((id) => fd.append('procedure_ids', String(id)))
    selectedExams.forEach((id) => fd.append('exam_ids', String(id)))
    selectedTallers.forEach((id) => {
      fd.append('taller_ids', String(id))
      fd.set(`taller_precio_${id}`, tallerPriceMap[id] ?? '0')
    })
    fd.set('cobraVisita', String(cobraVisita))
    fd.set('pagado', String(pagado))
    fd.set('resultadosEnviados', String(resultadosEnviados))
    fd.set('montoRecargo', montoRecargo || '0')
    fd.set('idTipoRecargo', selectedIdTipoRecargo ? String(selectedIdTipoRecargo) : '')

    startTransition(async () => {
      const result = await onSubmit(fd)
      if (result.success) {
        router.push('/visitas')
      } else {
        setError(result.error ?? 'Error desconocido')
      }
    })
  }

  const procedimientosOptions = procedimientos.map((p) => ({ id: p.id, label: `${p.nombre} (${p.codigo})` }))
  const talleresOptions = talleres.map((t) => ({ id: t.id, label: `${t.nombre} (${t.codigo})` }))
  const examenesOptions = examenes.map((e) => ({
    id: e.id,
    label: `${e.nombre} (${EXAM_GRUPO_LABELS[e.grupoExamen as ExamGrupo] ?? e.grupoExamen})`,
  }))
  const enfermerasOptions = enfermeras.map((e) => ({ id: e.id, label: formatNombre(e) }))
  const laboratoriosOptions = laboratorios.map((l) => ({ id: l.id, label: l.nombre }))
  const origenesContactoOptions = origenesContacto.map((o) => ({ id: o.id, label: o.nombre }))
  const tipoDocumentoOptions = [
    { id: 0, label: 'Boleta' },
    { id: 1, label: 'Factura' },
  ]
  const estadoOptions = [
    { id: 0, label: 'Creada' },
    { id: 1, label: 'Confirmada' },
    { id: 2, label: 'Realizada' },
    { id: 3, label: 'Cancelada' },
    { id: 4, label: 'No realizada' },
  ]

  const metodoPagoOptions = [
    { id: 0, label: 'Transferencia' },
    { id: 1, label: 'Cheque' },
    { id: 2, label: 'Efectivo' },
  ]

  const costoPreview = useMemo(
    () =>
      calcularCostoVisitaPreview({
        selectedProcedureIds: selectedProcedures,
        selectedExamIds: selectedExams,
        selectedTallerIds: selectedTallers,
        tallerPriceMap,
        catalogProcedurePrices: procedimientos.map((p) => ({ id: p.id, precio: p.precio })),
        savedProcedurePrices: visita?.procedurePrices,
        savedExamPrices: visita?.examPrices,
        pricingContext,
        cobraVisita,
        montoRecargo: parseInt(montoRecargo) || 0,
      }),
    [selectedProcedures, selectedExams, selectedTallers, tallerPriceMap, procedimientos, visita, pricingContext, cobraVisita, montoRecargo],
  )

  return (
    <>
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between border-b px-8 py-3"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          {isEdit ? 'Editar visita' : 'Nueva visita'}
        </h1>
        <div className="flex gap-2">
          <Link
            href="/pacientes"
            className="rounded-lg px-4 py-2 text-sm transition-opacity hover:opacity-80"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Cancelar
          </Link>
          {isEdit && (
            <Link
              href={`/api/cotizacion/${visita.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ color: 'var(--foreground)', borderColor: 'var(--border)' }}
            >
              <FileText className="h-3.5 w-3.5" />
              Cotización PDF
            </Link>
          )}
          <button
            type="submit"
            form="visita-form"
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? 'Guardar cambios' : 'Crear visita'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="mx-8 mt-4 rounded-lg px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--destructive)', color: 'white' }}
        >
          {error}
        </div>
      )}

      <form id="visita-form" onSubmit={handleSubmit} className="flex flex-col gap-6 p-8">
        <input type="hidden" name="idPaciente" value={paciente.id} />
        {isEdit && <input type="hidden" name="id" value={visita.id} />}

        {/* ── Paciente ── */}
        <PacienteCard paciente={paciente} />

        {/* ── Datos de la visita ── */}
        <section className={sectionClass} style={sectionStyle}>
          <div className="p-6">
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>Datos de la visita</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass} style={labelStyle}>
                  Fecha <span style={{ color: 'var(--destructive)' }}>*</span>
                </label>
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
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelClass} style={labelStyle}>Hora</label>
                <input type="hidden" name="hora" value={selectedHora ?? ''} />
                <TimePicker value={selectedHora} onChange={setSelectedHora} disabled={isPending} className="w-full" />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-2">
                <label className={labelClass} style={labelStyle}>Costo total</label>
                <div
                  className="w-full rounded-lg px-4 py-3 text-sm space-y-1.5"
                  style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
                >
                  <div className="flex justify-between text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    <span>Procedimientos:</span>
                    <span>${costoPreview.subtotalProcedimientos.toLocaleString('es-CL')}</span>
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    <span>Exámenes:</span>
                    <span>${costoPreview.subtotalExamenes.toLocaleString('es-CL')}</span>
                  </div>
                  {costoPreview.subtotalTalleres > 0 && (
                    <div className="flex justify-between text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      <span>Talleres:</span>
                      <span>${costoPreview.subtotalTalleres.toLocaleString('es-CL')}</span>
                    </div>
                  )}
                  {costoPreview.costoVisitaEnfermeria > 0 && (
                    <div className="flex justify-between text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      <span>Visita enfermería:</span>
                      <span>${costoPreview.costoVisitaEnfermeria.toLocaleString('es-CL')}</span>
                    </div>
                  )}
                  {costoPreview.montoRecargo > 0 && (
                    <div className="flex justify-between text-xs" style={{ color: 'var(--destructive)' }}>
                      <span>Recargo:</span>
                      <span>${costoPreview.montoRecargo.toLocaleString('es-CL')}</span>
                    </div>
                  )}
                  <div
                    className="flex justify-between pt-1.5 font-semibold border-t"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    <span>Total:</span>
                    <span>${costoPreview.total.toLocaleString('es-CL')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="cobraVisita"
                    checked={cobraVisita}
                    onCheckedChange={(checked) => setCobraVisita(checked === true)}
                    disabled={isPending}
                  />
                  <label htmlFor="cobraVisita" className="cursor-pointer text-sm" style={labelStyle}>
                    Cobrar visita
                  </label>
                </div>
                {cobraVisita && !costoPreview.precioVisitaConfigurado && (
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Sin precio de visita configurado para esta comuna.
                  </p>
                )}
              </div>

              {estadoActual === 'no_realizada' && (
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass} style={labelStyle}>Costo traslado</label>
                  <input name="costoTraslado" type="number" min="0" defaultValue={visita?.costoTraslado ?? 7000} disabled={isPending} className={inputClass} style={inputStyle} />
                </div>
              )}


              {isEdit && (
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass} style={labelStyle}>Estado</label>
                  <input type="hidden" name="estado" value={estadoActual} />
                  <SelectCombobox
                    mode="single"
                    options={estadoOptions}
                    selected={selectedEstadoId}
                    onChange={setSelectedEstadoId}
                    placeholder="Seleccionar estado…"
                    disabled={isPending}
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className={labelClass} style={labelStyle}>Enfermera</label>
                <input type="hidden" name="idEnfermera" value={selectedEnfermeraId ?? ''} />
                <SelectCombobox
                  mode="single"
                  options={enfermerasOptions}
                  selected={selectedEnfermeraId}
                  onChange={setSelectedEnfermeraId}
                  placeholder="Buscar enfermera…"
                  disabled={isPending}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelClass} style={labelStyle}>Laboratorio</label>
                <input type="hidden" name="idLaboratorio" value={selectedLaboratorioId ?? ''} />
                <SelectCombobox
                  mode="single"
                  options={laboratoriosOptions}
                  selected={selectedLaboratorioId}
                  onChange={setSelectedLaboratorioId}
                  placeholder="Buscar laboratorio…"
                  disabled={isPending}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelClass} style={labelStyle}>Origen de contacto</label>
                <input type="hidden" name="origenContacto" value={selectedOrigenContactoId !== null ? origenesContacto.find((o) => o.id === selectedOrigenContactoId)?.nombre ?? '' : ''} />
                <SelectCombobox
                  mode="single"
                  options={origenesContactoOptions}
                  selected={selectedOrigenContactoId}
                  onChange={setSelectedOrigenContactoId}
                  placeholder="Buscar origen…"
                  disabled={isPending}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelClass} style={labelStyle}>Tipo de documento</label>
                <input type="hidden" name="tipoDocumento" value={selectedTipoDocumentoId === 0 ? 'boleta' : selectedTipoDocumentoId === 1 ? 'factura' : ''} />
                <SelectCombobox
                  mode="single"
                  options={tipoDocumentoOptions}
                  selected={selectedTipoDocumentoId}
                  onChange={setSelectedTipoDocumentoId}
                  placeholder="Seleccionar tipo…"
                  disabled={isPending}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelClass} style={labelStyle}>N° boleta / factura</label>
                <input name="numeroBoleta" type="text" defaultValue={visita?.numeroBoleta ?? ''} disabled={isPending} className={inputClass} style={inputStyle} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelClass} style={labelStyle}>N° atención</label>
                <input name="numeroAtencion" type="number" defaultValue={visita?.numeroAtencion ?? ''} disabled={isPending} className={inputClass} style={inputStyle} />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
                <label className={labelClass} style={labelStyle}>Información adicional</label>
                <textarea name="informacionAdicional" rows={2} defaultValue={visita?.informacionAdicional ?? ''} disabled={isPending} className={inputClass} style={inputStyle} />
              </div>
            </div>
          </div>
        </section>

        {/* ── Procedimientos ── */}
        <section className={sectionClass} style={sectionStyle}>
          <div className="p-6">
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>Procedimientos</h2>
            <div className="grid grid-cols-2 gap-8">
              {/* Columna izquierda: selector */}
              <SelectCombobox
                options={procedimientosOptions}
                selected={selectedProcedures}
                onChange={(ids) => {
                  setSelectedProcedures(ids)
                  setDismissedPriceWarnings((prev) => {
                    const next = new Set(prev)
                    for (const id of prev) {
                      if (!ids.includes(id)) next.delete(id)
                    }
                    return next
                  })
                }}
                placeholder="Buscar procedimiento..."
                disabled={isPending}
              />

              {/* Columna derecha: lista de seleccionados con precio */}
              <div className="flex flex-col gap-2 pl-6" style={{ borderLeft: '1px solid var(--muted)' }}>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                  Seleccionados
                </p>
                {selectedProcedures.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Sin procedimientos seleccionados.
                  </p>
                ) : (
                  <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {selectedProcedures.map((id) => {
                      const proc = procedimientos.find((p) => p.id === id)
                      if (!proc) return null
                      const savedEntry = visita?.procedurePrices.find((p) => p.idProcedimiento === id)
                      const precio = savedEntry?.precio ?? proc.precio
                      return (
                        <li
                          key={id}
                          className="flex items-center justify-between gap-2 py-1.5 text-sm"
                        >
                          <span style={{ color: 'var(--foreground)' }}>{proc.nombre}</span>
                          <span
                            className="shrink-0 font-medium tabular-nums"
                            style={{ color: 'var(--foreground)' }}
                          >
                            ${precio.toLocaleString('es-CL')}
                          </span>
                        </li>
                      )
                    })}
                    <li className="flex items-center justify-between gap-2 py-1.5 text-sm font-semibold">
                      <span style={{ color: 'var(--muted-foreground)' }}>Subtotal</span>
                      <span className="tabular-nums" style={{ color: 'var(--foreground)' }}>
                        ${selectedProcedures.reduce((sum, id) => {
                          const proc = procedimientos.find((p) => p.id === id)
                          if (!proc) return sum
                          const savedEntry = visita?.procedurePrices.find((p) => p.idProcedimiento === id)
                          return sum + (savedEntry?.precio ?? proc.precio)
                        }, 0).toLocaleString('es-CL')}
                      </span>
                    </li>
                  </ul>
                )}
              </div>
            </div>

            {/* Price change warnings — debajo del grid */}
            {isEdit && visita.estado !== 'realizada' && selectedProcedures.map((procId) => {
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
        </section>

        {/* ── Exámenes ── */}
        <section className={sectionClass} style={sectionStyle}>
          <div className="p-6">
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>Exámenes</h2>
            <div className="grid grid-cols-2 gap-8">
              {/* Columna izquierda: selector */}
              <SelectCombobox
                options={examenesOptions}
                selected={selectedExams}
                onChange={(ids) => {
                  setSelectedExams(ids)
                  setDismissedExamWarnings((prev) => {
                    const next = new Set(prev)
                    for (const id of prev) {
                      if (!ids.includes(id)) next.delete(id)
                    }
                    return next
                  })
                }}
                placeholder="Buscar examen..."
                disabled={isPending}
              />

              {/* Columna derecha: lista de seleccionados con precio */}
              <div className="flex flex-col gap-2 pl-6" style={{ borderLeft: '1px solid var(--muted)' }}>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                  Seleccionados
                </p>
                {selectedExams.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Sin exámenes seleccionados.
                  </p>
                ) : (
                  <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {selectedExams.map((id) => {
                      const examen = examenes.find((e) => e.id === id)
                      if (!examen) return null
                      const savedEntry = visita?.examPrices.find((e) => e.idExamen === id)
                      const precio = savedEntry?.precio ?? examen.precio
                      return (
                        <li
                          key={id}
                          className="flex items-center justify-between gap-2 py-1.5 text-sm"
                        >
                          <span style={{ color: 'var(--foreground)' }}>{examen.nombre}</span>
                          <span
                            className="shrink-0 font-medium tabular-nums"
                            style={{ color: 'var(--foreground)' }}
                          >
                            ${precio.toLocaleString('es-CL')}
                          </span>
                        </li>
                      )
                    })}
                    <li className="flex items-center justify-between gap-2 py-1.5 text-sm font-semibold">
                      <span style={{ color: 'var(--muted-foreground)' }}>Subtotal</span>
                      <span className="tabular-nums" style={{ color: 'var(--foreground)' }}>
                        ${selectedExams.reduce((sum, id) => {
                          const examen = examenes.find((e) => e.id === id)
                          if (!examen) return sum
                          const savedEntry = visita?.examPrices.find((e) => e.idExamen === id)
                          return sum + (savedEntry?.precio ?? examen.precio)
                        }, 0).toLocaleString('es-CL')}
                      </span>
                    </li>
                  </ul>
                )}
              </div>
            </div>

            {/* Price change warnings — debajo del grid */}
            {isEdit && visita.estado !== 'realizada' && selectedExams.map((examId) => {
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
        </section>


        {/* ── Talleres ── */}
        <section className={sectionClass} style={sectionStyle}>
          <div className="p-6">
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>Talleres</h2>
            <div className="grid grid-cols-2 gap-8">
              {/* Columna izquierda: selector */}
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
                placeholder="Buscar taller..."
                disabled={isPending}
              />

              {/* Columna derecha: lista con input de precio libre */}
              <div className="flex flex-col gap-2 pl-6" style={{ borderLeft: '1px solid var(--muted)' }}>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                  Seleccionados
                </p>
                {selectedTallers.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Sin talleres seleccionados.
                  </p>
                ) : (
                  <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {selectedTallers.map((id) => {
                      const taller = talleres.find((t) => t.id === id)
                      if (!taller) return null
                      return (
                        <li key={id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                          <span style={{ color: 'var(--foreground)' }}>{taller.nombre}</span>
                          <input
                            type="number"
                            min="0"
                            value={tallerPriceMap[id] ?? ''}
                            onChange={(e) =>
                              setTallerPriceMap((prev) => ({ ...prev, [id]: e.target.value }))
                            }
                            placeholder="0"
                            disabled={isPending}
                            className="w-28 shrink-0 rounded border px-2 py-1 text-right text-sm tabular-nums"
                            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
                          />
                        </li>
                      )
                    })}
                    <li className="flex items-center justify-between gap-2 py-1.5 text-sm font-semibold">
                      <span style={{ color: 'var(--muted-foreground)' }}>Subtotal</span>
                      <span className="tabular-nums" style={{ color: 'var(--foreground)' }}>
                        ${selectedTallers.reduce((sum, id) => sum + (parseInt(tallerPriceMap[id] ?? '0') || 0), 0).toLocaleString('es-CL')}
                      </span>
                    </li>
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Recargos ── */}
        <section className={sectionClass} style={sectionStyle}>
          <div className="p-6">
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>Recargos</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass} style={labelStyle}>Tipo de recargo</label>
                <input type="hidden" name="idTipoRecargo" value={selectedIdTipoRecargo ?? ''} />
                <SelectCombobox
                  mode="single"
                  options={tiposRecargos}
                  selected={selectedIdTipoRecargo}
                  onChange={setSelectedIdTipoRecargo}
                  placeholder="Buscar tipo recargo..."
                  disabled={isPending || !montoRecargo || parseInt(montoRecargo) === 0}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelClass} style={labelStyle}>Monto recargo</label>
                <input
                  type="number"
                  min="0"
                  value={montoRecargo}
                  onChange={(e) => {
                  const val = e.target.value
                  setMontoRecargo(val)
                  if (!val || parseInt(val) === 0) setSelectedIdTipoRecargo(null)
                }}
                  disabled={isPending}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Pago y resultados ── */}
        {isEdit && (
          <section className={sectionClass} style={sectionStyle}>
            <div className="p-6">
              <h2 className={sectionTitleClass} style={sectionTitleStyle}>Pago y resultados</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {/* Pago */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="pagado"
                      checked={pagado}
                      onCheckedChange={(checked) => setPagado(checked === true)}
                      disabled={isPending}
                    />
                    <label htmlFor="pagado" className={`${labelClass} cursor-pointer`} style={labelStyle}>Pagado</label>
                  </div>
                  {pagado && (
                    <div className="flex flex-col gap-3 pl-6">
                      <div className="flex flex-col gap-1.5">
                        <label className={labelClass} style={labelStyle}>Método de pago</label>
                        <input type="hidden" name="metodoPago" value={metodoPago === 0 ? 'transferencia' : metodoPago === 1 ? 'cheque' : metodoPago === 2 ? 'efectivo' : ''} />
                        <SelectCombobox
                          mode="single"
                          options={metodoPagoOptions}
                          selected={metodoPago}
                          onChange={setMetodoPago}
                          placeholder="Seleccionar método…"
                          disabled={isPending}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className={labelClass} style={labelStyle}>Fecha de pago</label>
                        <FormDatePicker
                          mode="single"
                          name="fechaPago"
                          value={fechaPago ?? undefined}
                          onChange={(v) => setFechaPago(v ?? null)}
                          disabled={isPending}
                          weekStartsOn={1}
                          placeholder="Seleccionar fecha"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Resultados */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="resultadosEnviados"
                      checked={resultadosEnviados}
                      onCheckedChange={(checked) => setResultadosEnviados(checked === true)}
                      disabled={isPending}
                    />
                    <label htmlFor="resultadosEnviados" className={`${labelClass} cursor-pointer`} style={labelStyle}>Resultados enviados</label>
                  </div>
                  {resultadosEnviados && (
                    <div className="pl-6">
                      <div className="flex flex-col gap-1.5">
                        <label className={labelClass} style={labelStyle}>Fecha de envío</label>
                        <FormDatePicker
                          mode="single"
                          name="fechaEnvioResultados"
                          value={fechaEnvioResultados ?? undefined}
                          onChange={(v) => setFechaEnvioResultados(v ?? null)}
                          disabled={isPending}
                          weekStartsOn={1}
                          placeholder="Seleccionar fecha"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </form>
    </>
  )
}
