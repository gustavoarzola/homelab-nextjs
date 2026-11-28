import { GruposGastosTable } from '@/components/grupos-gastos-table'
import { searchGruposGastos, createGrupoGasto, updateGrupoGasto, toggleGrupoGasto } from '@/lib/actions/catalogos'
import { PageHeader } from '@/components/page-header'

export default async function GruposGastosPage() {
  const initialData = await searchGruposGastos({ filters: {}, sort: null, page: 1, pageSize: 10 })

  return (
    <>
      <PageHeader
        title="Grupos de gastos"
        meta="Bloques del Resumen del reporte financiero (p.ej. Facturas laboratorio, Gastos fijos). El orden define su posición."
      />
      <GruposGastosTable
        initialData={initialData}
        search={searchGruposGastos}
        onCreate={createGrupoGasto}
        onUpdate={updateGrupoGasto}
        onToggle={toggleGrupoGasto}
      />
    </>
  )
}
