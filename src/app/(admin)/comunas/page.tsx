import { ComunasTable } from '@/components/comunas-table'
import { searchComunas, createComuna, updateComuna, toggleComuna } from '@/lib/actions/catalogos'
import { PageHeader } from '@/components/page-header'

export default async function ComunasPage() {
  const initialData = await searchComunas({ filters: {}, sort: null, page: 1, pageSize: 10 })

  return (
    <>
      <PageHeader title="Comunas" meta="Catálogo de comunas usado en enfermeras, precios de visita y cotizaciones" />
      <ComunasTable
        initialData={initialData}
        search={searchComunas}
        onCreate={createComuna}
        onUpdate={updateComuna}
        onToggle={toggleComuna}
      />
    </>
  )
}
