import { searchPacientes, deletePaciente } from '@/lib/actions/pacientes'
import { searchPrevisiones } from '@/lib/actions/catalogos'
import { PacientesTable } from '@/components/pacientes-table'
import { PageHeader } from '@/components/page-header'

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
    <>
      <PageHeader title="Pacientes" meta="Gestión de pacientes" />
      <PacientesTable
        initialData={initialData}
        previsiones={previsiones}
        search={searchPacientes}
        onDelete={handleDelete}
      />
    </>
  )
}
