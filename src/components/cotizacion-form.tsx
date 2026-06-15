'use client'

import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  AlertCircle,
  Printer,
  ChevronRight,
  Stethoscope,
  FlaskConical,
  BookOpen,
  Search,
  X,
  MapPin,
  Sparkles,
} from 'lucide-react'
import { SelectCombobox } from '@/components/select-combobox'
import { ExamLabel } from '@/components/exam-label'
import { Checkbox } from '@/components/ui/checkbox'
import { ExamenesPorGrupo, buildInitialGroups, appendExamGroupsToFormData } from '@/components/exam-grupo-block'
import type { ExamGroup } from '@/components/exam-grupo-block'
import { formatNombre } from '@/lib/paciente'
import { COMUNAS_OPTIONS, COMUNAS_RM } from '@/lib/comunas'
import { EXAM_GRUPO_META } from '@/lib/exam-grupos'
import type { CotizacionDetalle } from '@/lib/actions/cotizaciones'
import type { TallerRow, IsaprePrevisionRow, ExamenRow } from '@/lib/actions/catalogos'
import { toast } from 'sonner'

export type PacienteOption = {
  id: number
  nombres: string
  apellidoPaterno: string | null
  apellidoMaterno?: string | null
  comuna: string | null
  email?: string | null
  telefono?: string | null
  rut?: string | null
}

type ProcedimientoOption = {
  id: number
  nombre: string
  codigo: string
  precio: number
}

type Props = {
  cotizacion?: CotizacionDetalle
  pacientes: PacienteOption[]
  procedimientos: ProcedimientoOption[]
  examenes: ExamenRow[]
  talleres: TallerRow[]
  tiposRecargos: { id: number; label: string; precio: number }[]
  preciosVisita: Record<string, number>
  isaprePrevisiones: IsaprePrevisionRow[]
  onSubmit: (fd: FormData) => Promise<{ success: true; id: number } | { success: false; error: string }>
}

const CLP = (n: number) => '$' + (n || 0).toLocaleString('es-CL')

function comunaFromIdx(idx: number | null): string | null {
  if (idx === null || idx < 0) return null
  return COMUNAS_RM[idx] ?? null
}

function idxFromComuna(nombre: string | null): number | null {
  if (!nombre) return null
  const idx = COMUNAS_RM.indexOf(nombre)
  return idx >= 0 ? idx : null
}

function getInitials(p: PacienteOption): string {
  const first = p.nombres?.charAt(0) ?? ''
  const last = p.apellidoPaterno?.charAt(0) ?? ''
  return (first + last).toUpperCase()
}

type ServiceTab = 'procedimientos' | 'examenes' | 'talleres'

