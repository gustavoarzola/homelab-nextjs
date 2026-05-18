import { CotizacionesTable } from '@/components/cotizaciones-table'
import { searchCotizaciones } from '@/lib/actions/cotizaciones'

export default async function CotizacionesPage() {
  const initialData = await searchCotizaciones({ filters: {}, sort: null, page: 1, pageSize: 10 })

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Cotizaciones</h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Cotizaciones independientes de enfermería</p>
      </div>
      <CotizacionesTable
        initialData={initialData}
        search={searchCotizaciones}
      />
    </div>
  )
}
