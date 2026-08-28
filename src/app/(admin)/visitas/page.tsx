import { searchVisitas, deleteVisita, getEnfermeras } from '@/lib/actions/visitas'
import { VisitasTable } from '@/components/visitas-table'
import { PageHeader } from '@/components/page-header'

export default async function VisitasPage() {
  const [initialData, enfermeras] = await Promise.all([
    searchVisitas({ filters: {}, sort: null, page: 1, pageSize: 10 }),
    getEnfermeras(),
  ])

  return (
    <>
      <PageHeader title="Visitas" meta="Gestión de visitas domiciliarias" />
      <VisitasTable
        initialData={initialData}
        search={searchVisitas}
        onDelete={deleteVisita}
        enfermeras={enfermeras}
      />
    </>
  )
}
