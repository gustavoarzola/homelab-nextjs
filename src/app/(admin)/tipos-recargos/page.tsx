import { TiposRecargosTable } from '@/components/tipos-recargos-table'
import { searchTiposRecargos, createTipoRecargo, updateTipoRecargo, toggleTipoRecargo } from '@/lib/actions/catalogos'
import { PageHeader } from '@/components/page-header'

export default async function TiposRecargosPage() {
  const initialData = await searchTiposRecargos({ filters: {}, sort: null, page: 1, pageSize: 10 })

  return (
    <>
      <PageHeader title="Tipos de Recargos" meta="Gestionar motivos y tipos de recargos excepcionales por visita" />
      <TiposRecargosTable
        initialData={initialData}
        search={searchTiposRecargos}
        onCreate={createTipoRecargo}
        onUpdate={updateTipoRecargo}
        onToggle={toggleTipoRecargo}
      />
    </>
  )
}
