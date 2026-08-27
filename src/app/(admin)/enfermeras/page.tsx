import { EnfermerasTable } from '@/components/enfermeras-table'
import {
  searchEnfermeras,
  createEnfermera,
  updateEnfermera,
  toggleEnfermera,
  deleteEnfermera,
} from '@/lib/actions/enfermeras'
import { getComunasForSelect } from '@/lib/actions/catalogos'

export default async function EnfermerasPage() {
  const [initialData, comunas] = await Promise.all([
    searchEnfermeras({ filters: {}, sort: null, page: 1, pageSize: 10 }),
    getComunasForSelect(),
  ])

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Enfermeras</h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Gestión del equipo de enfermería</p>
      </div>

      <EnfermerasTable
        initialData={initialData}
        comunas={comunas}
        search={searchEnfermeras}
        onCreate={createEnfermera}
        onUpdate={updateEnfermera}
        onToggle={toggleEnfermera}
        onDelete={deleteEnfermera}
      />
    </>
  )
}
