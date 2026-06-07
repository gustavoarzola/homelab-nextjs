import { notFound } from 'next/navigation'
import { getResultadosVisita, guardarResultadosVisita } from '@/lib/actions/resultados'
import { getVisita } from '@/lib/actions/visitas'
import { getPaciente } from '@/lib/actions/pacientes'
import { formatNombre } from '@/lib/paciente'
import { VisitaResultados } from '@/components/visita-resultados'

export default async function ResultadosVisitaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const idVisita = Number(id)
  if (!idVisita) notFound()

  const [resultados, visita] = await Promise.all([
    getResultadosVisita(idVisita),
    getVisita(idVisita),
  ])

  if (!resultados || !visita || !visita.idPaciente) notFound()

  const paciente = await getPaciente(visita.idPaciente)
  if (!paciente) notFound()

  const pacienteNombre = formatNombre({
    nombres: paciente.nombres,
    apellidoPaterno: paciente.apellidoPaterno,
    apellidoMaterno: paciente.apellidoMaterno ?? null,
  })

  return (
    <VisitaResultados
      idVisita={idVisita}
      pacienteNombre={pacienteNombre || `Paciente #${visita.idPaciente}`}
      visitaFecha={visita.fecha}
      initialResultados={resultados}
      onSave={guardarResultadosVisita}
    />
  )
}
