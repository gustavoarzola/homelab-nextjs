// @ts-nocheck
// Tests de solo-lectura contra el seed determinista (`now='2026-03-15', seed=42`,
// sembrado una vez en globalSetup — ver docs/plan-seed-tests/00-overview.md).
// En vez de fijar conteos/valores frágiles, se comparan los resultados de las
// server actions contra consultas SQL independientes y contra el invariante
// `costo == recompute(calcularCostoVisitaPersistida)` (Definition of done del Paso 4).
import { describe, expect, it, vi } from 'vitest'
import { db } from '@/db'
import { visits } from '@/db/schema'
import { and, asc, count, countDistinct, eq, gte, isNotNull, lte, sql, sum } from 'drizzle-orm'

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({ user: { id: 'test-user' } })),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  unstable_cache: (fn: any) => fn,
}))

import { getDashboardFinanciero, getDashboardVisitsByDay } from '../dashboard'
import { searchPagosEnfermerasMensual } from '../pagos-enfermeras'
import { calcularCostoVisitaPersistida } from '@/lib/pricing/visitas'
import { calcNursePayment } from '@/lib/pricing/nurse-payment'

const MARCH_START = '2026-03-01'
const MARCH_END = '2026-03-31'

describe('getDashboardVisitsByDay — marzo 2026 (seed determinista)', () => {
  it('el total de visitas coincide con un conteo independiente por rango de fecha', async () => {
    const [row] = await db
      .select({ total: count() })
      .from(visits)
      .where(and(gte(visits.fecha, MARCH_START), lte(visits.fecha, MARCH_END)))

    const result = await getDashboardVisitsByDay(3, 2026)

    expect(result.chartData).toHaveLength(31) // marzo tiene 31 días
    expect(result.totalVisits).toBe(Number(row?.total ?? 0))
    expect(result.totalVisits).toBeGreaterThan(0)
  })

  it('el día pico reportado es el máximo real dentro del propio chartData', async () => {
    const result = await getDashboardVisitsByDay(3, 2026)
    const maxFromChart = Math.max(...result.chartData.map((d) => d.visits))
    expect(result.peakVisits).toBe(maxFromChart)
  })

  it('el ranking incluye a todas las enfermeras con visitas del mes y su suma no excede el total', async () => {
    const [row] = await db
      .select({ total: countDistinct(visits.idEnfermera) })
      .from(visits)
      .where(and(gte(visits.fecha, MARCH_START), lte(visits.fecha, MARCH_END), isNotNull(visits.idEnfermera)))

    const result = await getDashboardVisitsByDay(3, 2026)
    const rankingSum = result.visitsByNurse.reduce((s, r) => s + r.value, 0)

    expect(result.visitsByNurse.length).toBe(Number(row?.total ?? 0))
    expect(rankingSum).toBeLessThanOrEqual(result.totalVisits)
    expect(rankingSum).toBeGreaterThan(0) // el seed asigna enfermera a buena parte de las visitas
  })

  it('los ítems atendidos cuentan exámenes/procedimientos/talleres de visitas realizadas (SQL independiente, incluye isapre)', async () => {
    const independiente = await db.execute(sql`
      select
        (select count(*) from (
           select ev.id_visita, ev.id_examen from examenes_visitas ev
           union
           select eiv.id_visita, eiv.id_examen from examenes_isapre_visitas eiv
         ) x
         join visitas v on v.id = x.id_visita
         where v.fecha >= ${MARCH_START} and v.fecha <= ${MARCH_END}
           and v.estado in ('realizada', 'completada'))::int as examenes,
        (select count(*) from procedimientos_visitas pv
           join visitas v on v.id = pv.id_visita
           join procedimientos p on p.id = pv.id_procedimiento
         where v.fecha >= ${MARCH_START} and v.fecha <= ${MARCH_END}
           and v.estado in ('realizada', 'completada')
           and p.categoria = 'curaciones')::int as curaciones,
        (select count(*) from procedimientos_visitas pv
           join visitas v on v.id = pv.id_visita
           join procedimientos p on p.id = pv.id_procedimiento
         where v.fecha >= ${MARCH_START} and v.fecha <= ${MARCH_END}
           and v.estado in ('realizada', 'completada')
           and p.categoria <> 'curaciones')::int as otros,
        (select count(*) from talleres_visitas tv
           join visitas v on v.id = tv.id_visita
         where v.fecha >= ${MARCH_START} and v.fecha <= ${MARCH_END}
           and v.estado in ('realizada', 'completada'))::int as talleres
    `)
    const ind = independiente[0]

    const result = await getDashboardVisitsByDay(3, 2026)

    expect(result.itemsAtendidos.map((r) => r.label)).toEqual([
      'Exámenes',
      'Curaciones',
      'Otros procedimientos',
      'Talleres',
    ])

    const byLabel = Object.fromEntries(result.itemsAtendidos.map((r) => [r.label, r.value]))
    expect(byLabel['Exámenes']).toBe(Number(ind.examenes))
    expect(byLabel['Curaciones']).toBe(Number(ind.curaciones))
    expect(byLabel['Otros procedimientos']).toBe(Number(ind.otros))
    expect(byLabel['Talleres']).toBe(Number(ind.talleres))

    const total = result.itemsAtendidos.reduce((s, r) => s + r.value, 0)
    expect(total).toBeGreaterThan(0)
  })
})

