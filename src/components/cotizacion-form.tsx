'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { SelectCombobox } from '@/components/select-combobox'
import { Checkbox } from '@/components/ui/checkbox'
import { formatNombre } from '@/lib/paciente'
import { COMUNAS_OPTIONS, COMUNAS_RM } from '@/lib/comunas'
import type { CotizacionDetalle } from '@/lib/actions/cotizaciones'

export type PacienteOption = {
  id: number
  nombres: string
  apellidoPaterno: string | null
  apellidoMaterno?: string | null
}

type ProcedimientoOption = {
  id: number
  nombre: string
  codigo: string
  precio: number
}

type ExamenOption = {
  id: number
  nombre: string
  codigo: string
  grupoExamen: string
  precio: number
}

type Props = {
  cotizacion?: CotizacionDetalle
  pacientes: PacienteOption[]
  procedimientos: ProcedimientoOption[]
  examenes: ExamenOption[]
  tiposRecargos: { id: number; label: string }[]
  // Map of { [comunaNombre]: precio } for nursing visit price lookup
  preciosVisita: Record<string, number>
  onSubmit: (fd: FormData) => Promise<{ success: true; id: number } | { success: false; error: string }>
  onConvertir?: () => Promise<{ success: true; idVisita: number } | { success: false; error: string }>
}

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

// Get commune name from COMUNAS_OPTIONS index
function comunaFromIdx(idx: number | null): string | null {
  if (idx === null || idx < 0) return null
  return COMUNAS_RM[idx] ?? null
}

// Get COMUNAS_OPTIONS index from commune name
function idxFromComuna(nombre: string | null): number | null {
  if (!nombre) return null
  const idx = COMUNAS_RM.indexOf(nombre)
  return idx >= 0 ? idx : null
}

