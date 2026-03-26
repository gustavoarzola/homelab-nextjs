import { notFound } from 'next/navigation'
import { getPaciente } from '@/lib/actions/pacientes'
import { PacienteForm } from '@/components/paciente-form'
import { searchPrevisiones, searchResidencias } from '@/lib/actions/catalogos'

export default async function EditarPacientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [paciente, { rows: previsiones }, { rows: residencias }] = await Promise.all([
    getPaciente(Number(id)),
    searchPrevisiones({ filters: {}, sort: null, page: 1, pageSize: 1000 }),
    searchResidencias({ filters: {}, sort: null, page: 1, pageSize: 1000 }),
  ])
  if (!paciente) notFound()
  return <PacienteForm paciente={paciente} previsiones={previsiones} residencias={residencias} />
}
