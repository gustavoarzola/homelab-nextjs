import { PrevisionesTable } from '@/components/previsiones-table'
import {
  searchPrevisiones,
  createPrevision,
  updatePrevision,
  togglePrevision,
} from '@/lib/actions/catalogos'
import { PageHeader } from '@/components/page-header'

export default async function PrevisionesPage() {
  const initialData = await searchPrevisiones({ filters: {}, sort: null, page: 1, pageSize: 10 })

  return (
    <>
      <PageHeader title="Previsiones de Salud" meta="Compañías e instituciones de salud previsional" />
      <PrevisionesTable
        initialData={initialData}
        search={searchPrevisiones}
        onCreate={createPrevision}
        onUpdate={updatePrevision}
        onToggle={togglePrevision}
      />
    </>
  )
}
