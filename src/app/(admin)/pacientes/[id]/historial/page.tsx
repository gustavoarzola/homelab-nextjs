import { redirect } from 'next/navigation'
import { getHistorialPaciente } from '@/lib/actions/pacientes'
import { HistorialPaciente } from '@/components/historial-paciente'

export default async function HistorialPacientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getHistorialPaciente(Number(id))

  if (!data) redirect('/pacientes')

  return <HistorialPaciente data={data} />
}