export function CotizacionForm({
  cotizacion,
  pacientes,
  procedimientos,
  examenes,
  tiposRecargos,
  preciosVisita,
  onSubmit,
  onConvertir,
}: Props) {
  const router = useRouter()
  const isEdit = !!cotizacion
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Destinatario
  const [selectedIdPaciente, setSelectedIdPaciente] = useState<number | null>(cotizacion?.idPaciente ?? null)
  const [nombreDestinatario, setNombreDestinatario] = useState(cotizacion?.nombreDestinatario ?? '')
  const [emailDestinatario, setEmailDestinatario] = useState(cotizacion?.emailDestinatario ?? '')
  const [telefonoDestinatario, setTelefonoDestinatario] = useState(cotizacion?.telefonoDestinatario ?? '')
  const [identificacionDestinatario, setIdentificacionDestinatario] = useState(cotizacion?.identificacionDestinatario ?? '')

  // Comuna via SelectCombobox (index into COMUNAS_RM)
  const [selectedComunaIdx, setSelectedComunaIdx] = useState<number | null>(
    idxFromComuna(cotizacion?.comuna ?? null)
  )
  const comunaNombre = comunaFromIdx(selectedComunaIdx)

  // Items
  const [selectedProcedures, setSelectedProcedures] = useState<number[]>(cotizacion?.procedureIds ?? [])
  const [selectedExams, setSelectedExams] = useState<number[]>(cotizacion?.examIds ?? [])

  // Costos adicionales
  const [cobraVisita, setCobraVisita] = useState(cotizacion?.cobraVisita ?? false)
  const [montoRecargo, setMontoRecargo] = useState(String(cotizacion?.montoRecargo ?? 0))
  const [selectedIdTipoRecargo, setSelectedIdTipoRecargo] = useState<number | null>(cotizacion?.idTipoRecargo ?? null)
  const [notas, setNotas] = useState(cotizacion?.notas ?? '')

  const showManualFields = !selectedIdPaciente

  // Precio de visita calculado desde el mapa de precios
  const precioVisita = useMemo(() => {
    if (!cobraVisita) return 0
    if (!comunaNombre) return preciosVisita['__base__'] ?? 0
    return preciosVisita[comunaNombre] ?? preciosVisita['__base__'] ?? 0
  }, [cobraVisita, comunaNombre, preciosVisita])

  // Resumen de costos
  const totalProcedimientos = useMemo(() =>
    selectedProcedures.reduce((sum, id) => sum + (procedimientos.find((p) => p.id === id)?.precio ?? 0), 0),
    [selectedProcedures, procedimientos]
  )
  const totalExamenes = useMemo(() =>
    selectedExams.reduce((sum, id) => sum + (examenes.find((e) => e.id === id)?.precio ?? 0), 0),
    [selectedExams, examenes]
  )
  const totalRecargo = parseInt(montoRecargo) || 0
  const totalGeneral = totalProcedimientos + totalExamenes + precioVisita + totalRecargo

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!comunaNombre) {
      setError('Debe seleccionar una comuna')
      return
    }

    const fd = new FormData(e.currentTarget)
    // Override with controlled values
    fd.set('comuna', comunaNombre)
    fd.set('cobraVisita', String(cobraVisita))
    fd.set('montoRecargo', montoRecargo || '0')
    fd.set('idTipoRecargo', selectedIdTipoRecargo ? String(selectedIdTipoRecargo) : '')
    fd.set('idPaciente', selectedIdPaciente ? String(selectedIdPaciente) : '')
    fd.set('nombreDestinatario', nombreDestinatario)
    fd.set('emailDestinatario', emailDestinatario)
    fd.set('telefonoDestinatario', telefonoDestinatario)
    fd.set('identificacionDestinatario', identificacionDestinatario)
    selectedProcedures.forEach((id) => fd.append('procedure_ids', String(id)))
    selectedExams.forEach((id) => fd.append('exam_ids', String(id)))

    startTransition(async () => {
      const result = await onSubmit(fd)
      if (result.success) {
        if (!isEdit) {
          router.push(`/cotizaciones/${result.id}`)
        }
      } else {
        setError(result.error ?? 'Error desconocido')
      }
    })
  }

  const handleConvertir = () => {
    if (!onConvertir) return
    startTransition(async () => {
      const result = await onConvertir()
      if (!result.success) {
        setError(result.error ?? 'Error al convertir')
      }
    })
  }

  const procedimientosOptions = procedimientos.map((p) => ({
    id: p.id,
    label: `${p.nombre} — $${p.precio.toLocaleString('es-CL')}`,
  }))
  const examenesOptions = examenes.map((e) => ({
    id: e.id,
    label: `${e.nombre} — $${e.precio.toLocaleString('es-CL')}`,
  }))
  const pacientesOptions = pacientes.map((p) => ({ id: p.id, label: formatNombre(p) }))
  const tipoRecargosOptions = tiposRecargos.map((t) => ({ id: t.id, label: t.label }))

  return (
    <>
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between border-b px-8 py-3"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          {isEdit ? `Cotización #${cotizacion!.id}` : 'Nueva cotización'}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push('/cotizaciones')}
            className="rounded-lg px-4 py-2 text-sm transition-opacity hover:opacity-80"
            style={{ color: 'var(--muted-foreground)' }}
            disabled={isPending}
          >
            Cancelar
          </button>
          {isEdit && cotizacion?.estado === 'borrador' && !cotizacion?.idVisita && (
            <button
              type="button"
              onClick={handleConvertir}
              disabled={isPending || !cotizacion?.idPaciente}
              title={!cotizacion?.idPaciente ? 'Requiere un paciente para convertir' : undefined}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ color: 'var(--foreground)', borderColor: 'var(--border)' }}
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Crear visita
            </button>
          )}
          {isEdit && cotizacion?.idVisita && (
            <a
              href={`/visitas/${cotizacion.idVisita}`}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ color: 'oklch(0.45 0.13 145)', borderColor: 'oklch(0.7 0.13 145 / 40%)' }}
            >
              Ver visita #{cotizacion.idVisita}
            </a>
          )}
          <button
            type="submit"
            form="cotizacion-form"
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? 'Guardar cambios' : 'Crear cotización'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="mx-8 mt-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--destructive)', color: 'white' }}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <form id="cotizacion-form" onSubmit={handleSubmit} className="flex flex-col gap-6 p-8">
        {isEdit && <input type="hidden" name="id" value={cotizacion!.id} />}

        {/* ── Destinatario ── */}
        <section className={sectionClass} style={sectionStyle}>
          <div className="p-6">
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>Destinatario</h2>
            <div className="space-y-4">

              {/* Paciente selector */}
              <div className="flex flex-col gap-1.5">
                <label className={labelClass} style={labelStyle}>Paciente (opcional)</label>
                <SelectCombobox
                  mode="single"
                  placeholder="Buscar paciente…"
                  options={pacientesOptions}
                  selected={selectedIdPaciente}
                  onChange={(value) => {
                    setSelectedIdPaciente(value)
                    if (value) {
                      setNombreDestinatario('')
                      setEmailDestinatario('')
                      setTelefonoDestinatario('')
                      setIdentificacionDestinatario('')
                    }
                  }}
                  disabled={isPending}
                  clearable
                />
              </div>

              {/* Manual fields — only when no patient */}
              {showManualFields && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className={labelClass} style={labelStyle}>Nombre del destinatario</label>
                    <input
                      type="text"
                      className={inputClass}
                      style={inputStyle}
                      value={nombreDestinatario}
                      onChange={(e) => setNombreDestinatario(e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelClass} style={labelStyle}>Correo electrónico</label>
                    <input
                      type="email"
                      className={inputClass}
                      style={inputStyle}
                      value={emailDestinatario}
                      onChange={(e) => setEmailDestinatario(e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelClass} style={labelStyle}>Teléfono</label>
                    <input
                      type="tel"
                      className={inputClass}
                      style={inputStyle}
                      value={telefonoDestinatario}
                      onChange={(e) => setTelefonoDestinatario(e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={labelClass} style={labelStyle}>Identificación</label>
                    <input
                      type="text"
                      className={inputClass}
                      style={inputStyle}
                      value={identificacionDestinatario}
                      onChange={(e) => setIdentificacionDestinatario(e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                </div>
              )}

              {/* Comuna via autocomplete combobox */}
              <div className="flex flex-col gap-1.5">
                <label className={labelClass} style={labelStyle}>
                  Comuna <span style={{ color: 'var(--destructive)' }}>*</span>
                </label>
                <SelectCombobox
                  mode="single"
                  placeholder="Buscar comuna…"
                  options={COMUNAS_OPTIONS}
                  selected={selectedComunaIdx}
                  onChange={setSelectedComunaIdx}
                  disabled={isPending}
                />
                {!comunaNombre && (
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Requerida para calcular el precio de visita
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Procedimientos y Exámenes ── */}
        <section className={sectionClass} style={sectionStyle}>
          <div className="p-6">
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>Procedimientos y Exámenes</h2>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass} style={labelStyle}>Procedimientos</label>
                <SelectCombobox
                  mode="multi"
                  placeholder="Seleccionar procedimientos…"
                  options={procedimientosOptions}
                  selected={selectedProcedures}
                  onChange={setSelectedProcedures}
                  disabled={isPending}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass} style={labelStyle}>Exámenes</label>
                <SelectCombobox
                  mode="multi"
                  placeholder="Seleccionar exámenes…"
                  options={examenesOptions}
                  selected={selectedExams}
                  onChange={setSelectedExams}
                  disabled={isPending}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Costos adicionales ── */}
        <section className={sectionClass} style={sectionStyle}>
          <div className="p-6">
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>Costos adicionales</h2>
            <div className="space-y-4">

              {/* Cobrar visita */}
              <div className="flex items-center gap-3">
                <Checkbox
                  id="cobraVisita"
                  checked={cobraVisita}
                  onCheckedChange={(checked) => setCobraVisita(checked as boolean)}
                  disabled={isPending}
                />
                <label htmlFor="cobraVisita" className="cursor-pointer text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  Cobrar visita de enfermería
                  {cobraVisita && comunaNombre && (
                    <span className="ml-2 font-normal" style={{ color: 'var(--muted-foreground)' }}>
                      — ${precioVisita.toLocaleString('es-CL')} ({comunaNombre})
                    </span>
                  )}
                  {cobraVisita && !comunaNombre && (
                    <span className="ml-2 font-normal" style={{ color: 'oklch(0.6 0.12 50)' }}>
                      — selecciona una comuna para ver el precio
                    </span>
                  )}
                </label>
              </div>

              {/* Recargo */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass} style={labelStyle}>Monto recargo</label>
                  <input
                    type="number"
                    className={inputClass}
                    style={inputStyle}
                    value={montoRecargo}
                    onChange={(e) => {
                      setMontoRecargo(e.target.value)
                      if (!e.target.value || parseInt(e.target.value) === 0) {
                        setSelectedIdTipoRecargo(null)
                      }
                    }}
                    disabled={isPending}
                    min="0"
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass} style={labelStyle}>Tipo de recargo</label>
                  <SelectCombobox
                    mode="single"
                    placeholder="Seleccionar tipo…"
                    options={tipoRecargosOptions}
                    selected={selectedIdTipoRecargo}
                    onChange={setSelectedIdTipoRecargo}
                    disabled={isPending || !parseInt(montoRecargo)}
                    clearable
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Notas ── */}
        <section className={sectionClass} style={sectionStyle}>
          <div className="p-6">
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>Notas</h2>
            <textarea
              name="notas"
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50 resize-none"
              style={inputStyle}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas adicionales para el destinatario…"
              disabled={isPending}
            />
          </div>
        </section>

        {/* ── Resumen ── */}
        <section className={sectionClass} style={sectionStyle}>
          <div className="p-6">
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>Resumen</h2>
            <div className="space-y-2 text-sm max-w-xs">
              {totalProcedimientos > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--muted-foreground)' }}>Procedimientos</span>
                  <span className="tabular-nums">${totalProcedimientos.toLocaleString('es-CL')}</span>
                </div>
              )}
              {totalExamenes > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--muted-foreground)' }}>Exámenes</span>
                  <span className="tabular-nums">${totalExamenes.toLocaleString('es-CL')}</span>
                </div>
              )}
              {cobraVisita && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--muted-foreground)' }}>
                    Visita{comunaNombre ? ` (${comunaNombre})` : ''}
                  </span>
                  <span className="tabular-nums">
                    {precioVisita > 0
                      ? `$${precioVisita.toLocaleString('es-CL')}`
                      : <span style={{ color: 'oklch(0.6 0.12 50)' }}>—</span>
                    }
                  </span>
                </div>
              )}
              {totalRecargo > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--muted-foreground)' }}>Recargo</span>
                  <span className="tabular-nums">${totalRecargo.toLocaleString('es-CL')}</span>
                </div>
              )}
              <div
                className="flex justify-between border-t pt-2 font-semibold"
                style={{ borderColor: 'var(--border)' }}
              >
                <span>Total</span>
                <span className="tabular-nums">${totalGeneral.toLocaleString('es-CL')}</span>
              </div>
            </div>
          </div>
        </section>
      </form>
    </>
  )
}
