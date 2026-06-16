'use client'

import { useState, useTransition, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Loader2, Pencil, FileText, AlertTriangle,
  ChevronRight, Stethoscope, FlaskConical, BookOpen, X, MapPin,
} from 'lucide-react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { SelectCombobox } from '@/components/select-combobox'
import { Checkbox } from '@/components/ui/checkbox'
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
  onSubmit: (fd: FormData) => Promise<{ success: boolean; error?: string }>
}

type ServiceTab = 'procedimientos' | 'examenes' | 'talleres'

const CLP = (n: number) => '$' + (n || 0).toLocaleString('es-CL')

// ─── Estado badge ──────────────────────────────────────────────────────────────

function EstadoBadge({ estado, size = 'sm' }: { estado: string; size?: 'sm' | 'lg' }) {
  const cfg = ESTADO_VISITA_STYLES[estado] ?? ESTADO_VISITA_STYLES.creada!
  return (
    <span
      className="rounded-md font-medium uppercase tracking-wide"
      style={{
        backgroundColor: cfg.bg,
        color: cfg.color,
        fontSize: size === 'lg' ? 11 : 10.5,
        padding: size === 'lg' ? '4px 10px' : '2px 8px',
        letterSpacing: '0.06em',
      }}
    >
      {cfg.label}
    </span>
  )
}

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
    <div
      className="mt-2 flex items-center justify-between gap-4 rounded-lg px-4 py-2.5 text-[13px]"
      style={{ backgroundColor: 'oklch(0.97 0.05 75)', border: '1px solid oklch(0.85 0.12 75)' }}
    >
      <div className="flex items-center gap-2.5" style={{ color: 'oklch(0.35 0.14 70)' }}>
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="font-medium">{procedimiento.nombre}</span>
          {' — Precio cambió: '}
          <span className="line-through">${savedPrice.toLocaleString('es-CL')}</span>
          {' → '}
          <span className="font-semibold">${procedimiento.precio.toLocaleString('es-CL')}</span>
        </span>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={handleActualizar}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded px-2.5 py-1 text-[11.5px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ backgroundColor: 'oklch(0.4 0.14 70)', color: 'white' }}
        >
          {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          Actualizar
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded px-2.5 py-1 text-[11.5px] font-medium transition-opacity hover:opacity-80"
          style={{ border: '1px solid oklch(0.75 0.08 70)', color: 'oklch(0.4 0.14 70)' }}
        >
          Mantener
        </button>
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
    <div
      className="mt-2 flex items-center justify-between gap-4 rounded-lg px-4 py-2.5 text-[13px]"
      style={{ backgroundColor: 'oklch(0.97 0.05 75)', border: '1px solid oklch(0.85 0.12 75)' }}
    >
      <div className="flex items-center gap-2.5" style={{ color: 'oklch(0.35 0.14 70)' }}>
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="font-medium">{examen.nombre}</span>
          {' — Precio cambió: '}
          <span className="line-through">${savedPrice.toLocaleString('es-CL')}</span>
          {' → '}
          <span className="font-semibold">${examen.precio.toLocaleString('es-CL')}</span>
        </span>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={handleActualizar}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded px-2.5 py-1 text-[11.5px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ backgroundColor: 'oklch(0.4 0.14 70)', color: 'white' }}
        >
          {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          Actualizar
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded px-2.5 py-1 text-[11.5px] font-medium transition-opacity hover:opacity-80"
          style={{ border: '1px solid oklch(0.75 0.08 70)', color: 'oklch(0.4 0.14 70)' }}
        >
          Mantener
        </button>
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
    <div className="overflow-hidden rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between gap-4 border-b px-6 py-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {(paciente.nombres?.charAt(0) ?? '') + (paciente.apellidoPaterno?.charAt(0) ?? '')}
          </div>
          <div>
            <p className="text-[15px] font-semibold" style={{ color: 'var(--foreground)' }}>
              {nombreDisplay}
            </p>
            {paciente.identificador && (
              <p className="mt-0.5 text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
                {paciente.tipoIdentificador === 'rut' && formatRut(paciente.identificador)}
                {paciente.tipoIdentificador === 'pasaporte' && `Pasaporte ${paciente.identificador}`}
                {!paciente.tipoIdentificador && paciente.identificador}
              </p>
            )}
          </div>
        </div>
        <Link
          href={`/pacientes/${paciente.id}`}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar datos
        </Link>
      </div>

      <div className="flex" style={{ minHeight: '160px' }}>
        <div className="flex-1 p-5">
          {fields.length > 0 ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
              {fields.map(({ label, value }) => (
                <div key={label} className={`flex gap-2 text-[12.5px] ${label === 'Dirección' ? 'col-span-2' : ''}`}>
                  <dt className="w-20 shrink-0 font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</dt>
                  <dd style={{ color: 'var(--foreground)' }}>{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>Sin datos adicionales registrados.</p>
          )}
        </div>

        {hasMap && (
          <div className="w-[200px] shrink-0 overflow-hidden border-l" style={{ borderColor: 'var(--border)' }}>
            <MapPreview lat={paciente.latitud!} lng={paciente.longitud!} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SummaryGroup ─────────────────────────────────────────────────────────────

function SummaryGroup({
  label, tone, items, subtotal,
}: {
  label: string
  tone: 'blue' | 'green' | 'violet' | 'amber'
  items: { name: string; price: number }[]
  subtotal: number
}) {
  const dotColor = {
    blue:   'oklch(0.45 0.12 240)',
    green:  'oklch(0.45 0.13 145)',
    violet: 'oklch(0.45 0.13 290)',
    amber:  'oklch(0.5 0.13 70)',
  }[tone]

  if (!items.length || subtotal === 0) {
    return (
      <div className="flex items-center justify-between text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
        <span>{label}</span>
        <span>—</span>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--foreground)' }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
          {label}
        </span>
        <span className="text-[12px] font-medium tabular-nums">{CLP(subtotal)}</span>
      </div>
      <ul className="space-y-0.5 pl-3.5">
        {items.filter((i) => i.price > 0).map((item, idx) => (
          <li key={idx} className="flex items-baseline justify-between gap-2 text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
            <span className="truncate">{item.name}</span>
            <span className="shrink-0 tabular-nums">{CLP(item.price)}</span>
          </li>
        ))}
      </ul>
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
  const [selectedOrigenContactoId, setSelectedOrigenContactoId] = useState<number | null>(
    visita?.origenContacto ? origenesContacto.find((o) => o.nombre === visita.origenContacto)?.id ?? null : null
  )
  const [selectedFecha, setSelectedFecha] = useState<string | null>(visita?.fecha ?? null)
  const [selectedHora, setSelectedHora] = useState<string | null>(visita?.hora?.slice(0, 5) ?? null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  const [cobraVisita, setCobraVisita] = useState(visita?.cobraVisita ?? false)
  const [selectedSurcharges, setSelectedSurcharges] = useState<number[]>(visita?.surchargeIds ?? [])

  // Orden médica
  const [keyOrdenMedica, setKeyOrdenMedica] = useState<string | null>(visita?.keyOrdenMedica ?? null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (!selectedFecha) { setError('La fecha es obligatoria'); return }

    const fd = new FormData(e.currentTarget)
    selectedProcedures.forEach((id) => fd.append('procedure_ids', String(id)))
    appendExamGroupsToFormData(fd, examGroups)
    selectedTallers.forEach((id) => {
      fd.append('taller_ids', String(id))
      fd.set(`taller_precio_${id}`, tallerPriceMap[id] ?? '0')
    })
    selectedSurcharges.forEach((id) => fd.append('surcharge_ids', String(id)))
    fd.set('cobraVisita', String(cobraVisita))

    startTransition(async () => {
      const result = await onSubmit(fd)
      if (result.success) {
        router.push('/visitas')
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
  const talleresOptions = talleres.map((t) => ({ id: t.id, label: t.nombre, code: t.codigo }))
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
      savedExamPrices: visita?.examPrices,
      pricingContext,
      cobraVisita,
      surchargeItems: selectedSurcharges.map((id) => ({
        precio: visita?.surchargePrices.find((s) => s.idTipoRecargo === id)?.precio ?? tiposRecargos.find((t) => t.id === id)?.precio ?? 0,
      })),
      isapreExams: (isapreBlock?.exams ?? []).map((e) => ({
        valorPagar: e.tipo === 'isapre' ? (Number(e.valorPagar.replace(/[^\d]/g, '')) || 0) : 0,
      })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedProcedures, examGroups, selectedTallers, tallerPriceMap, procedimientos, visita, pricingContext, cobraVisita, selectedSurcharges, tiposRecargos],
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

  return (
    <>
      {/* ── Sticky header ── */}
      <div
        className="sticky top-0 z-10 flex h-[60px] items-center justify-between border-b px-8"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/visitas')}
            className="text-[13px] transition-opacity hover:opacity-70"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Visitas
          </button>
          <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
          <h1 className="text-[16px] font-semibold" style={{ color: 'var(--foreground)' }}>
            {isEdit ? `Visita #${visita.id}` : 'Nueva visita'}
          </h1>
          {isEdit && visita.estado && <EstadoBadge estado={visita.estado} size="lg" />}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/visitas"
            className="rounded-lg px-3.5 text-[13px] font-medium transition-opacity hover:opacity-80"
            style={{ height: 36, lineHeight: '36px', color: 'var(--muted-foreground)' }}
          >
            Cancelar
          </Link>
          {isEdit && (
            <Link
              href={`/api/cotizacion/${visita.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border px-3.5 text-[13px] font-medium transition-opacity hover:opacity-80"
              style={{ height: 36, color: 'var(--foreground)', borderColor: 'var(--border)' }}
            >
              <FileText className="h-3.5 w-3.5" />
              Cotización PDF
            </Link>
          )}
          <button
            type="submit"
            form="visita-form"
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg px-3.5 text-[13px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ height: 36, backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? 'Guardar cambios' : 'Crear visita'}
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div
          ref={errorRef}
          className="mx-8 mt-4 flex items-center gap-2 rounded-lg px-4 py-3 text-[13px]"
          style={{ backgroundColor: 'var(--destructive)', color: 'white' }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
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
        <input type="hidden" name="origenContacto" value={selectedOrigenContactoId !== null ? origenesContacto.find((o) => o.id === selectedOrigenContactoId)?.nombre ?? '' : ''} />
        <input type="hidden" name="hora" value={selectedHora ?? ''} />
        {/* ── LEFT column ── */}
        <div className="flex flex-col gap-5">

          {/* Paciente */}
          <PacienteCard paciente={paciente} />

          {/* Agenda */}
          <section
            className="rounded-xl border p-6"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="mb-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--muted-foreground)' }}>
                Agenda
              </h2>
              <p className="mt-0.5 text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
                Fecha, hora y quién realiza la visita.
              </p>
            </div>

            <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
              {/* Fecha */}
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-[13px] font-medium" style={{ color: 'var(--foreground)' }}>
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

              {/* Hora */}
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-[13px] font-medium" style={{ color: 'var(--foreground)' }}>Hora</label>
                <TimePicker value={selectedHora} onChange={setSelectedHora} disabled={isPending} className="w-full" />
              </div>

              {/* Enfermera */}
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-[13px] font-medium" style={{ color: 'var(--foreground)' }}>Enfermera</label>
                <SelectCombobox
                  mode="single"
                  options={enfermerasOptions}
                  selected={selectedEnfermeraId}
                  onChange={setSelectedEnfermeraId}
                  placeholder="Buscar enfermera…"
                  disabled={isPending}
                />
              </div>

              {/* Origen de contacto */}
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-[13px] font-medium" style={{ color: 'var(--foreground)' }}>Origen de contacto</label>
                <SelectCombobox
                  mode="single"
                  options={origenesContactoOptions}
                  selected={selectedOrigenContactoId}
                  onChange={setSelectedOrigenContactoId}
                  placeholder="Buscar origen…"
                  disabled={isPending}
                />
              </div>
            </div>
          </section>

          {/* Servicios — tabbed */}
          <section
            className="rounded-xl border p-6"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--muted-foreground)' }}>
                  Servicios
                </h2>
                <p className="mt-0.5 text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
                  Procedimientos y exámenes usan precios del catálogo. Los talleres permiten precio personalizado.
                </p>
              </div>
              {(costoPreview.subtotalProcedimientos + costoPreview.subtotalExamenes + costoPreview.subtotalTalleres) > 0 && (
                <span className="shrink-0 text-[13px] tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                  Subtotal{' '}
                  <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                    {CLP(costoPreview.subtotalProcedimientos + costoPreview.subtotalExamenes + costoPreview.subtotalTalleres)}
                  </span>
                </span>
              )}
            </div>

            {/* Tab strip */}
            <div
              className="mb-5 flex items-center gap-1 rounded-lg p-1"
              style={{ backgroundColor: 'var(--muted)', width: 'fit-content' }}
            >
              {tabs.map(({ id, label, count, hasWarning, Icon: TabIcon }) => {
                const active = activeTab === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className="relative inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors"
                    style={{
                      backgroundColor: active ? 'var(--card)' : 'transparent',
                      color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
                      boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    <TabIcon className="h-3.5 w-3.5" />
                    {label}
                    {count > 0 && (
                      <span
                        className="ml-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-semibold tabular-nums"
                        style={{
                          backgroundColor: active ? 'var(--foreground)' : 'transparent',
                          color: active ? 'var(--background)' : 'var(--muted-foreground)',
                          border: active ? 'none' : '1px solid var(--border)',
                        }}
                      >
                        {count}
                      </span>
                    )}
                    {hasWarning && !active && (
                      <span
                        className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full"
                        style={{ backgroundColor: 'oklch(0.65 0.18 70)' }}
                      />
                    )}
                  </button>
                )
              })}
            </div>

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
                  <div
                    className="rounded-lg border border-dashed py-8 text-center text-[13px]"
                    style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                  >
                    Sin procedimientos seleccionados.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg" style={{ border: '1px solid var(--border)' }}>
                    {selectedProcedures.map((id, i) => {
                      const proc = procedimientos.find((p) => p.id === id)
                      if (!proc) return null
                      const savedEntry = visita?.procedurePrices.find((p) => p.idProcedimiento === id)
                      const precio = savedEntry?.precio ?? proc.precio
                      const priceChanged = savedEntry && savedEntry.precio !== proc.precio && !dismissedPriceWarnings.has(id)
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-3 px-3.5 py-2.5 text-[13px]"
                          style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)', backgroundColor: 'var(--card)' }}
                        >
                          <span className="rounded px-1.5 py-0.5 font-mono text-[10.5px]" style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                            {proc.codigo}
                          </span>
                          <span className="flex-1" style={{ color: 'var(--foreground)' }}>{proc.nombre}</span>
                          {priceChanged && <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: 'oklch(0.6 0.14 70)' }} />}
                          <span className="tabular-nums" style={{ color: 'var(--foreground)', minWidth: 80, textAlign: 'right' }}>
                            {CLP(precio)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedProcedures((prev) => prev.filter((x) => x !== id))}
                            className="rounded p-1 transition-opacity hover:opacity-70"
                            style={{ color: 'var(--muted-foreground)' }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    })}
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
                  <div
                    className="rounded-lg border border-dashed py-8 text-center text-[13px]"
                    style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                  >
                    Sin talleres seleccionados.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg" style={{ border: '1px solid var(--border)' }}>
                    {selectedTallers.map((id, i) => {
                      const taller = talleres.find((t) => t.id === id)
                      if (!taller) return null
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-3 px-3.5 py-2.5 text-[13px]"
                          style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)', backgroundColor: 'var(--card)' }}
                        >
                          <span className="rounded px-1.5 py-0.5 font-mono text-[10.5px]" style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                            {taller.codigo}
                          </span>
                          <span className="flex-1" style={{ color: 'var(--foreground)' }}>{taller.nombre}</span>
                          <div
                            className="flex items-center gap-1 rounded border px-1.5 py-0.5"
                            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
                          >
                            <span className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>$</span>
                            <input
                              type="number"
                              min="0"
                              value={tallerPriceMap[id] ?? ''}
                              onChange={(e) => setTallerPriceMap((prev) => ({ ...prev, [id]: e.target.value }))}
                              placeholder="0"
                              disabled={isPending}
                              className="w-20 bg-transparent text-right text-[13px] tabular-nums outline-none"
                              style={{ color: 'var(--foreground)' }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedTallers((prev) => prev.filter((x) => x !== id))}
                            className="rounded p-1 transition-opacity hover:opacity-70"
                            style={{ color: 'var(--muted-foreground)' }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Cargos adicionales — cobrar visita + recargo */}
          <section
            className="rounded-xl border p-6"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--muted-foreground)' }}>
              Cargos adicionales
            </h2>
            <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {/* Visita */}
              <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}>
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
                      <label htmlFor="cobraVisita" className="cursor-pointer text-[13px] font-medium leading-tight" style={{ color: 'var(--foreground)' }}>
                        Cobrar visita
                      </label>
                      {cobraVisita && costoPreview.costoVisitaEnfermeria > 0 && (
                        <span className="shrink-0 text-[13px] font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
                          {CLP(costoPreview.costoVisitaEnfermeria)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
                      {cobraVisita && !costoPreview.precioVisitaConfigurado
                        ? 'Sin precio configurado para esta comuna'
                        : 'Precio según comuna del paciente'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Recargos */}
              <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}>
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-[13px] font-medium" style={{ color: 'var(--foreground)' }}>Recargos</span>
                  {costoPreview.subtotalRecargos > 0 && (
                    <span className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
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
                  <div className="mt-2 overflow-hidden rounded-lg" style={{ border: '1px solid var(--border)' }}>
                    {selectedSurcharges.map((id) => {
                      const tipo = tiposRecargos.find((t) => t.id === id)
                      if (!tipo) return null
                      const precio = visita?.surchargePrices.find((s) => s.idTipoRecargo === id)?.precio ?? tipo.precio
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-3 px-3.5 py-2.5 text-[13px]"
                          style={{ backgroundColor: 'var(--background)', borderBottom: '1px solid var(--border)' }}
                        >
                          <span className="flex-1" style={{ color: 'var(--foreground)' }}>{tipo.label}</span>
                          <span className="tabular-nums" style={{ color: 'var(--foreground)' }}>{CLP(precio)}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedSurcharges((prev) => prev.filter((x) => x !== id))}
                            disabled={isPending}
                            className="transition-opacity hover:opacity-70"
                            style={{ color: 'var(--muted-foreground)' }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Orden médica ── */}
          <section
            className="rounded-xl border p-6"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--muted-foreground)' }}>
              Orden médica
            </h2>
            <p className="mb-3 text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
              Imagen de la orden original (JPG, PNG, WEBP). Máximo 10 MB. Se adjunta al correo de asignación.
            </p>
            <input type="hidden" name="keyOrdenMedica" value={keyOrdenMedica ?? ''} />
            <FileUpload
              folder="visitas"
              accept="image/jpeg,image/png,image/webp,image/gif"
              currentKey={keyOrdenMedica}
              signedUrl={signedUrlOrdenMedica}
              onUploaded={setKeyOrdenMedica}
              disabled={isPending}
            />
          </section>

          {/* Información adicional */}
          <section
            className="rounded-xl border p-6"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--muted-foreground)' }}>
              Información adicional
            </h2>
            <p className="mb-3 text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
              Notas internas del equipo de enfermería.
            </p>
            <textarea
              name="informacionAdicional"
              rows={3}
              defaultValue={visita?.informacionAdicional ?? ''}
              disabled={isPending}
              className="w-full resize-none rounded-lg px-3 py-2.5 text-[13px] outline-none disabled:opacity-50"
              style={{ backgroundColor: 'var(--background)', border: '1px solid var(--input)', color: 'var(--foreground)' }}
              placeholder="Notas para el equipo de enfermería…"
            />
          </section>
        </div>

        {/* ── RIGHT — sticky rail ── */}
        <aside style={{ position: 'sticky', top: 80, height: 'fit-content' }}>
          <div className="overflow-hidden rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>

            {/* Estado de la visita */}
            <div className="px-5 pt-5 pb-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--muted-foreground)' }}>
                  Estado de la visita
                </h3>
                {isEdit && visita?.estado && <EstadoBadge estado={visita.estado} />}
              </div>
              <div className="space-y-1.5 text-[12.5px]">
                <RailRow label="Fecha" value={selectedFecha ? formatDate(selectedFecha) : '—'} />
                <RailRow label="Hora"  value={selectedHora ?? '—'} />
                <RailRow label="Enfermera" value={enfermeraLabel} />
              </div>
            </div>

            {/* Resumen de costos */}
            <div className="space-y-3 px-5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--muted-foreground)' }}>
                Resumen de costos
              </h3>
              <SummaryGroup
                tone="blue"
                label="Procedimientos"
                items={selectedProcedures.flatMap((id) => {
                  const p = procedimientos.find((x) => x.id === id)
                  if (!p) return []
                  const saved = visita?.procedurePrices.find((x) => x.idProcedimiento === id)
                  return [{ name: p.nombre, price: saved?.precio ?? p.precio }]
                })}
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
                  ...(cobraVisita ? [{ name: `Visita enfermería`, price: costoPreview.costoVisitaEnfermeria }] : []),
                  ...selectedSurcharges.map((id) => {
                    const tipo = tiposRecargos.find((t) => t.id === id)
                    const precio = visita?.surchargePrices.find((s) => s.idTipoRecargo === id)?.precio ?? tipo?.precio ?? 0
                    return { name: tipo?.label ?? '', price: precio }
                  }),
                ]}
                subtotal={costoPreview.costoVisitaEnfermeria + costoPreview.subtotalRecargos}
              />
            </div>

            {/* Total */}
            <div
              className="space-y-1 px-5 py-4"
              style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--muted)' }}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--muted-foreground)' }}>
                  Total visita
                </span>
                <span className="text-[22px] font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
                  {CLP(costoPreview.total)}
                </span>
              </div>
              {visita?.numeroBoleta && (
                <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                  {visita.tipoDocumento === 'boleta' ? 'Boleta' : 'Factura'} {visita.numeroBoleta}
                </p>
              )}
            </div>

          </div>

          {/* Link a resultados de exámenes */}
          {isEdit && totalExamCount > 0 && (
            <div className="mt-2 overflow-hidden rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <Link
                href={`/visitas/${visita.id}/resultados`}
                className="flex items-center justify-between gap-2 px-4 py-3 text-[13px] font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--foreground)' }}
              >
                <span>Resultados de exámenes</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                  style={{
                    backgroundColor: visita.resultadosEnviadosCount > 0 && visita.resultadosEnviadosCount >= totalExamCount
                      ? 'oklch(0.6 0.118 184.704 / 12%)'
                      : 'oklch(0.7 0.15 60 / 15%)',
                    color: visita.resultadosEnviadosCount > 0 && visita.resultadosEnviadosCount >= totalExamCount
                      ? 'oklch(0.45 0.118 184.704)'
                      : 'oklch(0.40 0.15 60)',
                  }}
                >
                  {visita.resultadosEnviadosCount}/{totalExamCount}
                </span>
              </Link>
            </div>
          )}

          {isEdit && (
            <p className="mt-3 px-2 text-[11px] space-y-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Visita #{visita.id}
            </p>
          )}
        </aside>
      </form>
    </>
  )
}

// ─── RailRow ──────────────────────────────────────────────────────────────────

function RailRow({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'muted' }) {
  const color = tone === 'green' ? 'oklch(0.45 0.13 145)' : 'var(--foreground)'
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[12.5px]" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
      <span className="text-right text-[12.5px]" style={{ color, fontWeight: tone === 'green' ? 500 : 400 }}>{value}</span>
    </div>
  )
}
