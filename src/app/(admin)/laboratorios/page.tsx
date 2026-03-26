import { LaboratoriosTable } from '@/components/laboratorios-table'
import { searchLaboratorios, createLaboratorio, updateLaboratorio, toggleLaboratorio } from '@/lib/actions/laboratorios'

export default async function LaboratoriosPage() {
  const initialData = await searchLaboratorios({ filters: {}, sort: null, page: 1, pageSize: 10 })

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Laboratorios</h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Hospitales, clínicas y redes de laboratorios</p>
      </div>
      <LaboratoriosTable
        initialData={initialData}
        search={searchLaboratorios}
        onCreate={createLaboratorio}
        onUpdate={updateLaboratorio}
        onToggle={toggleLaboratorio}
      />
    </div>
  )
}
