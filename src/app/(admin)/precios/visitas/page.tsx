import { PreciosVisitasTable } from '@/components/precios-visitas-table'
import {
  searchPreciosVisita,
  createPrecioVisita,
  updatePrecioVisita,
  togglePrecioVisita,
} from '@/lib/actions/precios'
import { getComunasForSelect } from '@/lib/actions/catalogos'
import { PageHeader } from '@/components/page-header'

export default async function PreciosVisitasPage() {
  const [initialData, comunas] = await Promise.all([
    searchPreciosVisita({ filters: {}, sort: null, page: 1, pageSize: 100 }),
    getComunasForSelect(),
  ])

  return (
    <>
      <PageHeader title="Precios de visita de enfermería" meta="Precio de visita según comuna del paciente" />
      <PreciosVisitasTable
        initialRows={initialData.rows}
        comunas={comunas}
        onCreate={createPrecioVisita}
        onUpdate={updatePrecioVisita}
        onToggle={togglePrecioVisita}
        search={searchPreciosVisita}
      />
    </>
  )
}
