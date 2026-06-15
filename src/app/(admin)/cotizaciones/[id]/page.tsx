import { notFound } from 'next/navigation'
import {
  getCotizacionVista,
  marcarEnviada,
  aceptarCotizacion,
  rechazarCotizacion,
} from '@/lib/actions/cotizaciones'
import { getPacientes } from '@/lib/actions/pacientes'
import { CotizacionLifecycleView } from '@/components/cotizacion-lifecycle-view'
import { formatNombre } from '@/lib/paciente'

export default async function CotizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params
  const id = Number(idStr)
  if (isNaN(id)) return notFound()

  const [cotizacion, pacientes] = await Promise.all([
    getCotizacionVista(id),
    getPacientes(),
  ])

  if (!cotizacion) return notFound()

  const pacientesOpciones = pacientes.map((p) => ({
    id: p.id,
    label: formatNombre({ nombres: p.nombres, apellidoPaterno: p.apellidoPaterno, apellidoMaterno: p.apellidoMaterno }),
  }))

  async function handleMarcarEnviada(): Promise<{ success: boolean; error?: string }> {
    'use server'
    return marcarEnviada(id)
  }

  async function handleAceptar(idPaciente?: number): Promise<{ success: boolean; idVisita?: number; error?: string }> {
    'use server'
    const result = await aceptarCotizacion(id, idPaciente)
    if (!result.success) return result
    return { success: true, idVisita: result.data.idVisita }
  }

  async function handleRechazar(motivo: string): Promise<{ success: boolean; error?: string }> {
    'use server'
    return rechazarCotizacion(id, motivo)
  }

  return (
    <CotizacionLifecycleView
      cotizacion={cotizacion}
      pacientes={pacientesOpciones}
      onMarcarEnviada={handleMarcarEnviada}
      onAceptar={handleAceptar}
      onRechazar={handleRechazar}
    />
  )
}
