import { ProcedimientosTable } from '@/components/procedimientos-table'
import { searchProcedimientos, createProcedimiento, updateProcedimiento, toggleProcedimiento } from '@/lib/actions/catalogos'

export default async function ProcedimientosPage() {
  const initialData = await searchProcedimientos({ filters: {}, sort: null, page: 1, pageSize: 10 })

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Procedimientos</h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Catálogo de procedimientos de enfermería</p>
      </div>
      <ProcedimientosTable
        initialData={initialData}
        search={searchProcedimientos}
        onCreate={createProcedimiento}
        onUpdate={updateProcedimiento}
        onToggle={toggleProcedimiento}
      />
    </div>
  )
}
