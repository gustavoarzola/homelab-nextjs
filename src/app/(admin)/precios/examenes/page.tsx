import { PreciosExamenesTable } from '@/components/precios-examenes-table'
import {
  searchPreciosExamenes,
  createPrecioExamen,
  updatePrecioExamen,
  togglePrecioExamen,
  getExamenesForSelect,
} from '@/lib/actions/precios'

export default async function PreciosExamenesPage() {
  const [initialData, examenes] = await Promise.all([
    searchPreciosExamenes({ filters: {}, sort: null, page: 1, pageSize: 100 }),
    getExamenesForSelect(),
  ])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Precios de exámenes
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Precios por examen, tipo de previsión y comuna
        </p>
      </div>
      <PreciosExamenesTable
        initialRows={initialData.rows}
        examenes={examenes}
        onCreate={createPrecioExamen}
        onUpdate={updatePrecioExamen}
        onToggle={togglePrecioExamen}
        search={searchPreciosExamenes}
      />
    </div>
  )
}
