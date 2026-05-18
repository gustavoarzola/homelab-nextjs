'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, FileText, AlertCircle } from 'lucide-react'
import { SelectCombobox } from '@/components/select-combobox'
import { Checkbox } from '@/components/ui/checkbox'
import { formatNombre } from '@/lib/paciente'
import type { CotizacionDetalle } from '@/lib/actions/cotizaciones'

export type PacienteOption = {
  id: number
  nombres: string
  apellidoPaterno: string | null
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
  onSubmit: (fd: FormData) => Promise<{ success: true; id: number } | { success: false; error: string }>
  onConvertir?: () => Promise<any>
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

export function CotizacionForm({
  cotizacion,
  pacientes,
  procedimientos,
  examenes,
  tiposRecargos,
  onSubmit,
  onConvertir,
}: Props) {
  const router = useRouter()
  const isEdit = !!cotizacion
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // State
  const [selectedIdPaciente, setSelectedIdPaciente] = useState<number | null>(cotizacion?.idPaciente ?? null)
  const [nombreDestinatario, setNombreDestinatario] = useState(cotizacion?.nombreDestinatario ?? '')
  const [emailDestinatario, setEmailDestinatario] = useState(cotizacion?.emailDestinatario ?? '')
  const [telefonoDestinatario, setTelefonoDestinatario] = useState(cotizacion?.telefonoDestinatario ?? '')
  const [identificacionDestinatario, setIdentificacionDestinatario] = useState(cotizacion?.identificacionDestinatario ?? '')
  const [comuna, setComuna] = useState(cotizacion?.comuna ?? '')
  const [cobraVisita, setCobraVisita] = useState(cotizacion?.cobraVisita ?? false)
  const [montoRecargo, setMontoRecargo] = useState(String(cotizacion?.montoRecargo ?? 0))
  const [selectedIdTipoRecargo, setSelectedIdTipoRecargo] = useState<number | null>(cotizacion?.idTipoRecargo ?? null)
  const [notas, setNotas] = useState(cotizacion?.notas ?? '')
  const [selectedProcedures, setSelectedProcedures] = useState<number[]>(cotizacion?.procedureIds ?? [])
  const [selectedExams, setSelectedExams] = useState<number[]>(cotizacion?.examIds ?? [])

  // Auto-fill from patient
  const selectedPaciente = pacientes.find((p) => p.id === selectedIdPaciente)
  const showManualFields = !selectedIdPaciente

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    selectedProcedures.forEach((id) => fd.append('procedure_ids', String(id)))
    selectedExams.forEach((id) => fd.append('exam_ids', String(id)))
    fd.set('cobraVisita', String(cobraVisita))
    fd.set('montoRecargo', montoRecargo || '0')
    fd.set('idTipoRecargo', selectedIdTipoRecargo ? String(selectedIdTipoRecargo) : '')

    startTransition(async () => {
      const result = await onSubmit(fd)
      if (result.success) {
        router.push(`/cotizaciones/${result.id}`)
      } else {
        setError(result.error ?? 'Error desconocido')
      }
    })
  }

  // Calculate totals
  let totalProcedures = 0
  let totalExams = 0
  let totalVisita = 0

  selectedProcedures.forEach((id) => {
    const proc = procedimientos.find((p) => p.id === id)
    if (proc) totalProcedures += proc.precio
  })

  selectedExams.forEach((id) => {
    const exam = examenes.find((e) => e.id === id)
    if (exam) totalExams += exam.precio
  })

  // TODO: Calculate visit price from comuna
  const total = totalProcedures + totalExams + totalVisita + (parseInt(montoRecargo) || 0)

  const procedimientosOptions = procedimientos.map((p) => ({ id: p.id, label: `${p.nombre} ($${p.precio.toLocaleString('es-CL')})` }))
  const examenesOptions = examenes.map((e) => ({ id: e.id, label: `${e.nombre} ($${e.precio.toLocaleString('es-CL')})` }))
  const pacientesOptions = pacientes.map((p) => ({ id: p.id, label: formatNombre(p) }))
  const tipoRecargosOptions = tiposRecargos.map((t) => ({ id: t.id, label: t.label }))

  return (
    <>
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between border-b px-8 py-3"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          {isEdit ? 'Editar cotización' : 'Nueva cotización'}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg px-4 py-2 text-sm transition-opacity hover:opacity-80"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Cancelar
          </button>
          {isEdit && cotizacion?.estado === 'borrador' && (
            <button
              type="button"
              onClick={() => {
                startTransition(async () => {
                  if (onConvertir) {
                    await onConvertir()
                  }
                })
              }}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ color: 'var(--foreground)', borderColor: 'var(--border)' }}
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Crear visita
            </button>
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
          className="mx-8 mt-4 flex gap-2 rounded-lg px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--destructive)', color: 'white' }}
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <form id="cotizacion-form" onSubmit={handleSubmit} className="flex flex-col gap-6 p-8">
        {isEdit && <input type="hidden" name="id" value={cotizacion?.id} />}

        {/* Paciente / Destinatario */}
        <section className={sectionClass} style={sectionStyle}>
          <div className="p-6">
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>Destinatario</h2>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass} style={labelStyle}>
                  Paciente (opcional)
                </label>
                <SelectCombobox
                  mode="single"
                  placeholder="Seleccionar paciente"
                  options={pacientesOptions}
                  selected={selectedIdPaciente}
                  onChange={(value) => {
                    setSelectedIdPaciente(value)
                    // Clear manual fields when patient is selected
                    if (value) {
                      setNombreDestinatario('')
                      setEmailDestinatario('')
                      setTelefonoDestinatario('')
                      setIdentificacionDestinatario('')
                    }
                  }}
                  disabled={isPending}
                />
              </div>

              {showManualFields && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label className={labelClass} style={labelStyle}>
                        Nombre del destinatario
                      </label>
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
                      <label className={labelClass} style={labelStyle}>
                        Correo electrónico
                      </label>
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
                      <label className={labelClass} style={labelStyle}>
                        Teléfono
                      </label>
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
                      <label className={labelClass} style={labelStyle}>
                        Identificación
                      </label>
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
                </>
              )}

              <div className="flex flex-col gap-1.5">
                <label className={labelClass} style={labelStyle}>
                  Comuna <span style={{ color: 'var(--destructive)' }}>*</span>
                </label>
                <input
                  type="text"
                  name="comuna"
                  className={inputClass}
                  style={inputStyle}
                  value={comuna}
                  onChange={(e) => setComuna(e.target.value)}
                  placeholder="Ej: Santiago, La Florida"
                  disabled={isPending}
                  required
                />
              </div>
            </div>
          </div>
        </section>

        {/* Procedimientos y Exámenes */}
        <section className={sectionClass} style={sectionStyle}>
          <div className="p-6">
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>Procedimientos y Exámenes</h2>

            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass} style={labelStyle}>
                  Procedimientos
                </label>
                <SelectCombobox
                  mode="multi"
                  placeholder="Seleccionar procedimientos"
                  options={procedimientosOptions}
                  selected={selectedProcedures}
                  onChange={setSelectedProcedures}
                  disabled={isPending}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelClass} style={labelStyle}>
                  Exámenes
                </label>
                <SelectCombobox
                  mode="multi"
                  placeholder="Seleccionar exámenes"
                  options={examenesOptions}
                  selected={selectedExams}
                  onChange={setSelectedExams}
                  disabled={isPending}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Costo de visita y Recargo */}
        <section className={sectionClass} style={sectionStyle}>
          <div className="p-6">
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>Costos Adicionales</h2>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={cobraVisita}
                  onCheckedChange={(checked) => setCobraVisita(checked as boolean)}
                  disabled={isPending}
                />
                <label className={labelClass} style={labelStyle}>
                  Cobrar visita de enfermería
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass} style={labelStyle}>
                    Monto recargo
                  </label>
                  <input
                    type="number"
                    className={inputClass}
                    style={inputStyle}
                    value={montoRecargo}
                    onChange={(e) => setMontoRecargo(e.target.value)}
                    disabled={isPending}
                    min="0"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelClass} style={labelStyle}>
                    Tipo de recargo
                  </label>
                  <SelectCombobox
                    mode="single"
                    placeholder="Seleccionar tipo"
                    options={tipoRecargosOptions}
                    selected={selectedIdTipoRecargo}
                    onChange={setSelectedIdTipoRecargo}
                    disabled={isPending || parseInt(montoRecargo) === 0}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Notas */}
        <section className={sectionClass} style={sectionStyle}>
          <div className="p-6">
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>Notas</h2>
            <textarea
              name="notas"
              className={`w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50 min-h-24`}
              style={inputStyle}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Notas adicionales"
              disabled={isPending}
            />
          </div>
        </section>

        {/* Resumen de Costos */}
        <section className={sectionClass} style={sectionStyle}>
          <div className="p-6">
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>Resumen</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: 'var(--muted-foreground)' }}>Procedimientos</span>
                <span>${totalProcedures.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--muted-foreground)' }}>Exámenes</span>
                <span>${totalExams.toLocaleString('es-CL')}</span>
              </div>
              {cobraVisita && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--muted-foreground)' }}>Visita de enfermería</span>
                  <span>${totalVisita.toLocaleString('es-CL')}</span>
                </div>
              )}
              {parseInt(montoRecargo) > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--muted-foreground)' }}>Recargo</span>
                  <span>${parseInt(montoRecargo).toLocaleString('es-CL')}</span>
                </div>
              )}
              <div
                className="flex justify-between border-t pt-2 font-semibold"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                <span>Total</span>
                <span>${total.toLocaleString('es-CL')}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Hidden inputs for form submission */}
        <input type="hidden" name="idPaciente" value={selectedIdPaciente || ''} />
        <input type="hidden" name="nombreDestinatario" value={nombreDestinatario} />
        <input type="hidden" name="emailDestinatario" value={emailDestinatario} />
        <input type="hidden" name="telefonoDestinatario" value={telefonoDestinatario} />
        <input type="hidden" name="identificacionDestinatario" value={identificacionDestinatario} />
      </form>
    </>
  )
}
