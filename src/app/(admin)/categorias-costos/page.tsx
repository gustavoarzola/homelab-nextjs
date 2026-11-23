import { CategoriasCostosTable } from '@/components/categorias-costos-table'
import {
  searchCategoriasCostos,
  createCategoriaCosto,
  updateCategoriaCosto,
  toggleCategoriaCosto,
} from '@/lib/actions/catalogos'
import { PageHeader } from '@/components/page-header'

export default async function CategoriasCostosPage() {
  const initialData = await searchCategoriasCostos({ filters: {}, sort: null, page: 1, pageSize: 10 })

  return (
    <>
      <PageHeader
        title="Categorías de costos"
        meta="Conceptos de costo que se ingresan mes a mes en Costos mensuales (laboratorios, insumos, arriendo…)"
      />
      <CategoriasCostosTable
        initialData={initialData}
        search={searchCategoriasCostos}
        onCreate={createCategoriaCosto}
        onUpdate={updateCategoriaCosto}
        onToggle={toggleCategoriaCosto}
      />
    </>
  )
}
