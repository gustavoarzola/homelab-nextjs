import { ExamenesTable } from '@/components/examenes-table'
import { searchExamenes, createExamen, updateExamen, toggleExamen } from '@/lib/actions/catalogos'

export default async function ExamenesPage() {
  const initialData = await searchExamenes({ filters: {}, sort: null, page: 1, pageSize: 10 })

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Exámenes</h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Catálogo de exámenes médicos</p>
      </div>
      <ExamenesTable
        initialData={initialData}
        search={searchExamenes}
        onCreate={createExamen}
        onUpdate={updateExamen}
        onToggle={toggleExamen}
      />
    </div>
  )
}
