import { db } from '@/db'
import { laboratories, branches } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { LabsManager } from '@/components/labs-manager'
import {
  createCadena,
  updateCadena,
  toggleCadena,
  createSucursal,
  updateSucursal,
  toggleSucursal,
} from '@/lib/actions/laboratorios'

export default async function LaboratoriosPage() {
  const [labs, branchRows] = await Promise.all([
    db.select().from(laboratories).orderBy(asc(laboratories.nombre)),
    db
      .select({
        id: branches.id,
        nombre: branches.nombre,
        idLaboratorio: branches.idLaboratorio,
        activo: branches.activo,
        labNombre: laboratories.nombre,
      })
      .from(branches)
      .leftJoin(laboratories, eq(branches.idLaboratorio, laboratories.id))
      .orderBy(asc(laboratories.nombre), asc(branches.nombre)),
  ])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Laboratorios y Clínicas
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Gestión de cadenas y sus sucursales. Selecciona una cadena para filtrar sus sucursales.
        </p>
      </div>

      <LabsManager
        labs={labs}
        branches={branchRows}
        createCadena={createCadena}
        updateCadena={updateCadena}
        toggleCadena={toggleCadena}
        createSucursal={createSucursal}
        updateSucursal={updateSucursal}
        toggleSucursal={toggleSucursal}
      />
    </div>
  )
}
