import { CotizacionesTable } from '@/components/cotizaciones-table'
import { searchCotizaciones } from '@/lib/actions/cotizaciones'
import { PageHeader } from '@/components/page-header'

export default async function CotizacionesPage() {
  const initialData = await searchCotizaciones({ filters: {}, sort: null, page: 1, pageSize: 10 })

  return (
    <>
      <PageHeader title="Cotizaciones" meta="Cotizaciones independientes de enfermería" />
      <CotizacionesTable
        initialData={initialData}
        search={searchCotizaciones}
      />
    </>
  )
}