describe('getDashboardFinanciero — marzo 2026 (seed determinista)', () => {
  it('cobrosEnPendiente coincide con SUM(costo) independiente de visitas realizadas y no pagadas', async () => {
    const [row] = await db
      .select({ total: sum(visits.costo) })
      .from(visits)
      .where(
        and(
          gte(visits.fecha, MARCH_START),
          lte(visits.fecha, MARCH_END),
          eq(visits.estado, 'realizada'),
          eq(visits.pagado, false),
        ),
      )

    const result = await getDashboardFinanciero(3, 2026)

    expect(result.cobrosEnPendiente).toBe(Number(row?.total ?? 0))
    expect(result.cobrosEnPendiente).toBeGreaterThan(0)
  })

  it('cobros pendientes: total independiente y quickview acotado a 20', async () => {
    const [row] = await db
      .select({ total: count() })
      .from(visits)
      .where(
        and(
          gte(visits.fecha, MARCH_START),
          lte(visits.fecha, MARCH_END),
          eq(visits.estado, 'realizada'),
          eq(visits.pagado, false),
        ),
      )

    const result = await getDashboardFinanciero(3, 2026)

    expect(result.totalCobrosPendientes).toBe(Number(row?.total ?? 0))
    expect(result.cobrosPendientes.length).toBeLessThanOrEqual(20)
    expect(result.cobrosPendientes.length).toBeLessThanOrEqual(result.totalCobrosPendientes)
  })

  it('resultados pendientes: 1 fila por (visita, examen) sin envío, incluye isapre', async () => {
    const result = await getDashboardFinanciero(3, 2026)
    const rows = result.resultadosPendientes

    // quickview acotado
    expect(rows.length).toBeLessThanOrEqual(20)
    expect(rows.length).toBeLessThanOrEqual(result.totalResultadosPendientes)

    // pares (visita, examen) únicos
    const keys = rows.map((r) => `${r.idVisita}-${r.idExamen}`)
    expect(new Set(keys).size).toBe(keys.length)

    // cada fila trae metadatos del examen
    for (const r of rows) {
      expect(typeof r.examenNombre).toBe('string')
      expect(r.examenNombre.length).toBeGreaterThan(0)
    }

    // SQL independiente: pares de exámenes (regular ∪ isapre) de visitas realizadas de
    // marzo sin fila enviado=true en examenes_visitas_resultados
    const independiente = await db.execute(sql`
      select count(*)::int as total from (
        select ev.id_visita, ev.id_examen from examenes_visitas ev
        union
        select eiv.id_visita, eiv.id_examen from examenes_isapre_visitas eiv
      ) x
      join visitas v on v.id = x.id_visita
      left join examenes_visitas_resultados r
        on r.id_visita = x.id_visita and r.id_examen = x.id_examen
      where v.fecha >= ${MARCH_START} and v.fecha <= ${MARCH_END}
        and v.estado = 'realizada'
        and r.enviado is not true
    `)
    expect(result.totalResultadosPendientes).toBe(Number(independiente[0].total))
    expect(result.totalResultadosPendientes).toBeGreaterThan(0)
  })

  it('el costo de cada visita en cobros pendientes refleja descuentos e insumos (recompute == persistido)', async () => {
    const result = await getDashboardFinanciero(3, 2026)
    expect(result.cobrosPendientes.length).toBeGreaterThan(0)

    for (const cobro of result.cobrosPendientes) {
      const recompute = await calcularCostoVisitaPersistida(cobro.id)
      expect(recompute.total).toBe(cobro.costo)
    }
  })

  it('invariante costo == recompute(calcularCostoVisitaPersistida) sobre una muestra determinista de marzo', async () => {
    const rows = await db
      .select({ id: visits.id, costo: visits.costo })
      .from(visits)
      .where(and(gte(visits.fecha, MARCH_START), lte(visits.fecha, MARCH_END)))
      .orderBy(asc(visits.id))
      .limit(40)

    expect(rows.length).toBeGreaterThan(0)

    for (const row of rows) {
      const recompute = await calcularCostoVisitaPersistida(row.id)
      expect(recompute.total).toBe(row.costo)
      // Los descuentos nunca pueden exceder el monto que descuentan (invariante recomendado en 04-tests-integracion.md).
      expect(recompute.montoDescuento).toBeLessThanOrEqual(recompute.costoVisitaEnfermeriaOriginal)
      expect(recompute.montoDescuentoProcedimientos).toBeLessThanOrEqual(recompute.subtotalProcedimientosOriginal)
    }
  })
})

describe('pago a enfermeras — marzo 2026 (invariantes de nurse-payment.ts sobre el seed)', () => {
  it('base == montoVisitas + montoProcs + montoRecargos y pagoEstimado == calcNursePayment(base, porcentaje)', async () => {
    const { rows } = await searchPagosEnfermerasMensual({ month: 3, year: 2026 })
    expect(rows.length).toBeGreaterThan(0)

    for (const row of rows) {
      expect(row.base).toBe(row.montoVisitas + row.montoProcs + row.montoRecargos)
      expect(row.pagoEstimado).toBe(calcNursePayment(row.base, row.porcentaje))
    }
  })
})
