'use client'

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Calculator } from 'lucide-react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { SelectCombobox } from '@/components/select-combobox'
import { TimePicker } from '@/components/time-picker'
import { FormDatePicker } from '@/components/form-date-picker'
import { formatDate } from '@/lib/format'
import { formatNombre } from '@/lib/paciente'
import { formatRut } from '@/lib/rut'
import type { NurseRow } from '@/lib/actions/enfermeras'
import type { SucursalRow } from '@/lib/actions/laboratorios'
import type { ProcedimientoRow, ExamenRow } from '@/lib/actions/catalogos'
import type { VisitaDetalle } from '@/lib/actions/visitas'
import { calcularCostoVisita } from '@/lib/actions/precios'
import type { CostoVisitaDetalle } from '@/lib/actions/precios'

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
  contactoNombre: string | null
  contactoTelefono: string | null
}

type Props = {
  paciente: PacienteData
  visita?: VisitaDetalle
  enfermeras: NurseRow[]
  sucursales: SucursalRow[]
  procedimientos: ProcedimientoRow[]
  examenes: ExamenRow[]
  origenesContacto: { id: number; nombre: string }[]
  onSubmit: (fd: FormData) => Promise<{ success: true; id: number } | { success: false; error: string }>
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
    paciente.contactoNombre && {
      label: 'Contacto',
      value: [paciente.contactoNombre, paciente.contactoTelefono].filter(Boolean).join(' · '),
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

// ─── VisitaForm ────────────────────────────────────────────────────────────────

export function VisitaForm({
  paciente,
  visita,
  enfermeras,
  sucursales,
  procedimientos,
  examenes,
  origenesContacto,
  onSubmit,
}: Props) {
  const router = useRouter()
  const isEdit = !!visita
  const [selectedProcedures, setSelectedProcedures] = useState<number[]>(visita?.procedureIds ?? [])
  const [selectedExams, setSelectedExams] = useState<number[]>(visita?.examIds ?? [])
  const [selectedEnfermeraId, setSelectedEnfermeraId] = useState<number | null>(visita?.idEnfermera ?? null)
  const [selectedSucursalId, setSelectedSucursalId] = useState<number | null>(visita?.idSucursal ?? null)
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

  // Pago y resultados
  const [pagado, setPagado] = useState(visita?.pagado ?? false)
  const [metodoPago, setMetodoPago] = useState<number | null>(
    visita?.metodoPago === 'transferencia' ? 0 : visita?.metodoPago === 'cheque' ? 1 : visita?.metodoPago === 'efectivo' ? 2 : null
  )
  const [fechaPago, setFechaPago] = useState<string | null>(visita?.fechaPago ?? null)
  const [resultadosEnviados, setResultadosEnviados] = useState(visita?.resultadosEnviados ?? false)
  const [fechaEnvioResultados, setFechaEnvioResultados] = useState<string | null>(visita?.fechaEnvioResultados ?? null)
  const [costoRef, setCostoRef] = useState<number>(visita?.costo ?? 0)
  const [cotizacion, setCotizacion] = useState<CostoVisitaDetalle | null>(null)
  const [isCotizando, startCotizacion] = useTransition()

  const handleCotizar = useCallback(() => {
    if (!selectedExams.length) return
    startCotizacion(async () => {
      const result = await calcularCostoVisita(paciente.id, selectedExams)
      setCotizacion(result)
      setCostoRef(result.total)
    })
  }, [paciente.id, selectedExams, startCotizacion])

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
    fd.set('pagado', String(pagado))
    fd.set('resultadosEnviados', String(resultadosEnviados))

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
  const examenesOptions = examenes.map((e) => ({ id: e.id, label: `${e.nombre} (${e.codigo})` }))
  const enfermerasOptions = enfermeras.map((e) => ({ id: e.id, label: formatNombre(e) }))
  const sucursalesOptions = sucursales.map((s) => ({ id: s.id, label: `${s.nombre}${s.laboratorio ? ` (${s.laboratorio})` : ''}` }))
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

              <div className="flex flex-col gap-1.5">
                <label className={labelClass} style={labelStyle}>Costo</label>
                <input
                  name="costo"
                  type="number"
                  min="0"
                  value={costoRef}
                  onChange={(e) => setCostoRef(Number(e.target.value))}
                  disabled={isPending}
                  className={inputClass}
                  style={inputStyle}
                />
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
                <label className={labelClass} style={labelStyle}>Sucursal</label>
                <input type="hidden" name="idSucursal" value={selectedSucursalId ?? ''} />
                <SelectCombobox
                  mode="single"
                  options={sucursalesOptions}
                  selected={selectedSucursalId}
                  onChange={setSelectedSucursalId}
                  placeholder="Buscar sucursal…"
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
            <SelectCombobox
              options={procedimientosOptions}
              selected={selectedProcedures}
              onChange={setSelectedProcedures}
              placeholder="Buscar procedimiento..."
              disabled={isPending}
            />
          </div>
        </section>

        {/* ── Exámenes ── */}
        <section className={sectionClass} style={sectionStyle}>
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className={sectionTitleClass} style={{ ...sectionTitleStyle, marginBottom: 0 }}>Exámenes</h2>
              <button
                type="button"
                onClick={handleCotizar}
                disabled={isPending || isCotizando || selectedExams.length === 0}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
              >
                {isCotizando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Calculator className="h-3 w-3" />}
                Cotizar
              </button>
            </div>
            <SelectCombobox
              options={examenesOptions}
              selected={selectedExams}
              onChange={setSelectedExams}
              placeholder="Buscar examen..."
              disabled={isPending}
            />
            {cotizacion && cotizacion.desglose.length > 0 && (
              <div
                className="mt-3 rounded-lg border p-3 text-sm"
                style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
              >
                <p className="mb-2 font-medium" style={{ color: 'var(--foreground)' }}>Desglose de cotización</p>
                {cotizacion.desglose.map((d) => (
                  <div key={d.descripcion} className="flex justify-between" style={{ color: 'var(--muted-foreground)' }}>
                    <span>{d.descripcion}</span>
                    <span className="font-mono">${d.monto.toLocaleString('es-CL')}</span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t pt-2 font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                  <span>Total</span>
                  <span className="font-mono">${cotizacion.total.toLocaleString('es-CL')}</span>
                </div>
              </div>
            )}
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
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pagado}
                      onChange={(e) => setPagado(e.target.checked)}
                      disabled={isPending}
                      className="h-4 w-4 rounded"
                    />
                    <span className={labelClass} style={labelStyle}>Pagado</span>
                  </label>
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
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resultadosEnviados}
                      onChange={(e) => setResultadosEnviados(e.target.checked)}
                      disabled={isPending}
                      className="h-4 w-4 rounded"
                    />
                    <span className={labelClass} style={labelStyle}>Resultados enviados</span>
                  </label>
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
