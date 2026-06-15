import { TiposRecargosTable } from '@/components/tipos-recargos-table'
import { searchTiposRecargos, createTipoRecargo, updateTipoRecargo, toggleTipoRecargo } from '@/lib/actions/catalogos'

export default async function TiposRecargosPage() {
  const initialData = await searchTiposRecargos({ filters: {}, sort: null, page: 1, pageSize: 10 })

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Tipos de Recargos</h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Gestionar motivos y tipos de recargos excepcionales por visita</p>
      </div>
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
