import { ResidenciasTable } from '@/components/residencias-table'
import { searchResidencias, createResidencia, updateResidencia, toggleResidencia } from '@/lib/actions/catalogos'

export default async function ResidenciasPage() {
  const initialData = await searchResidencias({ filters: {}, sort: null, page: 1, pageSize: 10 })

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Residencias de Adulto Mayor</h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Establecimientos de residencia para adultos mayores</p>
      </div>
      <ResidenciasTable
        initialData={initialData}
        search={searchResidencias}
        onCreate={createResidencia}
        onUpdate={updateResidencia}
        onToggle={toggleResidencia}
      />
    </>
  )
}
