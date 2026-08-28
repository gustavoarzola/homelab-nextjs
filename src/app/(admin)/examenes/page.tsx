import { ExamenesTable } from '@/components/examenes-table'
import { searchExamenes, createExamen, updateExamen, toggleExamen } from '@/lib/actions/catalogos'
import { PageHeader } from '@/components/page-header'

export default async function ExamenesPage() {
  const initialData = await searchExamenes({ filters: {}, sort: null, page: 1, pageSize: 10 })

  return (
    <>
      <PageHeader title="Exámenes" meta="Catálogo de exámenes médicos" />
      <ExamenesTable
        initialData={initialData}
        search={searchExamenes}
        onCreate={createExamen}
        onUpdate={updateExamen}
        onToggle={toggleExamen}
      />
    </>
  )
}
