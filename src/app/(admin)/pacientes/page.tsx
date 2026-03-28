import { searchPacientes, deletePaciente } from '@/lib/actions/pacientes'
import { searchPrevisiones } from '@/lib/actions/catalogos'
import { PacientesTable } from '@/components/pacientes-table'

export default async function PacientesPage() {
  const [initialData, { rows: previsiones }] = await Promise.all([
    searchPacientes({ filters: {}, sort: null, page: 1, pageSize: 10 }),
    searchPrevisiones({ filters: { mostrarInactivos: false }, sort: null, page: 1, pageSize: 1000 }),
  ])

  async function handleDelete(id: number) {
    'use server'
    return deletePaciente(id)
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Pacientes
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Gestión de pacientes
        </p>
      </div>
      <PacientesTable
        initialData={initialData}
        previsiones={previsiones}
        search={searchPacientes}
        onDelete={handleDelete}
      />
    </div>
  )
}
