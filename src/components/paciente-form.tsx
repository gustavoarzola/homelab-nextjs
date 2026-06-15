'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { Loader2, Plus, X, CheckCircle2 } from 'lucide-react'
import { createPaciente, updatePaciente } from '@/lib/actions/pacientes'
import type { PacienteDetalle } from '@/lib/actions/pacientes'
import { formatRut, validatePasaporte } from '@/lib/rut'
import { BirthDatePicker } from '@/components/birth-date-picker'
import { SelectCombobox } from '@/components/select-combobox'
import { FileUpload } from '@/components/file-upload'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  paciente?: PacienteDetalle
  previsiones: { id: number; nombre: string }[]
  residencias: { id: number; nombre: string }[]
  signedUrlIdentificacion?: string | null
}

type AddressState = {
  direccion: string
  direccionFormateada: string
  numero: string
  calle: string
  localidad: string
  areaAdministrativa1: string
  areaAdministrativa2: string
  areaAdministrativa3: string
  pais: string
  latitud: string
  longitud: string
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50'
const inputStyle = {
  backgroundColor: 'var(--background)',
  border: '1px solid var(--input)',
  color: 'var(--foreground)',
}
const labelClass = 'text-sm font-medium'
const labelStyle = { color: 'var(--foreground)' }

// ─── Map preview ──────────────────────────────────────────────────────────────

function MapPreview({ lat, lng }: { lat: string; lng: string }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)

  useEffect(() => {
    // Capturar el nodo sincrónicamente: si React (StrictMode) desmonta el componente
    // antes de que resuelva la promesa, mapRef.current pasa a null y causaría una
    // inicialización fallida. Al usar `container` + `isConnected` se evita ese problema.
    const container = mapRef.current
    if (!container || !lat || !lng) return

    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    if (isNaN(latNum) || isNaN(lngNum)) return

    setOptions({ key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '', v: 'weekly' })
    Promise.all([importLibrary('maps'), importLibrary('marker')]).then(
      ([mapsLib, markerLib]) => {
        if (!container.isConnected) return

        const { Map } = mapsLib as google.maps.MapsLibrary
        const { AdvancedMarkerElement } = markerLib as google.maps.MarkerLibrary

        const position = { lat: latNum, lng: lngNum }

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new Map(container, {
            center: position,
            zoom: 16,
            mapId: 'paciente-map',
            disableDefaultUI: true,
            zoomControl: true,
          })
        } else {
          mapInstanceRef.current.setCenter(position)
        }

        if (markerRef.current) {
          markerRef.current.map = null
        }
        markerRef.current = new AdvancedMarkerElement({
          map: mapInstanceRef.current,
          position,
        })
      },
    )
  }, [lat, lng])

  if (!lat || !lng) return null

  return (
    <div
      ref={mapRef}
      className="w-full overflow-hidden rounded-lg"
      style={{ height: '450px', border: '1px solid var(--border)' }}
    />
  )
}

// ─── Address autocomplete via PlaceAutocompleteElement (Places API new) ───────