export function CotizacionForm({
  cotizacion,
  pacientes,
  procedimientos,
  examenes,
  talleres,
  tiposRecargos,
  preciosVisita,
  isaprePrevisiones,
  onSubmit,
}: Props) {
  const router = useRouter()
  const isEdit = !!cotizacion
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error])
  const [activeTab, setActiveTab] = useState<ServiceTab>('procedimientos')

  // Destinatario
  const [selectedIdPaciente, setSelectedIdPaciente] = useState<number | null>(cotizacion?.idPaciente ?? null)
  const [nombreDestinatario, setNombreDestinatario] = useState(cotizacion?.nombreDestinatario ?? '')
  const [emailDestinatario, setEmailDestinatario] = useState(cotizacion?.emailDestinatario ?? '')
  const [telefonoDestinatario, setTelefonoDestinatario] = useState(cotizacion?.telefonoDestinatario ?? '')
  const [identificacionDestinatario, setIdentificacionDestinatario] = useState(cotizacion?.identificacionDestinatario ?? '')

  const [selectedComunaIdx, setSelectedComunaIdx] = useState<number | null>(
    idxFromComuna(cotizacion?.comuna ?? null)
  )

  const pacienteSeleccionado = pacientes.find((p) => p.id === selectedIdPaciente) ?? null
  const comunaPaciente = pacienteSeleccionado?.comuna ?? null
  const comunaNombre = selectedIdPaciente ? comunaPaciente : comunaFromIdx(selectedComunaIdx)

  // Items
  const [selectedProcedures, setSelectedProcedures] = useState<number[]>(cotizacion?.procedureIds ?? [])
  const [examGroups, setExamGroups] = useState<ExamGroup[]>(() =>
    buildInitialGroups(
      cotizacion?.examIds ?? [],
      cotizacion?.examPrices ?? [],
      cotizacion?.isapreExams ?? [],
      examenes,
    )
  )
  const [selectedTallers, setSelectedTallers] = useState<number[]>(cotizacion?.tallerIds ?? [])
  const [tallerPriceMap, setTallerPriceMap] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {}
    for (const t of cotizacion?.tallerPrices ?? []) {
      map[t.idTaller] = String(t.precio)
    }
    return map
  })

  // Cargos adicionales
  const [cobraVisita, setCobraVisita] = useState(cotizacion?.cobraVisita ?? false)
  const [selectedSurcharges, setSelectedSurcharges] = useState<number[]>(cotizacion?.surchargeIds ?? [])
  const [notas, setNotas] = useState(cotizacion?.notas ?? '')

  const showManualFields = !selectedIdPaciente

  const precioVisita = useMemo(() => {
    if (!cobraVisita) return 0
    if (!comunaNombre) return preciosVisita['__base__'] ?? 0
    return preciosVisita[comunaNombre] ?? preciosVisita['__base__'] ?? 0
  }, [cobraVisita, comunaNombre, preciosVisita])

  const totalProcedimientos = useMemo(() =>
    selectedProcedures.reduce((sum, id) => sum + (procedimientos.find((p) => p.id === id)?.precio ?? 0), 0),
    [selectedProcedures, procedimientos]
  )
  const regularExamIds = examGroups
    .filter((g) => EXAM_GRUPO_META[g.grupoId].tipo === 'catalogo')
    .flatMap((g) => g.exams.map((e) => e.id))

  const isapreBlock = examGroups.find((g) => EXAM_GRUPO_META[g.grupoId].tipo === 'isapre')

  const totalExamenes = useMemo(() => {
    const catalogTotal = regularExamIds.reduce((sum, id) => sum + (examenes.find((e) => e.id === id)?.precio ?? 0), 0)
    const isapreTotal = (isapreBlock?.exams ?? []).reduce((sum, e) => {
      if (e.tipo !== 'isapre') return sum
      return sum + (Number(e.valorPagar.replace(/[^\d]/g, '')) || 0)
    }, 0)
    return catalogTotal + isapreTotal
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examGroups, examenes])
  const totalTalleres = useMemo(() =>
    selectedTallers.reduce((sum, id) => sum + (parseInt(tallerPriceMap[id] ?? '0') || 0), 0),
    [selectedTallers, tallerPriceMap]
  )
  const totalRecargos = useMemo(() =>
    selectedSurcharges.reduce((sum, id) => {
      const saved = cotizacion?.surchargePrices?.find((s) => s.idTipoRecargo === id)?.precio
      const precio = saved ?? tiposRecargos.find((t) => t.id === id)?.precio ?? 0
      return sum + precio
    }, 0),
    [selectedSurcharges, cotizacion, tiposRecargos]
  )
  const totalGeneral = totalProcedimientos + totalExamenes + totalTalleres + precioVisita + totalRecargos

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!comunaNombre) {
      const msg = 'Debe seleccionar una comuna'
      setError(msg)
      toast.error(msg)
      return
    }

    const fd = new FormData(e.currentTarget)
    fd.set('comuna', comunaNombre)
    fd.set('cobraVisita', String(cobraVisita))
    selectedSurcharges.forEach((id) => fd.append('surcharge_ids', String(id)))
    fd.set('idPaciente', selectedIdPaciente ? String(selectedIdPaciente) : '')
    fd.set('nombreDestinatario', nombreDestinatario)
    fd.set('emailDestinatario', emailDestinatario)
    fd.set('telefonoDestinatario', telefonoDestinatario)
    fd.set('identificacionDestinatario', identificacionDestinatario)
    selectedProcedures.forEach((id) => fd.append('procedure_ids', String(id)))
    appendExamGroupsToFormData(fd, examGroups)
    selectedTallers.forEach((id) => {
      fd.append('taller_ids', String(id))
      fd.append(`taller_precio_${id}`, tallerPriceMap[id] ?? '0')
    })

    startTransition(async () => {
      const result = await onSubmit(fd)
      if (result.success) {
        if (isEdit) {
          toast.success('Cambios guardados')
        } else {
          toast.success('Cotización creada')
          router.push(`/cotizaciones/${result.id}`)
        }
      } else {
        const msg = result.error ?? 'Error desconocido'
        setError(msg)
        toast.error(msg)
      }
    })
  }

  const procedimientosOptions = procedimientos.map((p) => ({ id: p.id, label: p.nombre, code: p.codigo }))
  const pacientesOptions = pacientes.map((p) => ({ id: p.id, label: formatNombre(p) }))
  const totalExamCount = examGroups.reduce((s, g) => s + g.exams.length, 0)
  const tabs: { id: ServiceTab; label: string; count: number; Icon: typeof Stethoscope }[] = [
    { id: 'procedimientos', label: 'Procedimientos', count: selectedProcedures.length, Icon: Stethoscope },
    { id: 'examenes', label: 'Exámenes', count: totalExamCount, Icon: FlaskConical },
    { id: 'talleres', label: 'Talleres', count: selectedTallers.length, Icon: BookOpen },
  ]

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
            onClick={() => router.push('/cotizaciones')}
            className="text-[13px] transition-opacity hover:opacity-70"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Cotizaciones
          </button>
          <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
          <h1 className="text-[16px] font-semibold" style={{ color: 'var(--foreground)' }}>
            {isEdit ? `Cotización #${cotizacion!.id}` : 'Nueva cotización'}
          </h1>
          {isEdit && (
            <span
              className="rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
            >
              {cotizacion?.estado ?? 'creada'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/cotizaciones')}
            className="rounded-lg px-3.5 text-[13px] font-medium transition-opacity hover:opacity-80"
            style={{ height: 36, color: 'var(--muted-foreground)' }}
            disabled={isPending}
          >
            Cancelar
          </button>

          {isEdit && (
            <a
              href={`/api/cotizacion-standalone/${cotizacion!.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border px-3.5 text-[13px] font-medium transition-opacity hover:opacity-80"
              style={{ height: 36, color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </a>
          )}

          <button
            type="submit"
            form="cotizacion-form"
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg px-3.5 text-[13px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ height: 36, backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? 'Guardar cambios' : 'Crear cotización'}
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div
          ref={errorRef}
          className="mx-8 mt-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--destructive)', color: 'white' }}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Two-column form ── */}
      <form
        id="cotizacion-form"
        onSubmit={handleSubmit}
        className="grid gap-5 px-8 py-6"
        style={{ gridTemplateColumns: 'minmax(0,1fr) 340px', alignItems: 'start' }}
      >
        {isEdit && <input type="hidden" name="id" value={cotizacion!.id} />}

        {/* ── LEFT column ── */}
        <div className="flex flex-col gap-5">

          {/* Destinatario */}
          <section
            className="rounded-xl border p-6"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="mb-4">
              <h2
                className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Destinatario
              </h2>
              <p className="mt-0.5 text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
                El paciente predefine la comuna y los datos de contacto.
              </p>
            </div>

            {/* Patient chip when selected */}
            {pacienteSeleccionado && (
              <div
                className="mb-4 flex items-start gap-3 rounded-lg p-3"
                style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {getInitials(pacienteSeleccionado)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold" style={{ color: 'var(--foreground)' }}>
                      {formatNombre(pacienteSeleccionado)}
                    </span>
                    {pacienteSeleccionado.rut && (
                      <span className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
                        · {pacienteSeleccionado.rut}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
                    {pacienteSeleccionado.email && <span>{pacienteSeleccionado.email}</span>}
                    {pacienteSeleccionado.telefono && <span>{pacienteSeleccionado.telefono}</span>}
                    {comunaPaciente && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {comunaPaciente}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIdPaciente(null)
                    setSelectedComunaIdx(null)
                  }}
                  className="shrink-0 text-[12px] underline transition-opacity hover:opacity-70"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Cambiar
                </button>
              </div>
            )}

            <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {/* Paciente selector — full width */}
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-[13px] font-medium" style={{ color: 'var(--foreground)' }}>
                  Paciente
                  <span className="ml-1.5 text-[11px] font-normal" style={{ color: 'var(--muted-foreground)' }}>
                    opcional
                  </span>
                </label>
                <SelectCombobox
                  mode="single"
                  placeholder="Buscar por nombre, RUT o teléfono…"
                  options={pacientesOptions}
                  selected={selectedIdPaciente}
                  onChange={(value) => {
                    setSelectedIdPaciente(value)
                    if (value) {
                      setNombreDestinatario('')
                      setEmailDestinatario('')
                      setTelefonoDestinatario('')
                      setIdentificacionDestinatario('')
                      setSelectedComunaIdx(null)
                    } else {
                      setSelectedComunaIdx(null)
                    }
                  }}
                  disabled={isPending}
                  clearable
                />
              </div>

              {/* Manual fields when no patient */}
              {showManualFields && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium" style={{ color: 'var(--foreground)' }}>Nombre</label>
                    <input
                      type="text"
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50"
                      style={{ backgroundColor: 'var(--background)', border: '1px solid var(--input)', color: 'var(--foreground)' }}
                      value={nombreDestinatario}
                      onChange={(e) => setNombreDestinatario(e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium" style={{ color: 'var(--foreground)' }}>Correo electrónico</label>
                    <input
                      type="email"
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50"
                      style={{ backgroundColor: 'var(--background)', border: '1px solid var(--input)', color: 'var(--foreground)' }}
                      value={emailDestinatario}
                      onChange={(e) => setEmailDestinatario(e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium" style={{ color: 'var(--foreground)' }}>Teléfono</label>
                    <input
                      type="tel"
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50"
                      style={{ backgroundColor: 'var(--background)', border: '1px solid var(--input)', color: 'var(--foreground)' }}
                      value={telefonoDestinatario}
                      onChange={(e) => setTelefonoDestinatario(e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium" style={{ color: 'var(--foreground)' }}>Identificación</label>
                    <input
                      type="text"
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50"
                      style={{ backgroundColor: 'var(--background)', border: '1px solid var(--input)', color: 'var(--foreground)' }}
                      value={identificacionDestinatario}
                      onChange={(e) => setIdentificacionDestinatario(e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                </>
              )}

              {/* Comuna */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium" style={{ color: 'var(--foreground)' }}>
                  Comuna{!selectedIdPaciente && <span style={{ color: 'var(--destructive)' }}> *</span>}
                </label>
                {selectedIdPaciente ? (
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 text-[13px]"
                    style={{
                      backgroundColor: 'var(--muted)',
                      border: '1px solid var(--input)',
                      height: 38,
                      color: comunaPaciente ? 'var(--foreground)' : 'var(--muted-foreground)',
                    }}
                  >
                    <MapPin className="h-3 w-3 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                    <span className="flex-1">{comunaPaciente ?? 'Sin comuna registrada'}</span>
                    <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>desde paciente</span>
                  </div>
                ) : (
                  <SelectCombobox
                    mode="single"
                    placeholder="Buscar comuna…"
                    options={COMUNAS_OPTIONS}
                    selected={selectedComunaIdx}
                    onChange={setSelectedComunaIdx}
                    disabled={isPending}
                  />
                )}
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
                <h2
                  className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Servicios
                </h2>
                <p className="mt-0.5 text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
                  Procedimientos y exámenes usan precios del catálogo. Los talleres permiten precio personalizado.
                </p>
              </div>
              {(totalProcedimientos + totalExamenes + totalTalleres) > 0 && (
                <span className="shrink-0 text-[13px] tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                  Subtotal{' '}
                  <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                    {CLP(totalProcedimientos + totalExamenes + totalTalleres)}
                  </span>
                </span>
              )}
            </div>

            {/* Tab strip */}
            <div
              className="mb-5 flex items-center gap-1 rounded-lg p-1"
              style={{ backgroundColor: 'var(--muted)', width: 'fit-content' }}
            >
              {tabs.map(({ id, label, count, Icon: TabIcon }) => {
                const active = activeTab === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors"
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
                  </button>
                )
              })}
            </div>

            {/* Tab content */}
            {activeTab === 'procedimientos' && (
              <ServiceTabContent
                label="procedimiento"
                options={procedimientosOptions}
                selected={selectedProcedures}
                onChange={setSelectedProcedures}
                items={selectedProcedures.map((id) => {
                  const p = procedimientos.find((x) => x.id === id)!
                  return { id, nombre: p.nombre, codigo: p.codigo, precio: p.precio }
                })}
                disabled={isPending}
              />
            )}
            {activeTab === 'examenes' && (
              <ExamenesPorGrupo
                groups={examGroups}
                setGroups={setExamGroups}
                allExams={examenes}
                isaprePrevisiones={isaprePrevisiones}
              />
            )}
            {activeTab === 'talleres' && (
              <TalleresTabContent
                talleres={talleres}
                selected={selectedTallers}
                priceMap={tallerPriceMap}
                onChange={(ids) => {
                  setSelectedTallers(ids)
                  setTallerPriceMap((prev) => {
                    const next = { ...prev }
                    for (const key of Object.keys(next)) {
                      if (!ids.includes(Number(key))) delete next[Number(key)]
                    }
                    for (const id of ids) {
                      if (!(id in next)) next[id] = '0'
                    }
                    return next
                  })
                }}
                onPriceChange={(id, val) => setTallerPriceMap((prev) => ({ ...prev, [id]: val }))}
                disabled={isPending}
              />
            )}
          </section>

          {/* Cargos adicionales — visita + recargo side by side */}
          <section
            className="rounded-xl border p-6"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <h2
              className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Cargos adicionales
            </h2>

            <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {/* Visita */}
              <div
                className="rounded-lg p-4"
                style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="cobraVisita"
                    checked={cobraVisita}
                    onCheckedChange={(checked) => setCobraVisita(checked as boolean)}
                    disabled={isPending}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <label
                        htmlFor="cobraVisita"
                        className="cursor-pointer text-[13px] font-medium leading-tight"
                        style={{ color: 'var(--foreground)' }}
                      >
                        Cobrar visita de enfermería
                      </label>
                      {cobraVisita && precioVisita > 0 && (
                        <span className="shrink-0 text-[13px] font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
                          {CLP(precioVisita)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
                      {comunaNombre
                        ? <>Precio según <span className="font-medium" style={{ color: 'var(--foreground)' }}>{comunaNombre}</span></>
                        : 'Selecciona una comuna para ver el precio'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Recargos */}
              <div
                className="rounded-lg p-4"
                style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}
              >
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-[13px] font-medium" style={{ color: 'var(--foreground)' }}>
                    Recargos
                  </span>
                  {totalRecargos > 0 && (
                    <span className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
                      {CLP(totalRecargos)}
                    </span>
                  )}
                </div>
                <SelectCombobox
                  mode="multi"
                  placeholder="Agregar recargo…"
                  options={tiposRecargos}
                  selected={selectedSurcharges}
                  onChange={setSelectedSurcharges}
                  disabled={isPending}
                  showPills={false}
                />
                {selectedSurcharges.length > 0 && (
                  <div className="mt-2 overflow-hidden rounded-lg" style={{ border: '1px solid var(--border)' }}>
                    {selectedSurcharges.map((id) => {
                      const tipo = tiposRecargos.find((t) => t.id === id)
                      if (!tipo) return null
                      const precio = cotizacion?.surchargePrices?.find((s) => s.idTipoRecargo === id)?.precio ?? tipo.precio
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

          {/* Notas */}
          <section
            className="rounded-xl border p-6"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <h2
              className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Notas
            </h2>
            <p className="mb-3 text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
              Visible para el destinatario en el documento impreso.
            </p>
            <textarea
              name="notas"
              rows={3}
              className="w-full resize-none rounded-lg px-3 py-2.5 text-[13px] outline-none disabled:opacity-50"
              style={{ backgroundColor: 'var(--background)', border: '1px solid var(--input)', color: 'var(--foreground)' }}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas adicionales para el destinatario…"
              disabled={isPending}
            />
          </section>
        </div>

        {/* ── RIGHT — sticky summary rail ── */}
        <aside style={{ position: 'sticky', top: 80, height: 'fit-content' }}>
          <div
            className="overflow-hidden rounded-xl border"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-baseline justify-between">
                <h3
                  className="text-[12px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Resumen
                </h3>
                <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>en vivo</span>
              </div>
              {pacienteSeleccionado ? (
                <>
                  <p className="mt-2 text-[13px]" style={{ color: 'var(--foreground)' }}>
                    Para{' '}
                    <span className="font-semibold">{pacienteSeleccionado.nombres} {pacienteSeleccionado.apellidoPaterno}</span>
                  </p>
                  <p className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
                    {comunaNombre} · {selectedProcedures.length + totalExamCount + selectedTallers.length} servicios
                  </p>
                </>
              ) : (
                <p className="mt-2 text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
                  {selectedProcedures.length + totalExamCount + selectedTallers.length === 0
                    ? 'Sin ítems aún'
                    : `${selectedProcedures.length + totalExamCount + selectedTallers.length} servicios seleccionados`
                  }
                </p>
              )}
            </div>

            {/* Line items */}
            <div
              className="space-y-3 px-5 py-3"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <SummaryGroup
                tone="blue"
                label="Procedimientos"
                items={selectedProcedures.map((id) => {
                  const p = procedimientos.find((x) => x.id === id)!
                  return { name: p.nombre, price: p.precio }
                })}
                subtotal={totalProcedimientos}
              />
              <SummaryGroup
                tone="green"
                label="Exámenes"
                items={[
                  ...regularExamIds.map((id) => {
                    const e = examenes.find((x) => x.id === id)!
                    return { name: e.nombre, price: e.precio }
                  }),
                  ...(isapreBlock?.exams ?? []).map((e) => ({
                    name: e.nombre,
                    price: e.tipo === 'isapre' ? (Number(e.valorPagar.replace(/[^\d]/g, '')) || 0) : 0,
                  })),
                ]}
                subtotal={totalExamenes}
              />
              <SummaryGroup
                tone="violet"
                label="Talleres"
                items={selectedTallers.map((id) => {
                  const t = talleres.find((x) => x.id === id)!
                  return { name: t.nombre, price: parseInt(tallerPriceMap[id] ?? '0') || 0 }
                })}
                subtotal={totalTalleres}
              />
              <SummaryGroup
                tone="amber"
                label="Adicionales"
                items={[
                  ...(cobraVisita ? [{ name: `Visita${comunaNombre ? ` · ${comunaNombre}` : ''}`, price: precioVisita }] : []),
                  ...selectedSurcharges.map((id) => {
                    const tipo = tiposRecargos.find((t) => t.id === id)
                    const precio = cotizacion?.surchargePrices?.find((s) => s.idTipoRecargo === id)?.precio ?? tipo?.precio ?? 0
                    return { name: tipo?.label ?? '', price: precio }
                  }),
                ]}
                subtotal={(cobraVisita ? precioVisita : 0) + totalRecargos}
              />
            </div>

            {/* Total */}
            <div
              className="space-y-1 px-5 py-4"
              style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--muted)' }}
            >
              <div className="flex items-baseline justify-between">
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Total
                </span>
                <span
                  className="text-[22px] font-semibold tabular-nums"
                  style={{ color: 'var(--foreground)' }}
                >
                  {CLP(totalGeneral)}
                </span>
              </div>
              <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                IVA incluido · válido por 30 días
              </p>
            </div>

          </div>

          <p className="mt-3 px-2 text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
            <Sparkles
              className="inline h-3 w-3"
              style={{ marginRight: 4, verticalAlign: '-1px' }}
            />
            Al crear se enviará por correo al destinatario.
          </p>
        </aside>
      </form>
    </>
  )
}

// ── Sub-components ──

type ServiceItem = { id: number; nombre: string; codigo: string; precio: number }

function ServiceTabContent({
  label,
  options,
  selected,
  onChange,
  items,
  disabled,
}: {
  label: string
  options: { id: number; label: string }[]
  selected: number[]
  onChange: (ids: number[]) => void
  items: ServiceItem[]
  disabled: boolean
}) {
  return (
    <div>
      <div className="mb-4">
        <SelectCombobox
          mode="multi"
          placeholder={`Buscar ${label}…`}
          options={options}
          selected={selected}
          onChange={onChange}
          disabled={disabled}
          showPills={false}
        />
      </div>

      {items.length === 0 ? (
        <div
          className="rounded-lg border border-dashed py-8 text-center text-[13px]"
          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
        >
          Sin {label}s seleccionados.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg" style={{ border: '1px solid var(--border)' }}>
          {items.map((item, i) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-3.5 py-2.5 text-[13px]"
              style={{
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                backgroundColor: 'var(--card)',
              }}
            >
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[10.5px]"
                style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
              >
                {item.codigo}
              </span>
              <span className="flex-1" style={{ color: 'var(--foreground)' }}>{item.nombre}</span>
              <span className="tabular-nums" style={{ color: 'var(--foreground)', minWidth: 80, textAlign: 'right' }}>
                {CLP(item.precio)}
              </span>
              <button
                type="button"
                onClick={() => onChange(items.filter((x) => x.id !== item.id).map((x) => x.id))}
                className="rounded p-1 transition-opacity hover:opacity-70"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TalleresTabContent({
  talleres,
  selected,
  priceMap,
  onChange,
  onPriceChange,
  disabled,
}: {
  talleres: TallerRow[]
  selected: number[]
  priceMap: Record<number, string>
  onChange: (ids: number[]) => void
  onPriceChange: (id: number, val: string) => void
  disabled: boolean
}) {
  const options = talleres.filter((t) => t.activo).map((t) => ({ id: t.id, label: t.nombre, code: t.codigo }))
  const items = selected.map((id) => talleres.find((t) => t.id === id)!).filter(Boolean)

  return (
    <div>
      <div className="mb-4">
        <SelectCombobox
          mode="multi"
          placeholder="Buscar taller…"
          options={options}
          selected={selected}
          onChange={onChange}
          disabled={disabled}
          showPills={false}
        />
      </div>

      {items.length === 0 ? (
        <div
          className="rounded-lg border border-dashed py-8 text-center text-[13px]"
          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
        >
          Sin talleres seleccionados.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg" style={{ border: '1px solid var(--border)' }}>
          {items.map((taller, i) => (
            <div
              key={taller.id}
              className="flex items-center gap-3 px-3.5 py-2.5 text-[13px]"
              style={{
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                backgroundColor: 'var(--card)',
              }}
            >
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[10.5px]"
                style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
              >
                {taller.codigo}
              </span>
              <span className="flex-1" style={{ color: 'var(--foreground)' }}>{taller.nombre}</span>
              <div
                className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-[13px]"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
              >
                <span style={{ color: 'var(--muted-foreground)' }}>$</span>
                <input
                  type="number"
                  min="0"
                  value={priceMap[taller.id] ?? ''}
                  onChange={(e) => onPriceChange(taller.id, e.target.value)}
                  placeholder="0"
                  disabled={disabled}
                  className="w-20 bg-transparent text-right tabular-nums outline-none"
                  style={{ color: 'var(--foreground)' }}
                />
              </div>
              <button
                type="button"
                onClick={() => onChange(selected.filter((id) => id !== taller.id))}
                className="rounded p-1 transition-opacity hover:opacity-70"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryGroup({
  label,
  tone,
  items,
  subtotal,
}: {
  label: string
  tone: 'blue' | 'green' | 'violet' | 'amber'
  items: (
    | { name: string; price: number }
    | { code: string; nombre: string; grupoExamen: string; price: number }
  )[]
  subtotal: number
}) {
  const dotColor = {
    blue: 'oklch(0.45 0.12 240)',
    green: 'oklch(0.45 0.13 145)',
    violet: 'oklch(0.45 0.13 290)',
    amber: 'oklch(0.5 0.13 70)',
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
        <span
          className="inline-flex items-center gap-2 text-[12px] font-medium"
          style={{ color: 'var(--foreground)' }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
          {label}
        </span>
        <span className="text-[12px] font-medium tabular-nums">{CLP(subtotal)}</span>
      </div>
      <ul className="space-y-0.5 pl-3.5">
        {items.filter((i) => i.price > 0).map((item, idx) => (
          <li
            key={idx}
            className="flex items-baseline justify-between gap-2 text-[12px]"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {'code' in item ? (
              <ExamLabel codigo={item.code} nombre={item.nombre} grupoExamen={item.grupoExamen} />
            ) : (
              <span className="truncate">{item.name}</span>
            )}
            <span className="shrink-0 tabular-nums">{CLP(item.price)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
