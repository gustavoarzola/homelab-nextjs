import { PacienteForm } from '@/components/paciente-form'
import { searchPrevisiones, searchResidencias } from '@/lib/actions/catalogos'

export default async function NuevoPacientePage() {
  const [{ rows: previsiones }, { rows: residencias }] = await Promise.all([
    searchPrevisiones({ filters: {}, sort: null, page: 1, pageSize: 1000 }),
    searchResidencias({ filters: {}, sort: null, page: 1, pageSize: 1000 }),
  ])
  return <PacienteForm previsiones={previsiones} residencias={residencias} />
}
