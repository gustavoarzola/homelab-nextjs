import { searchVisitas, deleteVisita, getEnfermeras } from '@/lib/actions/visitas'
import { VisitasTable } from '@/components/visitas-table'

export default async function VisitasPage() {
  const [initialData, enfermeras] = await Promise.all([
    searchVisitas({ filters: {}, sort: null, page: 1, pageSize: 10 }),
    getEnfermeras(),
  ])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Visitas</h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Gestión de visitas domiciliarias
        </p>
      </div>
      <VisitasTable
        initialData={initialData}
        search={searchVisitas}
        onDelete={deleteVisita}
        enfermeras={enfermeras}
      />
    </div>
  )
}
