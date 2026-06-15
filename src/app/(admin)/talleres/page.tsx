import { TalleresTable } from '@/components/talleres-table'
import { searchTalleres, createTaller, updateTaller, toggleTaller } from '@/lib/actions/catalogos'

export default async function TalleresPage() {
  const initialData = await searchTalleres({ filters: {}, sort: null, page: 1, pageSize: 10 })

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Talleres</h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Catálogo de talleres</p>
      </div>
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
