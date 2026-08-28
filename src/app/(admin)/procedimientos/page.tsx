import { ProcedimientosTable } from '@/components/procedimientos-table'
import { searchProcedimientos, createProcedimiento, updateProcedimiento, toggleProcedimiento } from '@/lib/actions/catalogos'
import { PageHeader } from '@/components/page-header'

export default async function ProcedimientosPage() {
  const initialData = await searchProcedimientos({ filters: {}, sort: null, page: 1, pageSize: 10 })

  return (
    <>
      <PageHeader title="Procedimientos" meta="Catálogo de procedimientos de enfermería" />
      <ProcedimientosTable
        initialData={initialData}
        search={searchProcedimientos}
        onCreate={createProcedimiento}
        onUpdate={updateProcedimiento}
        onToggle={toggleProcedimiento}
      />
    </>
  )
}
