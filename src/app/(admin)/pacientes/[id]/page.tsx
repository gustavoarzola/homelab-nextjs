import { notFound } from 'next/navigation'
import { getPaciente } from '@/lib/actions/pacientes'
import { PacienteForm } from '@/components/paciente-form'
import { searchPrevisiones, searchResidencias } from '@/lib/actions/catalogos'
import { getSignedUrl } from '@/lib/r2'

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

  const signedUrlIdentificacion = paciente.keyIdentificacion
    ? await getSignedUrl(paciente.keyIdentificacion)
    : null

  return (
    <PacienteForm
      paciente={paciente}
      previsiones={previsiones}
      residencias={residencias}
      signedUrlIdentificacion={signedUrlIdentificacion}
    />
  )
}
