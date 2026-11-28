import { GruposCostosTable } from '@/components/grupos-costos-table'
import { searchGruposCostos, createGrupoCosto, updateGrupoCosto, toggleGrupoCosto } from '@/lib/actions/catalogos'
import { PageHeader } from '@/components/page-header'

export default async function GruposCostosPage() {
  const initialData = await searchGruposCostos({ filters: {}, sort: null, page: 1, pageSize: 10 })

  return (
    <>
      <PageHeader
        title="Grupos de costos"
        meta="Bloques del Resumen del reporte financiero (p.ej. Facturas laboratorio, Gastos fijos). El orden define su posición."
      />
      <GruposCostosTable
        initialData={initialData}
        search={searchGruposCostos}
        onCreate={createGrupoCosto}
        onUpdate={updateGrupoCosto}
        onToggle={toggleGrupoCosto}
      />
    </>
  )
}
