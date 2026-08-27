import { OrigenesContactoTable } from '@/components/origenes-contacto-table'
import { searchOrigenesContacto, createOrigenContacto, updateOrigenContacto, toggleOrigenContacto } from '@/lib/actions/catalogos'

export default async function OrigenesContactoPage() {
  const initialData = await searchOrigenesContacto({ filters: {}, sort: null, page: 1, pageSize: 10 })

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Orígenes de contacto</h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Catálogo de orígenes de contacto usado en visitas</p>
      </div>
      <OrigenesContactoTable
        initialData={initialData}
        search={searchOrigenesContacto}
        onCreate={createOrigenContacto}
        onUpdate={updateOrigenContacto}
        onToggle={toggleOrigenContacto}
      />
    </>
  )
}
