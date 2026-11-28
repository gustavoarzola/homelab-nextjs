import { CategoriasCostosTable } from '@/components/categorias-costos-table'
import {
  searchCategoriasCostos,
  createCategoriaCosto,
  updateCategoriaCosto,
  toggleCategoriaCosto,
  getGruposCostosForSelect,
} from '@/lib/actions/catalogos'
import { PageHeader } from '@/components/page-header'

export default async function CategoriasCostosPage() {
  const [initialData, grupos] = await Promise.all([
    searchCategoriasCostos({ filters: {}, sort: null, page: 1, pageSize: 10 }),
    getGruposCostosForSelect(),
  ])

  return (
    <>
      <PageHeader
        title="Categorías de costos"
        meta="Conceptos de costo que se ingresan mes a mes en Costos mensuales. Cada una pertenece a un grupo del Resumen."
      />
      <CategoriasCostosTable
        initialData={initialData}
        grupos={grupos}
        search={searchCategoriasCostos}
        onCreate={createCategoriaCosto}
        onUpdate={updateCategoriaCosto}
        onToggle={toggleCategoriaCosto}
      />
    </>
  )
}
