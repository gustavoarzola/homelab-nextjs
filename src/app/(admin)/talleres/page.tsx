import { TalleresTable } from '@/components/talleres-table'
import { searchTalleres, createTaller, updateTaller, toggleTaller } from '@/lib/actions/catalogos'
import { PageHeader } from '@/components/page-header'

export default async function TalleresPage() {
  const initialData = await searchTalleres({ filters: {}, sort: null, page: 1, pageSize: 10 })

  return (
    <>
      <PageHeader title="Talleres" meta="Catálogo de talleres" />
      <TalleresTable
        initialData={initialData}
        search={searchTalleres}
        onCreate={createTaller}
        onUpdate={updateTaller}
        onToggle={toggleTaller}
      />
    </>
  )
}
