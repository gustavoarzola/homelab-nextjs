import { PreciosVisitasTable } from '@/components/precios-visitas-table'
import {
  searchPreciosVisita,
  createPrecioVisita,
  updatePrecioVisita,
  togglePrecioVisita,
} from '@/lib/actions/precios'

export default async function PreciosVisitasPage() {
  const initialData = await searchPreciosVisita({ filters: {}, sort: null, page: 1, pageSize: 100 })

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Precios de visita de enfermería
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Precio de visita según comuna del paciente
        </p>
      </div>
      <PreciosVisitasTable
        initialRows={initialData.rows}
        onCreate={createPrecioVisita}
        onUpdate={updatePrecioVisita}
        onToggle={togglePrecioVisita}
        search={searchPreciosVisita}
      />
    </div>
  )
}
