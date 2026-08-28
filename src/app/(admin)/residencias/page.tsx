import { ResidenciasTable } from '@/components/residencias-table'
import { searchResidencias, createResidencia, updateResidencia, toggleResidencia } from '@/lib/actions/catalogos'
import { PageHeader } from '@/components/page-header'

export default async function ResidenciasPage() {
  const initialData = await searchResidencias({ filters: {}, sort: null, page: 1, pageSize: 10 })

  return (
    <>
      <PageHeader title="Residencias de Adulto Mayor" meta="Establecimientos de residencia para adultos mayores" />
      <ResidenciasTable
        initialData={initialData}
        search={searchResidencias}
        onCreate={createResidencia}
        onUpdate={updateResidencia}
        onToggle={toggleResidencia}
      />
    </>
  )
}
