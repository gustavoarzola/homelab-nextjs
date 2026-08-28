import { EnfermerasTable } from '@/components/enfermeras-table'
import {
  searchEnfermeras,
  createEnfermera,
  updateEnfermera,
  toggleEnfermera,
  deleteEnfermera,
} from '@/lib/actions/enfermeras'
import { getComunasForSelect } from '@/lib/actions/catalogos'
import { PageHeader } from '@/components/page-header'

export default async function EnfermerasPage() {
  const [initialData, comunas] = await Promise.all([
    searchEnfermeras({ filters: {}, sort: null, page: 1, pageSize: 10 }),
    getComunasForSelect(),
  ])

  return (
    <>
      <PageHeader title="Enfermeras" meta="Gestión del equipo de enfermería" />
      <EnfermerasTable
        initialData={initialData}
        comunas={comunas}
        search={searchEnfermeras}
        onCreate={createEnfermera}
        onUpdate={updateEnfermera}
        onToggle={toggleEnfermera}
        onDelete={deleteEnfermera}
      />
    </>
  )
}
