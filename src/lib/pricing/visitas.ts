import { db } from '@/db'
import {
  addresses,
  nursingVisitPrices,
  patients,
  visitExams,
  visitProcedures,
  visitSurcharges,
  visitWorkshops,
  visits,
} from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'

export type CostoVisitaCalculado = {
  subtotalProcedimientos: number
  subtotalExamenes: number
  subtotalTalleres: number
  subtotalRecargos: number
  costoVisitaEnfermeria: number
  total: number
  aplicaVisitaEnfermeria: boolean
  precioVisitaConfigurado: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PricingDb = any

export async function getPrecioVisitaEnfermeria(
  conn: PricingDb,
  comuna: string | null,
): Promise<number | null> {
  if (comuna) {
    const [precioComuna] = await conn
      .select({ precio: nursingVisitPrices.precio })
      .from(nursingVisitPrices)
      .where(and(eq(nursingVisitPrices.comuna, comuna), eq(nursingVisitPrices.activo, true)))
      .limit(1)

    if (precioComuna) return precioComuna.precio
  }

  const [precioBase] = await conn
    .select({ precio: nursingVisitPrices.precio })
    .from(nursingVisitPrices)
    .where(and(isNull(nursingVisitPrices.comuna), eq(nursingVisitPrices.activo, true)))
    .limit(1)

  return precioBase?.precio ?? null
}

export async function calcularCostoVisitaPersistida(
  idVisita: number,
  conn: PricingDb = db,
): Promise<CostoVisitaCalculado> {
  const [procedimientos, examenes, talleres, recargos, [visitaPaciente]] = await Promise.all([
    conn.select({ precio: visitProcedures.precio }).from(visitProcedures).where(eq(visitProcedures.idVisita, idVisita)),
    conn.select({ precio: visitExams.precio }).from(visitExams).where(eq(visitExams.idVisita, idVisita)),
    conn.select({ precio: visitWorkshops.precio }).from(visitWorkshops).where(eq(visitWorkshops.idVisita, idVisita)),
    conn.select({ precio: visitSurcharges.precio }).from(visitSurcharges).where(eq(visitSurcharges.idVisita, idVisita)),
    conn
      .select({ comuna: addresses.areaAdministrativa3, cobraVisita: visits.cobraVisita })
      .from(visits)
      .leftJoin(patients, eq(visits.idPaciente, patients.id))
      .leftJoin(addresses, eq(patients.idDireccion, addresses.id))
      .where(eq(visits.id, idVisita))
      .limit(1),
  ])

  const subtotalProcedimientos = procedimientos.reduce((sum: number, row: { precio: number }) => sum + row.precio, 0)
  const subtotalExamenes = examenes.reduce((sum: number, row: { precio: number }) => sum + row.precio, 0)
  const subtotalTalleres = talleres.reduce((sum: number, row: { precio: number }) => sum + row.precio, 0)
  const subtotalRecargos = recargos.reduce((sum: number, row: { precio: number }) => sum + row.precio, 0)
  const aplicaVisitaEnfermeria = visitaPaciente?.cobraVisita ?? false
  const precioVisita = aplicaVisitaEnfermeria
    ? await getPrecioVisitaEnfermeria(conn, visitaPaciente?.comuna ?? null)
    : null
  const costoVisitaEnfermeria = precioVisita ?? 0

  return {
    subtotalProcedimientos,
    subtotalExamenes,
    subtotalTalleres,
    subtotalRecargos,
    costoVisitaEnfermeria,
    total: subtotalProcedimientos + subtotalExamenes + subtotalTalleres + costoVisitaEnfermeria + subtotalRecargos,
    aplicaVisitaEnfermeria,
    precioVisitaConfigurado: precioVisita !== null,
  }
}

export async function actualizarCostoVisitaPersistida(
  idVisita: number,
  conn: PricingDb = db,
): Promise<CostoVisitaCalculado> {
  const costo = await calcularCostoVisitaPersistida(idVisita, conn)

  await conn
    .update(visits)
    .set({ costo: costo.total, updatedAt: new Date() })
    .where(eq(visits.id, idVisita))

  return costo
}
