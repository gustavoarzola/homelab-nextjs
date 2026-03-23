import { EnfermerasTable } from '@/components/enfermeras-table'
import {
  searchEnfermeras,
  createEnfermera,
  updateEnfermera,
  toggleEnfermera,
  deleteEnfermera,
} from '@/lib/actions/enfermeras'

export default async function EnfermerasPage() {
  const initialData = await searchEnfermeras({
    filters: {},
    sort: null,
    page: 1,
    pageSize: 10,
  })

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Enfermeras</h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Gestión del equipo de enfermería</p>
      </div>

      <EnfermerasTable
        initialData={initialData}
        search={searchEnfermeras}
        onCreate={createEnfermera}
        onUpdate={updateEnfermera}
        onToggle={toggleEnfermera}
        onDelete={deleteEnfermera}
      />
    </div>
  )
}