function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  onPlaceSelected: (addr: AddressState) => void
  disabled?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elementRef = useRef<any>(null)
  const initialValue = useRef(value)

  useEffect(() => {
    if (!containerRef.current || elementRef.current) return

    setOptions({ key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '', v: 'weekly' })

    importLibrary('places').then(() => {
      if (!containerRef.current || elementRef.current) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const PlaceAutocompleteElement = (google.maps.places as any).PlaceAutocompleteElement
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el: any = new PlaceAutocompleteElement({ includedRegionCodes: ['CL'] })

      el.style.width = '100%'
      containerRef.current.appendChild(el)
      elementRef.current = el

      // Set initial value: use the element's `value` property and also set the
      // shadow DOM input after 300ms (needed for the component to fully mount).
      if (initialValue.current) {
        el.value = initialValue.current
        setTimeout(() => {
          const input = el.shadowRoot?.querySelector('input')
          if (input) {
            input.value = initialValue.current
            input.dispatchEvent(new Event('input', { bubbles: true }))
          }
        }, 300)
      }

      el.addEventListener('gmp-select', async (event: Event) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prediction = (event as any).placePrediction
        if (!prediction) return

        const place = prediction.toPlace()
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location', 'addressComponents'],
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const components: any[] = place.addressComponents ?? []
        const get = (type: string): string =>
          components.find((c) => c.types.includes(type))?.longText ?? ''

        const numero = get('street_number')
        const calle = get('route')
        const localidad = get('locality') || get('sublocality_level_1') || get('sublocality')
        const areaAdministrativa3 =
          get('administrative_area_level_3') || get('locality') || get('sublocality_level_1')
        const areaAdministrativa2 = get('administrative_area_level_2')
        const areaAdministrativa1 = get('administrative_area_level_1')
        const pais = get('country')
        const direccionFormateada: string = place.formattedAddress ?? ''
        const latitud = place.location?.lat().toString() ?? ''
        const longitud = place.location?.lng().toString() ?? ''
        const direccion = direccionFormateada || [calle, numero].filter(Boolean).join(' ')

        onChange(direccionFormateada || direccion)
        onPlaceSelected({
          direccion, direccionFormateada, numero, calle, localidad,
          areaAdministrativa1, areaAdministrativa2, areaAdministrativa3, pais, latitud, longitud,
        })
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync disabled state
  useEffect(() => {
    if (!elementRef.current) return
    if (disabled) elementRef.current.setAttribute('disabled', '')
    else elementRef.current.removeAttribute('disabled')
  }, [disabled])

  return <div ref={containerRef} className="w-full" />
}

// ─── Main form ────────────────────────────────────────────────────────────────

const TIPO_IDENTIFICADOR_OPTIONS = [
  { id: 1, label: 'RUT', value: 'rut' },
  { id: 2, label: 'Pasaporte', value: 'pasaporte' },
]

export function PacienteForm({ paciente, previsiones, residencias, signedUrlIdentificacion }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [createdId, setCreatedId] = useState<number | null>(null)
  const [keyIdentificacion, setKeyIdentificacion] = useState<string | null>(
    paciente?.keyIdentificacion ?? null,
  )

  const getTipoIdOptionId = (value: string): number | null => {
    const opt = TIPO_IDENTIFICADOR_OPTIONS.find((o) => o.value === value)
    return opt?.id ?? null
  }

  const [tipoIdSelected, setTipoIdSelected] = useState<number | null>(
    paciente?.tipoIdentificador ? getTipoIdOptionId(paciente.tipoIdentificador) : null,
  )

  const tipoId = tipoIdSelected
    ? TIPO_IDENTIFICADOR_OPTIONS.find((o) => o.id === tipoIdSelected)?.value ?? ''
    : ''

  const [previsionSelected, setPrevisionSelected] = useState<number | null>(
    paciente?.idCompaniaSeguro ?? null,
  )

  const [residenciaSelected, setResidenciaSelected] = useState<number | null>(
    paciente?.idResidenciaAdulto ?? null,
  )
  const [fechaNacimiento, setFechaNacimiento] = useState<string | undefined>(
    paciente?.fechaNacimiento ?? undefined,
  )

  const [phones, setPhones] = useState<{ telefono: string; descripcion: string }[]>(
    paciente?.telefonos?.length
      ? paciente.telefonos.map((p) => ({ telefono: p.telefono, descripcion: p.descripcion ?? '' }))
      : [{ telefono: '', descripcion: '' }],
  )

  const [addressValue, setAddressValue] = useState(
    paciente?.direccionFormateada || paciente?.direccion || '',
  )

  const [addressFields, setAddressFields] = useState<AddressState>({
    direccion: paciente?.direccion ?? '',
    direccionFormateada: paciente?.direccionFormateada ?? '',
    numero: paciente?.numero ?? '',
    calle: paciente?.calle ?? '',
    localidad: paciente?.localidad ?? '',
    areaAdministrativa1: paciente?.areaAdministrativa1 ?? '',
    areaAdministrativa2: paciente?.areaAdministrativa2 ?? '',
    areaAdministrativa3: paciente?.areaAdministrativa3 ?? '',
    pais: paciente?.pais ?? '',
    latitud: paciente?.latitud ?? '',
    longitud: paciente?.longitud ?? '',
  })

  const addPhone = () => setPhones((prev) => [...prev, { telefono: '', descripcion: '' }])
  const removePhone = (i: number) => setPhones((prev) => prev.filter((_, idx) => idx !== i))
  const updatePhone = (i: number, field: 'telefono' | 'descripcion', val: string) =>
    setPhones((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: val } : p)))

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrors({})

    const fd = new FormData(e.currentTarget)

    // Append address fields (from state, since inputs are hidden)
    fd.set('direccion', addressFields.direccion || addressValue)
    fd.set('direccionFormateada', addressFields.direccionFormateada)
    fd.set('numero', addressFields.numero)
    fd.set('calle', addressFields.calle)
    fd.set('localidad', addressFields.localidad)
    fd.set('areaAdministrativa1', addressFields.areaAdministrativa1)
    fd.set('areaAdministrativa2', addressFields.areaAdministrativa2)
    fd.set('areaAdministrativa3', addressFields.areaAdministrativa3)
    fd.set('pais', addressFields.pais)
    fd.set('latitud', addressFields.latitud)
    fd.set('longitud', addressFields.longitud)

    // Append phones
    phones.forEach((p, i) => {
      fd.set(`phone_${i}`, p.telefono)
      fd.set(`phone_desc_${i}`, p.descripcion)
    })

    startTransition(async () => {
      const result = paciente ? await updatePaciente(fd) : await createPaciente(fd)
      if (result.success) {
        if (!paciente) {
          setCreatedId((result as { success: true; data: { id: number } }).data.id)
        } else {
          setCreatedId(paciente.id)
        }
      } else {
        setErrors({ general: result.error ?? 'Error desconocido' })
      }
    })
  }

  const sectionClass = 'rounded-xl border p-6'
  const sectionStyle = { backgroundColor: 'var(--card)', borderColor: 'var(--border)' }
  const sectionTitleClass = 'mb-4 text-sm font-semibold uppercase tracking-wide'
  const sectionTitleStyle = { color: 'var(--muted-foreground)' }

  if (createdId !== null) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div
          className="w-full max-w-sm rounded-xl border p-8 text-center"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <CheckCircle2 style={{ color: 'var(--primary)' }} className="h-12 w-12 mx-auto mb-4" />
          <h2 className="mb-2 text-lg font-semibold">
            {paciente ? 'Paciente actualizado' : 'Paciente creado'}
          </h2>
          <p className="mb-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {paciente
              ? 'Los datos del paciente han sido actualizados.'
              : 'El paciente ha sido registrado exitosamente.'}
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href={`/visitas/nueva?pacienteId=${createdId}`}
              className="rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-80 transition-opacity"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              Crear visita
            </Link>
            <Link
              href="/pacientes"
              className="rounded-lg px-4 py-2.5 text-sm hover:opacity-80 transition-opacity"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Volver al listado
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between border-b px-8 py-3"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          {paciente ? 'Editar paciente' : 'Nuevo paciente'}
        </h1>
        <div className="flex gap-2">
          <Link
            href="/pacientes"
            className="rounded-lg px-4 py-2 text-sm hover:opacity-80 transition-opacity"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Cancelar
          </Link>
          <button
            type="submit"
            form="paciente-form"
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {paciente ? 'Guardar cambios' : 'Crear paciente'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {errors.general && (
        <div
          className="mx-8 mt-4 rounded-lg px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--destructive)', color: 'white' }}
        >
          {errors.general}
        </div>
      )}

      <form id="paciente-form" onSubmit={handleSubmit} className="flex flex-col gap-6 p-8">
        {/* Hidden id for edit mode */}
        {paciente && <input type="hidden" name="id" value={paciente.id} />}

        {/* ── Datos personales ── */}
        <section className={sectionClass} style={sectionStyle}>
          <h2 className={sectionTitleClass} style={sectionTitleStyle}>
            Datos personales
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass} style={labelStyle}>
                Nombres <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <input
                name="nombres"
                type="text"
                required
                defaultValue={paciente?.nombres ?? ''}
                disabled={isPending}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass} style={labelStyle}>
                Apellido paterno <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <input
                name="apellidoPaterno"
                type="text"
                required
                defaultValue={paciente?.apellidoPaterno ?? ''}
                disabled={isPending}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass} style={labelStyle}>
                Apellido materno
              </label>
              <input
                name="apellidoMaterno"
                type="text"
                defaultValue={paciente?.apellidoMaterno ?? ''}
                disabled={isPending}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass} style={labelStyle}>
                Tipo de identificador
              </label>
              <div className="flex flex-col gap-2">
                <SelectCombobox
                  mode="single"
                  options={TIPO_IDENTIFICADOR_OPTIONS}
                  selected={tipoIdSelected}
                  onChange={setTipoIdSelected}
                  placeholder="Selecciona un tipo..."
                  disabled={isPending}
                />
                <input type="hidden" name="tipoIdentificador" value={tipoId} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass} style={labelStyle}>
                Identificador
              </label>
              <input
                name="identificador"
                type="text"
                placeholder={tipoId === 'rut' ? '12.345.678-9' : tipoId === 'pasaporte' ? 'AA1234567' : ''}
                defaultValue={
                  paciente
                    ? tipoId === 'rut'
                      ? formatRut(paciente.identificador ?? '')
                      : paciente.identificador ?? ''
                    : ''
                }
                disabled={isPending || !tipoId}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass} style={labelStyle}>
                N° de serie (cédula)
              </label>
              <input
                name="serieDocumento"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="012345678"
                defaultValue={paciente?.serieDocumento ?? ''}
                disabled={isPending}
                onInput={(e) => {
                  const t = e.currentTarget
                  t.value = t.value.replace(/\D/g, '')
                }}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass} style={labelStyle}>
                Fecha de nacimiento
              </label>
              <BirthDatePicker
                name="fechaNacimiento"
                value={fechaNacimiento}
                onChange={setFechaNacimiento}
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass} style={labelStyle}>
                Correo electrónico
              </label>
              <input
                name="correo"
                type="email"
                defaultValue={paciente?.correo ?? ''}
                disabled={isPending}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass} style={labelStyle}>
                Previsión de salud
              </label>
              <div className="flex flex-col gap-2">
                <SelectCombobox
                  mode="single"
                  options={previsiones.map((p) => ({ id: p.id, label: p.nombre }))}
                  selected={previsionSelected}
                  onChange={setPrevisionSelected}
                  placeholder="Selecciona una previsión..."
                  disabled={isPending}
                />
                <input type="hidden" name="idCompaniaSeguro" value={previsionSelected ?? ''} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass} style={labelStyle}>
                Residencia adulto mayor
              </label>
              <div className="flex flex-col gap-2">
                <SelectCombobox
                  mode="single"
                  options={residencias.map((r) => ({ id: r.id, label: r.nombre }))}
                  selected={residenciaSelected}
                  onChange={setResidenciaSelected}
                  placeholder="Selecciona una residencia..."
                  disabled={isPending}
                />
                <input type="hidden" name="idResidenciaAdulto" value={residenciaSelected ?? ''} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className={labelClass} style={labelStyle}>
                Información adicional
              </label>
              <textarea
                name="informacionAdicional"
                rows={3}
                defaultValue={paciente?.informacionAdicional ?? ''}
                disabled={isPending}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>
        </section>

        {/* ── Dirección ── */}
        <section className={sectionClass} style={sectionStyle}>
          <h2 className={sectionTitleClass} style={sectionTitleStyle}>
            Dirección
          </h2>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass} style={labelStyle}>
                Búsqueda de dirección <span style={{ color: 'var(--destructive)' }}>*</span>
              </label>
              <AddressAutocomplete
                value={addressValue}
                onChange={setAddressValue}
                onPlaceSelected={(addr) => setAddressFields(addr)}
                disabled={isPending}
              />
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Escribe la dirección para buscarla en Google Maps
              </p>
            </div>

            {/* Map preview */}
            <MapPreview lat={addressFields.latitud} lng={addressFields.longitud} />

            {/* Hidden inputs for address sub-fields */}
            <input type="hidden" name="direccion" value={addressFields.direccion || addressValue} />
            <input type="hidden" name="direccionFormateada" value={addressFields.direccionFormateada} />
            <input type="hidden" name="numero" value={addressFields.numero} />
            <input type="hidden" name="calle" value={addressFields.calle} />
            <input type="hidden" name="localidad" value={addressFields.localidad} />
            <input type="hidden" name="areaAdministrativa1" value={addressFields.areaAdministrativa1} />
            <input type="hidden" name="areaAdministrativa2" value={addressFields.areaAdministrativa2} />
            <input type="hidden" name="areaAdministrativa3" value={addressFields.areaAdministrativa3} />
            <input type="hidden" name="pais" value={addressFields.pais} />
            <input type="hidden" name="latitud" value={addressFields.latitud} />
            <input type="hidden" name="longitud" value={addressFields.longitud} />
          </div>
        </section>

        {/* ── Documento de identificación ── */}
        <section className={sectionClass} style={sectionStyle}>
          <h2 className={sectionTitleClass} style={sectionTitleStyle}>
            Documento de identificación
          </h2>
          <p className="mb-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Imagen (JPG, PNG, WEBP) o PDF. Máximo 10 MB.
          </p>
          <input type="hidden" name="keyIdentificacion" value={keyIdentificacion ?? ''} />
          <FileUpload
            folder="pacientes"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            currentKey={keyIdentificacion}
            signedUrl={signedUrlIdentificacion}
            onUploaded={setKeyIdentificacion}
            disabled={isPending}
          />
        </section>

        {/* ── Teléfonos ── */}
        <section className={sectionClass} style={sectionStyle}>
          <h2 className={sectionTitleClass} style={sectionTitleStyle}>
            Teléfonos
          </h2>
          <div className="flex flex-col gap-2">
            {phones.map((phone, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="tel"
                  value={phone.telefono}
                  onChange={(e) => updatePhone(i, 'telefono', e.target.value)}
                  placeholder="+56 9 1234 5678"
                  disabled={isPending}
                  className="flex-1 rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50"
                  style={inputStyle}
                />
                <input
                  type="text"
                  value={phone.descripcion}
                  onChange={(e) => updatePhone(i, 'descripcion', e.target.value)}
                  placeholder="celular, casa..."
                  disabled={isPending}
                  className="w-36 rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => removePhone(i)}
                  disabled={isPending || phones.length === 1}
                  className="rounded p-2 hover:opacity-80 transition-opacity disabled:opacity-30"
                  style={{ color: 'var(--muted-foreground)' }}
                  title="Eliminar teléfono"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addPhone}
              disabled={isPending}
              className="flex w-fit items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm hover:opacity-80 transition-opacity disabled:opacity-50"
              style={{ color: 'var(--primary)' }}
            >
              <Plus className="h-4 w-4" />
              Agregar teléfono
            </button>
          </div>
        </section>

      </form>
    </>
  )
}
