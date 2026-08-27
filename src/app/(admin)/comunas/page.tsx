import { ComunasTable } from '@/components/comunas-table'
import { searchComunas, createComuna, updateComuna, toggleComuna } from '@/lib/actions/catalogos'

export default async function ComunasPage() {
  const initialData = await searchComunas({ filters: {}, sort: null, page: 1, pageSize: 10 })

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Comunas</h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Catálogo de comunas usado en enfermeras, precios de visita y cotizaciones</p>
      </div>
      <ComunasTable
        initialData={initialData}
        search={searchComunas}
        onCreate={createComuna}
        onUpdate={updateComuna}
        onToggle={toggleComuna}
      />
    </>
  )
}
