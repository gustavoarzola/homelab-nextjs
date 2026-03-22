import { db } from '@/db'
import { procedures, exams, healthInsurances, elderlyResidences } from '@/db/schema'
import { asc } from 'drizzle-orm'
import { CatalogosPage } from '@/components/catalogos-page'
import {
  createProcedimiento,
  updateProcedimiento,
  toggleProcedimiento,
  createExamen,
  updateExamen,
  toggleExamen,
  createPrevision,
  updatePrevision,
  togglePrevision,
  createResidencia,
  updateResidencia,
  toggleResidencia,
} from '@/lib/actions/catalogos'

export default async function CatalogosPageRoute() {
  const [procedimientoRows, examenRows, previsionRows, residenciaRows] = await Promise.all([
    db.select().from(procedures).orderBy(asc(procedures.nombre)),
    db.select().from(exams).orderBy(asc(exams.nombre)),
    db.select().from(healthInsurances).orderBy(asc(healthInsurances.nombre)),
    db.select().from(elderlyResidences).orderBy(asc(elderlyResidences.nombre)),
  ])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Catálogos
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Datos de referencia usados en visitas y pacientes.
        </p>
      </div>

      <CatalogosPage
        procedimientos={procedimientoRows}
        examenes={examenRows}
        previsiones={previsionRows}
        residencias={residenciaRows}
        actions={{
          createProcedimiento,
          updateProcedimiento,
          toggleProcedimiento,
          createExamen,
          updateExamen,
          toggleExamen,
          createPrevision,
          updatePrevision,
          togglePrevision,
          createResidencia,
          updateResidencia,
          toggleResidencia,
        }}
      />
    </div>
  )
}
