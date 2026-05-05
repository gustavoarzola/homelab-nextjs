import { PrevisionesTable } from '@/components/previsiones-table'
import {
  searchPrevisiones,
  createPrevision,
  updatePrevision,
  togglePrevision,
  getPrevisionCategorias,
} from '@/lib/actions/catalogos'

export default async function PrevisionesPage() {
  const [initialData, categorias] = await Promise.all([
    searchPrevisiones({ filters: {}, sort: null, page: 1, pageSize: 10 }),
    getPrevisionCategorias(),
  ])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Previsiones de Salud</h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Compañías e instituciones de salud previsional</p>
      </div>
      <PrevisionesTable
        initialData={initialData}
        categorias={categorias}
        search={searchPrevisiones}
        onCreate={createPrevision}
        onUpdate={updatePrevision}
        onToggle={togglePrevision}
      />
    </div>
  )
}
