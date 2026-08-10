import { db } from '@/db'
import {
  addresses,
  nursingVisitPrices,
  patients,
  visitExams,
  visitIsapreExams,
  visitProcedures,
  visitSurcharges,
  visitWorkshops,
  visits,
} from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'

import { resolverMontoDescuento, type DescuentoTipo } from '@/lib/pricing/descuento'

export type CostoVisitaCalculado = {
  subtotalProcedimientos: number
  subtotalProcedimientosOriginal: number
  montoDescuentoProcedimientos: number
  subtotalExamenes: number
  subtotalTalleres: number
  subtotalRecargos: number
  costoVisitaEnfermeria: number
  costoVisitaEnfermeriaOriginal: number
  montoDescuento: number
  montoInsumos: number
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

/**
 * Cálculo puro (sin BD) del costo de una visita a partir de sus items y del
 * precio de visita de enfermería ya resuelto. Es el núcleo compartido por
 * `calcularCostoVisitaPersistida()` (que lee los items desde la BD) y por el
 * seed (que ya tiene los items en memoria al construir la visita) — nunca se
 * reimplementa la fórmula en paralelo.
 */
export function computeCostoVisita(inputs: {
  procedimientos: { precio: number; descuento: number }[]
  examenes: { precio: number }[]
  exameneIsapre: { valorPagar: number }[]
  talleres: { precio: number }[]
  recargos: { precio: number }[]
  aplicaVisitaEnfermeria: boolean
  /** Fee de la comuna (o base) ANTES de aplicar el descuento de la visita. */
  precioVisita: number | null
  descuentoTipo: DescuentoTipo
  descuentoValor: number
  montoInsumos: number
}): CostoVisitaCalculado {
  const {
    procedimientos,
    examenes,
    exameneIsapre,
    talleres,
    recargos,
    aplicaVisitaEnfermeria,
    precioVisita,
    descuentoTipo,
    descuentoValor,
    montoInsumos,
  } = inputs

  const subtotalProcedimientosOriginal = procedimientos.reduce((sum, row) => sum + row.precio, 0)
  const montoDescuentoProcedimientos = procedimientos.reduce(
    (sum, row) => sum + Math.min(Math.max(0, row.descuento), row.precio),
    0,
  )
  const subtotalProcedimientos = subtotalProcedimientosOriginal - montoDescuentoProcedimientos
  const subtotalExamenes = examenes.reduce((sum, row) => sum + row.precio, 0)
  const subtotalIsapreExamenes = exameneIsapre.reduce((sum, row) => sum + row.valorPagar, 0)
  const subtotalTalleres = talleres.reduce((sum, row) => sum + row.precio, 0)
  const subtotalRecargos = recargos.reduce((sum, row) => sum + row.precio, 0)
  const costoVisitaEnfermeriaOriginal = precioVisita ?? 0
  const montoDescuento = aplicaVisitaEnfermeria
    ? resolverMontoDescuento(costoVisitaEnfermeriaOriginal, descuentoTipo, descuentoValor)
    : 0
  const costoVisitaEnfermeria = Math.max(0, costoVisitaEnfermeriaOriginal - montoDescuento)

  return {
    subtotalProcedimientos,
    subtotalProcedimientosOriginal,
    montoDescuentoProcedimientos,
    subtotalExamenes: subtotalExamenes + subtotalIsapreExamenes,
    subtotalTalleres,
    subtotalRecargos,
    costoVisitaEnfermeria,
    costoVisitaEnfermeriaOriginal,
    montoDescuento,
    montoInsumos,
    total: subtotalProcedimientos + subtotalExamenes + subtotalIsapreExamenes + subtotalTalleres + costoVisitaEnfermeria + subtotalRecargos + montoInsumos,
    aplicaVisitaEnfermeria,
    precioVisitaConfigurado: precioVisita !== null,
  }
}

export async function calcularCostoVisitaPersistida(
  idVisita: number,
  conn: PricingDb = db,
): Promise<CostoVisitaCalculado> {
  const [procedimientos, examenes, exameneIsapre, talleres, recargos, [visitaPaciente]] = await Promise.all([
    conn.select({ precio: visitProcedures.precio, descuento: visitProcedures.descuento }).from(visitProcedures).where(eq(visitProcedures.idVisita, idVisita)),
    conn.select({ precio: visitExams.precio }).from(visitExams).where(eq(visitExams.idVisita, idVisita)),
    conn.select({ valorPagar: visitIsapreExams.valorPagar }).from(visitIsapreExams).where(eq(visitIsapreExams.idVisita, idVisita)),
    conn.select({ precio: visitWorkshops.precio }).from(visitWorkshops).where(eq(visitWorkshops.idVisita, idVisita)),
    conn.select({ precio: visitSurcharges.precio }).from(visitSurcharges).where(eq(visitSurcharges.idVisita, idVisita)),
    conn
      .select({
        comuna: addresses.areaAdministrativa3,
        cobraVisita: visits.cobraVisita,
        montoInsumos: visits.montoInsumos,
        descuentoTipo: visits.descuentoTipo,
        descuentoValor: visits.descuentoValor,
      })
      .from(visits)
      .leftJoin(patients, eq(visits.idPaciente, patients.id))
      .leftJoin(addresses, eq(patients.idDireccion, addresses.id))
      .where(eq(visits.id, idVisita))
      .limit(1),
  ])

  const aplicaVisitaEnfermeria = visitaPaciente?.cobraVisita ?? false
  const precioVisita = aplicaVisitaEnfermeria
    ? await getPrecioVisitaEnfermeria(conn, visitaPaciente?.comuna ?? null)
    : null

  return computeCostoVisita({
    procedimientos,
    examenes,
    exameneIsapre,
    talleres,
    recargos,
    aplicaVisitaEnfermeria,
    precioVisita,
    descuentoTipo: (visitaPaciente?.descuentoTipo ?? 'monto') as DescuentoTipo,
    descuentoValor: visitaPaciente?.descuentoValor ?? 0,
    montoInsumos: visitaPaciente?.montoInsumos ?? 0,
  })
}

export async function actualizarCostoVisitaPersistida(
  idVisita: number,
  conn: PricingDb = db,
): Promise<CostoVisitaCalculado> {
  const costo = await calcularCostoVisitaPersistida(idVisita, conn)

  await conn
    .update(visits)
    .set({
      costo: costo.total,
      montoDescuento: costo.montoDescuento,
      montoVisitaOriginal: costo.costoVisitaEnfermeriaOriginal,
      montoDescuentoProcedimientos: costo.montoDescuentoProcedimientos,
      updatedAt: new Date(),
    })
    .where(eq(visits.id, idVisita))

  return costo
}
