import { CategoriasGastosTable } from '@/components/categorias-gastos-table'
import {
  searchCategoriasGastos,
  createCategoriaGasto,
  updateCategoriaGasto,
  toggleCategoriaGasto,
  getGruposGastosForSelect,
} from '@/lib/actions/catalogos'
import { PageHeader } from '@/components/page-header'

export default async function CategoriasGastosPage() {
  const [initialData, grupos] = await Promise.all([
    searchCategoriasGastos({ filters: {}, sort: null, page: 1, pageSize: 10 }),
    getGruposGastosForSelect(),
  ])

  return (
    <>
      <PageHeader
        title="Categorías de gastos"
        meta="Conceptos de gasto que se ingresan mes a mes en Gastos mensuales. Cada una pertenece a un grupo del Resumen."
      />
      <CategoriasGastosTable
        initialData={initialData}
        grupos={grupos}
        search={searchCategoriasGastos}
        onCreate={createCategoriaGasto}
        onUpdate={updateCategoriaGasto}
        onToggle={toggleCategoriaGasto}
      />
    </>
  )
}
