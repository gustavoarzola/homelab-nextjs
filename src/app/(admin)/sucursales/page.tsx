import { SucursalesTable } from '@/components/sucursales-table'
import { searchSucursales, createSucursal, updateSucursal, toggleSucursal, searchLaboratorios } from '@/lib/actions/laboratorios'

export default async function SucursalesPage() {
  const [initialData, { rows: laboratorios }] = await Promise.all([
    searchSucursales({ filters: {}, sort: null, page: 1, pageSize: 10 }),
    searchLaboratorios({ filters: {}, sort: null, page: 1, pageSize: 1000 }),
  ])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Sucursales</h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Sedes y puntos de atención por laboratorio</p>
      </div>
      <SucursalesTable
        initialData={initialData}
        laboratorios={laboratorios}
        search={searchSucursales}
        onCreate={createSucursal}
        onUpdate={updateSucursal}
        onToggle={toggleSucursal}
      />
    </div>
  )
}
