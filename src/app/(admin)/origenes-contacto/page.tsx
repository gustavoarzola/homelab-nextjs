import { OrigenesContactoTable } from '@/components/origenes-contacto-table'
import { searchOrigenesContacto, createOrigenContacto, updateOrigenContacto, toggleOrigenContacto } from '@/lib/actions/catalogos'
import { PageHeader } from '@/components/page-header'

export default async function OrigenesContactoPage() {
  const initialData = await searchOrigenesContacto({ filters: {}, sort: null, page: 1, pageSize: 10 })

  return (
    <>
      <PageHeader title="Orígenes de contacto" meta="Catálogo de orígenes de contacto usado en visitas" />
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
