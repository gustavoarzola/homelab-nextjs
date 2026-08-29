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
  MapPin,
  Sparkles,
} from 'lucide-react'
import { SelectCombobox } from '@/components/select-combobox'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExamenesPorGrupo, buildInitialGroups, appendExamGroupsToFormData } from '@/components/exam-grupo-block'
import type { ExamGroup } from '@/components/exam-grupo-block'
import { formatNombre } from '@/lib/paciente'
import { EXAM_GRUPO_META } from '@/lib/exam-grupos'
import { ESTADO_COTIZACION_STYLES } from '@/lib/estado-colors'
import type { CotizacionDetalle } from '@/lib/actions/cotizaciones'
import { resolverMontoDescuento } from '@/lib/pricing/descuento'
import type { TallerRow, IsaprePrevisionRow, ExamenRow } from '@/lib/actions/catalogos'
import { toast } from 'sonner'
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

export type PacienteOption = {
  id: number
  nombres: string
  apellidoPaterno: string | null
  apellidoMaterno?: string | null
  comuna: string | null
  idComuna: number | null
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

type ComunaOption = { id: number; nombre: string }

type Props = {
  cotizacion?: CotizacionDetalle
  pacientes: PacienteOption[]
  procedimientos: ProcedimientoOption[]
  examenes: ExamenRow[]
  talleres: TallerRow[]
  tiposRecargos: { id: number; label: string; precio: number }[]
  preciosVisita: Record<string, number>
  isaprePrevisiones: IsaprePrevisionRow[]
  comunas: ComunaOption[]
  onSubmit: (fd: FormData) => Promise<{ success: true; data: { id: number } } | { success: false; error: string }>
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
  comunas,
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

  const [selectedIdComuna, setSelectedIdComuna] = useState<number | null>(cotizacion?.idComuna ?? null)

  const pacienteSeleccionado = pacientes.find((p) => p.id === selectedIdPaciente) ?? null
  const comunaPaciente = pacienteSeleccionado?.comuna ?? null
  // El paciente predefine la comuna sólo si su dirección matchea el catálogo
  // (`idComuna` resuelto en `getPacientes()`). Si no matchea (dirección fuera
  // de la RM, o texto que no coincide con ninguna comuna activa), se exige
  // selección manual — igual que cuando no hay paciente seleccionado.
  const comunaPacienteSinMatch = !!pacienteSeleccionado && pacienteSeleccionado.idComuna === null
  const requiereSeleccionManualComuna = !selectedIdPaciente || comunaPacienteSinMatch
  const idComunaEfectivo = requiereSeleccionManualComuna ? selectedIdComuna : (pacienteSeleccionado?.idComuna ?? null)
  const comunaNombre = requiereSeleccionManualComuna
    ? (comunas.find((c) => c.id === selectedIdComuna)?.nombre ?? null)
    : comunaPaciente

  // Items
  const [selectedProcedures, setSelectedProcedures] = useState<number[]>(cotizacion?.procedureIds ?? [])
  const [procedureDiscountMap, setProcedureDiscountMap] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {}
    for (const p of cotizacion?.procedurePrices ?? []) {
      map[p.idProcedimiento] = String(p.descuento)
    }
    return map
  })
  const [descuentoProcedimientosAfectaPagoEnfermera, setDescuentoProcedimientosAfectaPagoEnfermera] = useState(
    cotizacion?.descuentoProcedimientosAfectaPagoEnfermera ?? false,
  )
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
  const [montoInsumos, setMontoInsumos] = useState(String(cotizacion?.montoInsumos ?? 0))
  const [notas, setNotas] = useState(cotizacion?.notas ?? '')
  const [aplicaDescuento, setAplicaDescuento] = useState((cotizacion?.descuentoValor ?? 0) > 0)
  const [descuentoTipo, setDescuentoTipo] = useState<'monto' | 'porcentaje'>(cotizacion?.descuentoTipo ?? 'monto')
  const [descuentoValor, setDescuentoValor] = useState(String(cotizacion?.descuentoValor ?? 0))
  const [descuentoAfectaPagoEnfermera, setDescuentoAfectaPagoEnfermera] = useState(
    cotizacion?.descuentoAfectaPagoEnfermera ?? false,
  )

  const showManualFields = !selectedIdPaciente

  const precioVisita = useMemo(() => {
    if (!cobraVisita) return 0
    if (idComunaEfectivo === null) return preciosVisita['__base__'] ?? 0
    return preciosVisita[String(idComunaEfectivo)] ?? preciosVisita['__base__'] ?? 0
  }, [cobraVisita, idComunaEfectivo, preciosVisita])

  const montoDescuento = useMemo(
    () => cobraVisita && aplicaDescuento
      ? resolverMontoDescuento(precioVisita, descuentoTipo, parseInt(descuentoValor) || 0)
      : 0,
    [cobraVisita, aplicaDescuento, precioVisita, descuentoTipo, descuentoValor],
  )
  const precioVisitaNeto = Math.max(0, precioVisita - montoDescuento)

  const totalProcedimientosOriginal = useMemo(() =>
    selectedProcedures.reduce((sum, id) => sum + (procedimientos.find((p) => p.id === id)?.precio ?? 0), 0),
    [selectedProcedures, procedimientos]
  )
  const montoDescuentoProcedimientos = useMemo(() =>
    selectedProcedures.reduce((sum, id) => {
      const precio = procedimientos.find((p) => p.id === id)?.precio ?? 0
      const descuento = parseInt(procedureDiscountMap[id] ?? '0') || 0
      return sum + Math.min(Math.max(0, descuento), precio)
    }, 0),
    [selectedProcedures, procedimientos, procedureDiscountMap]
  )
  const totalProcedimientos = totalProcedimientosOriginal - montoDescuentoProcedimientos
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
  const montoInsumosNum = parseInt(montoInsumos) || 0
  const totalGeneral = totalProcedimientos + totalExamenes + totalTalleres + precioVisitaNeto + totalRecargos + montoInsumosNum

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (idComunaEfectivo === null) {
      const msg = 'Debe seleccionar una comuna'
      setError(msg)
      toast.error(msg)
      return
    }

    const fd = new FormData(e.currentTarget)
    fd.set('idComuna', String(idComunaEfectivo))
    fd.set('cobraVisita', String(cobraVisita))
    fd.set('montoInsumos', montoInsumos)
    fd.set('descuentoTipo', descuentoTipo)
    fd.set('descuentoValor', aplicaDescuento ? descuentoValor : '0')
    fd.set('descuentoAfectaPagoEnfermera', String(descuentoAfectaPagoEnfermera))
    fd.set('descuentoProcedimientosAfectaPagoEnfermera', String(descuentoProcedimientosAfectaPagoEnfermera))
    selectedSurcharges.forEach((id) => fd.append('surcharge_ids', String(id)))
    fd.set('idPaciente', selectedIdPaciente ? String(selectedIdPaciente) : '')
    fd.set('nombreDestinatario', nombreDestinatario)
    fd.set('emailDestinatario', emailDestinatario)
    fd.set('telefonoDestinatario', telefonoDestinatario)
    fd.set('identificacionDestinatario', identificacionDestinatario)
    selectedProcedures.forEach((id) => {
      fd.append('procedure_ids', String(id))
      fd.set(`procedimiento_descuento_${id}`, procedureDiscountMap[id] ?? '0')
    })
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
          router.push(`/cotizaciones/${result.data.id}`)
        }
      } else {
        const msg = result.error ?? 'Error desconocido'
        setError(msg)
        toast.error(msg)
      }
    })
  }

  const procedimientosOptions = procedimientos.map((p) => ({ id: p.id, label: p.nombre, code: p.codigo }))
  const talleresOptions = talleres.filter((t) => t.activo).map((t) => ({ id: t.id, label: t.nombre, code: t.codigo }))
  const pacientesOptions = pacientes.map((p) => ({ id: p.id, label: formatNombre(p) }))
  const comunasOptions = comunas.map((c) => ({ id: c.id, label: c.nombre }))
  const totalExamCount = examGroups.reduce((s, g) => s + g.exams.length, 0)
  const tabs: { id: ServiceTab; label: string; count: number; Icon: typeof Stethoscope }[] = [
    { id: 'procedimientos', label: 'Procedimientos', count: selectedProcedures.length, Icon: Stethoscope },
    { id: 'examenes', label: 'Exámenes', count: totalExamCount, Icon: FlaskConical },
    { id: 'talleres', label: 'Talleres', count: selectedTallers.length, Icon: BookOpen },
  ]

  const estadoCfg = isEdit && cotizacion.estado
    ? (ESTADO_COTIZACION_STYLES[cotizacion.estado] ?? ESTADO_COTIZACION_STYLES.creada!)
    : null

  return (
    <>
      {/* ── Sticky header ── */}
      <div className="edit-bar">
        <div className="edit-bar__crumb">
          <button
            type="button"
            onClick={() => router.push('/cotizaciones')}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit' }}
          >
            Cotizaciones
          </button>
          <ChevronRight style={{ width: 14, height: 14 }} />
        </div>
        <h1>
          {isEdit ? `Cotización #${cotizacion!.id}` : 'Nueva cotización'}
          {isEdit && estadoCfg && <Badge badgeClass={estadoCfg.badgeClass}>{estadoCfg.label}</Badge>}
        </h1>

        <span className="edit-bar__spacer" />

        <Button type="button" variant="ghost" onClick={() => router.push('/cotizaciones')} disabled={isPending}>
          Cancelar
        </Button>
        {isEdit && (
          <Button variant="secondary" asChild>
            <a href={`/api/cotizacion-standalone/${cotizacion!.id}`} target="_blank" rel="noopener noreferrer">
              <Printer />
              Imprimir
            </a>
          </Button>
        )}
        <Button type="submit" form="cotizacion-form" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          {isEdit ? 'Guardar cambios' : 'Crear cotización'}
        </Button>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div ref={errorRef} className="hl-callout hl-callout--bad mx-8 mt-4">
          <AlertCircle />
          <div>{error}</div>
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
          <section className="fcard">
            <div className="fcard__head">
              <div>
                <h2>Destinatario</h2>
                <p>El paciente predefine la comuna y los datos de contacto.</p>
              </div>
            </div>
            <div className="fcard__body">
              {/* Patient chip when selected */}
              {pacienteSeleccionado && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 13, borderRadius: 'var(--radius-md)', background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)' }}>
                  <span className="hl-avatar" style={{ width: 36, height: 36 }}>{getInitials(pacienteSeleccionado)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>{formatNombre(pacienteSeleccionado)}</span>
                      {pacienteSeleccionado.rut && (
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>· {pacienteSeleccionado.rut}</span>
                      )}
                    </div>
                    <div style={{ marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: '2px 16px', fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>
                      {pacienteSeleccionado.email && <span>{pacienteSeleccionado.email}</span>}
                      {pacienteSeleccionado.telefono && <span>{pacienteSeleccionado.telefono}</span>}
                      {comunaPaciente && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MapPin style={{ width: 12, height: 12 }} />
                          {comunaPaciente}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedIdPaciente(null)
                      setSelectedIdComuna(null)
                    }}
                    style={{ flexShrink: 0, fontSize: 'var(--text-sm)', textDecoration: 'underline', color: 'var(--color-fg-muted)', background: 'transparent', border: 0, cursor: 'pointer' }}
                  >
                    Cambiar
                  </button>
                </div>
              )}

              <div className="hl-row2">
                {/* Paciente selector — full width */}
                <div className="hl-fieldgroup" style={{ gridColumn: '1 / -1' }}>
                  <label>
                    Paciente <span style={{ fontWeight: 400, color: 'var(--color-fg-muted)' }}>opcional</span>
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
                        setSelectedIdComuna(null)
                      } else {
                        setSelectedIdComuna(null)
                      }
                    }}
                    disabled={isPending}
                    clearable
                  />
                </div>

                {/* Manual fields when no patient */}
                {showManualFields && (
                  <>
                    <div className="hl-fieldgroup">
                      <label>Nombre</label>
                      <div className="hl-input">
                        <input type="text" value={nombreDestinatario} onChange={(e) => setNombreDestinatario(e.target.value)} disabled={isPending} />
                      </div>
                    </div>
                    <div className="hl-fieldgroup">
                      <label>Correo electrónico</label>
                      <div className="hl-input">
                        <input type="email" value={emailDestinatario} onChange={(e) => setEmailDestinatario(e.target.value)} disabled={isPending} />
                      </div>
                    </div>
                    <div className="hl-fieldgroup">
                      <label>Teléfono</label>
                      <div className="hl-input">
                        <input type="tel" value={telefonoDestinatario} onChange={(e) => setTelefonoDestinatario(e.target.value)} disabled={isPending} />
                      </div>
                    </div>
                    <div className="hl-fieldgroup">
                      <label>Identificación</label>
                      <div className="hl-input">
                        <input type="text" value={identificacionDestinatario} onChange={(e) => setIdentificacionDestinatario(e.target.value)} disabled={isPending} />
                      </div>
                    </div>
                  </>
                )}

                {/* Comuna */}
                <div className="hl-fieldgroup">
                  <label>
                    Comuna{requiereSeleccionManualComuna && <span className="req"> *</span>}
                  </label>
                  {selectedIdPaciente && !comunaPacienteSinMatch ? (
                    <div className="hl-input" style={{ color: comunaPaciente ? 'var(--color-fg)' : 'var(--color-fg-muted)' }}>
                      <MapPin className="hl-affix" />
                      <span style={{ flex: 1 }}>{comunaPaciente ?? 'Sin comuna registrada'}</span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>desde paciente</span>
                    </div>
                  ) : (
                    <>
                      <SelectCombobox
                        mode="single"
                        placeholder="Buscar comuna…"
                        options={comunasOptions}
                        selected={selectedIdComuna}
                        onChange={setSelectedIdComuna}
                        disabled={isPending}
                      />
                      {comunaPacienteSinMatch && (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>
                          {comunaPaciente
                            ? `La comuna "${comunaPaciente}" del paciente no está en el catálogo — selecciona una comuna del catálogo o agrégala en Comunas.`
                            : 'El paciente no tiene comuna registrada — selecciona una comuna del catálogo.'}
                        </span>
                      )}
                    </>
                  )}
                </div>
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
              {(totalProcedimientos + totalExamenes + totalTalleres) > 0 && (
                <span style={{ fontSize: 'var(--text-base)', color: 'var(--color-fg-muted)', flexShrink: 0 }}>
                  Subtotal{' '}
                  <span className="hl-tnum" style={{ fontWeight: 600, color: 'var(--color-fg)' }}>
                    {CLP(totalProcedimientos + totalExamenes + totalTalleres)}
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
                        setProcedureDiscountMap((prev) => {
                          const next = { ...prev }
                          for (const key of Object.keys(next)) {
                            if (!ids.includes(Number(key))) delete next[Number(key)]
                          }
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
                        const descuento = Math.min(parseInt(procedureDiscountMap[id] ?? '0') || 0, proc.precio)
                        return (
                          <ServiceItem
                            key={id}
                            codigo={proc.codigo}
                            nombre={proc.nombre}
                            price={<>{descuento > 0 && <s>{CLP(proc.precio)}</s>}{CLP(proc.precio - descuento)}</>}
                            onRemove={() => setSelectedProcedures((prev) => prev.filter((x) => x !== id))}
                          >
                            <DiscountInput
                              value={procedureDiscountMap[id] ?? '0'}
                              max={proc.precio}
                              onChange={(v) => setProcedureDiscountMap((prev) => ({ ...prev, [id]: v }))}
                              disabled={isPending}
                            />
                          </ServiceItem>
                        )
                      })}
                    </ServiceItems>
                  )}
                  {montoDescuentoProcedimientos > 0 && (
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
                          for (const id of ids) {
                            if (!(id in next)) next[id] = '0'
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

          {/* Cargos adicionales — visita + recargo side by side */}
          <section className="fcard">
            <div className="fcard__head">
              <div><h2>Cargos adicionales</h2><p>Visita a domicilio, recargos e insumos.</p></div>
            </div>
            <div className="fcard__body" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {/* Visita */}
              <div className="fpanel">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <Checkbox
                    id="cobraVisita"
                    checked={cobraVisita}
                    onCheckedChange={(checked) => setCobraVisita(checked as boolean)}
                    disabled={isPending}
                    className="mt-0.5"
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <label htmlFor="cobraVisita" style={{ cursor: 'pointer', fontSize: 'var(--text-base)', fontWeight: 500, lineHeight: 1.3 }}>
                        Cobrar visita de enfermería
                      </label>
                      {cobraVisita && precioVisita > 0 && (
                        <span className="hl-tnum" style={{ flexShrink: 0, fontSize: 'var(--text-base)', fontWeight: 600 }}>
                          {montoDescuento > 0 && (
                            <span style={{ marginRight: 6, fontWeight: 400, textDecoration: 'line-through', color: 'var(--color-fg-muted)' }}>
                              {CLP(precioVisita)}
                            </span>
                          )}
                          {CLP(precioVisitaNeto)}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>
                      {comunaNombre
                        ? <>Precio según <span style={{ fontWeight: 500, color: 'var(--color-fg)' }}>{comunaNombre}</span></>
                        : 'Selecciona una comuna para ver el precio'
                      }
                    </p>
                  </div>
                </div>

                {cobraVisita && (
                  <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <Checkbox
                        id="aplicaDescuento"
                        checked={aplicaDescuento}
                        onCheckedChange={(checked) => setAplicaDescuento(checked === true)}
                        disabled={isPending}
                        className="mt-0.5"
                      />
                      <label htmlFor="aplicaDescuento" style={{ cursor: 'pointer', fontSize: 'var(--text-base)', fontWeight: 500, lineHeight: 1.3 }}>
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
                            disabled={isPending}
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
                          <label htmlFor="descuentoAfectaPagoEnfermera" style={{ cursor: 'pointer', fontSize: 'var(--text-sm)', lineHeight: 1.4, color: 'var(--color-fg-muted)' }}>
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
                <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>Recargos</span>
                  {totalRecargos > 0 && (
                    <span className="hl-tnum" style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>{CLP(totalRecargos)}</span>
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
                  <div className="mt-2">
                    <ServiceItems>
                      {selectedSurcharges.map((id) => {
                        const tipo = tiposRecargos.find((t) => t.id === id)
                        if (!tipo) return null
                        const precio = cotizacion?.surchargePrices?.find((s) => s.idTipoRecargo === id)?.precio ?? tipo.precio
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
                <div className="hl-input" style={{ maxWidth: 200 }}>
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
          </section>

          {/* Notas */}
          <section className="fcard">
            <div className="fcard__head">
              <div><h2>Notas</h2><p>Visible para el destinatario en el documento impreso.</p></div>
            </div>
            <div className="fcard__body">
              <div className="hl-input" style={{ height: 'auto', padding: '10px 12px', alignItems: 'flex-start' }}>
                <textarea
                  name="notas"
                  rows={3}
                  className="w-full resize-none"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Notas adicionales para el destinatario…"
                  disabled={isPending}
                />
              </div>
            </div>
          </section>
        </div>

        {/* ── RIGHT — sticky summary rail ── */}
        <aside className="hl-rail" style={{ position: 'sticky', top: 76 }}>
          <div className="hl-rail__card">
            {/* Header */}
            <div className="hl-rail__head">
              <h3>Resumen</h3>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>en vivo</span>
            </div>
            <div style={{ padding: '0 18px 14px' }}>
              {pacienteSeleccionado ? (
                <>
                  <p style={{ margin: 0, fontSize: 'var(--text-base)' }}>
                    Para <span style={{ fontWeight: 600 }}>{pacienteSeleccionado.nombres} {pacienteSeleccionado.apellidoPaterno}</span>
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>
                    {comunaNombre} · {selectedProcedures.length + totalExamCount + selectedTallers.length} servicios
                  </p>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--color-fg-muted)' }}>
                  {selectedProcedures.length + totalExamCount + selectedTallers.length === 0
                    ? 'Sin ítems aún'
                    : `${selectedProcedures.length + totalExamCount + selectedTallers.length} servicios seleccionados`
                  }
                </p>
              )}
            </div>

            {/* Line items */}
            <div className="hl-rail__body" style={{ borderTop: '1px solid var(--color-border)' }}>
              <SummaryGroup
                tone="blue"
                label="Procedimientos"
                items={[
                  ...selectedProcedures.map((id) => {
                    const p = procedimientos.find((x) => x.id === id)!
                    return { name: p.nombre, price: p.precio }
                  }),
                  ...(montoDescuentoProcedimientos > 0
                    ? [{ name: 'Descuento procedimientos', price: -montoDescuentoProcedimientos }]
                    : []),
                ]}
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
                  ...(montoDescuento > 0 ? [{ name: 'Descuento visita', price: -montoDescuento }] : []),
                  ...selectedSurcharges.map((id) => {
                    const tipo = tiposRecargos.find((t) => t.id === id)
                    const precio = cotizacion?.surchargePrices?.find((s) => s.idTipoRecargo === id)?.precio ?? tipo?.precio ?? 0
                    return { name: tipo?.label ?? '', price: precio }
                  }),
                  ...(montoInsumosNum > 0 ? [{ name: 'Insumos', price: montoInsumosNum }] : []),
                ]}
                subtotal={(cobraVisita ? precioVisitaNeto : 0) + totalRecargos + montoInsumosNum}
              />
            </div>

            {/* Total */}
            <div className="rail-total">
              <div className="rail-total__row">
                <span className="hl-label">Total</span>
                <b className="hl-tnum">{CLP(totalGeneral)}</b>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>
                IVA incluido · válido por 30 días
              </p>
            </div>
          </div>

          <p style={{ margin: '12px 8px 0', fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>
            <Sparkles style={{ display: 'inline', width: 12, height: 12, marginRight: 4, verticalAlign: '-1px' }} />
            Al crear se enviará por correo al destinatario.
          </p>
        </aside>
      </form>
    </>
  )
}
