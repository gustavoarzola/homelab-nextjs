// @ts-nocheck
import { afterEach, describe, expect, it, vi } from 'vitest'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { addresses, feeRetentionRates, monthlyExpenses, nurses, patients, visits } from '@/db/schema'
import { fd, P } from './helpers'

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({ user: { id: 'test-user' } })),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  unstable_cache: (fn: any) => fn,
}))

import { getEstadoResultados } from '../estado-resultados'
import { copiarGastosMesAnterior, createGastoMensual, deleteGastoMensual, searchGastosMensuales, updateGastoMensual } from '../gastos-mensuales'
import { createTasaRetencion, getTasasRetencion } from '../tasas-retencion'
import { searchPagosEnfermerasMensual } from '../pagos-enfermeras'

// Año aislado de los datos sembrados (2026) para no mezclar gastos de prueba con otros tests.
const ANIO = 2031

const created = { visits: [] as number[], nurses: [] as number[], patients: [] as number[], addresses: [] as number[], tasas: [] as number[] }

afterEach(async () => {
  // ANIO - 1 lo usa el test de "copiar mes anterior" (diciembre → enero)
  await db.delete(monthlyExpenses).where(inArray(monthlyExpenses.anio, [ANIO - 1, ANIO]))
  if (created.visits.length) await db.delete(visits).where(inArray(visits.id, created.visits))
  if (created.nurses.length) await db.delete(nurses).where(inArray(nurses.id, created.nurses))
  if (created.patients.length) await db.delete(patients).where(inArray(patients.id, created.patients))
  if (created.addresses.length) await db.delete(addresses).where(inArray(addresses.id, created.addresses))
  if (created.tasas.length) await db.delete(feeRetentionRates).where(inArray(feeRetentionRates.id, created.tasas))
  Object.keys(created).forEach((k) => (created[k] = []))
})

describe('getEstadoResultados — cuadratura con datos sembrados', () => {
  it('en cada mes con visitas completadas: ingresos netos = Σ costo, sin ajuste, y honorarios = /pagos-enfermeras', async () => {
    const meses = await db
      .selectDistinct({ m: sql<number>`extract(month from ${visits.fecha})::int`, y: sql<number>`extract(year from ${visits.fecha})::int` })
      .from(visits)
      .where(eq(visits.estado, 'completada'))
    expect(meses.length).toBeGreaterThan(0)

    for (const { m, y } of meses) {
      const eerr = await getEstadoResultados(m, y)
      const pagos = await searchPagosEnfermerasMensual({ month: m, year: y })
      const [{ total }] = await db
        .select({ total: sql<string>`coalesce(sum(${visits.costo}), 0)` })
        .from(visits)
        .where(and(eq(visits.estado, 'completada'), sql`extract(month from ${visits.fecha}) = ${m} and extract(year from ${visits.fecha}) = ${y}`))

      expect(eerr.totales.ingresosNetos, `ingresos ${y}-${m}`).toBe(Number(total))
      expect(eerr.totales.ajusteCuadratura, `ajuste ${y}-${m}`).toBe(0)
      expect(eerr.totales.honorarios, `honorarios ${y}-${m}`).toBe(pagos.rows.reduce((a, r) => a + r.pagoEstimado, 0))
      expect(eerr.totales.resultado).toBe(eerr.totales.ingresosNetos - eerr.totales.costosDirectos - eerr.totales.gastosOperacionales)
      const keys = eerr.rows.map((r) => r.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
})

describe('gastos mensuales', () => {
  it('crea, lista, edita y elimina; los gastos entran al EERR del mes', async () => {
    const r1 = await createGastoMensual(fd({ anio: ANIO, mes: 3, categoria: 'marketing', descripcion: `${P}Ads`, monto: 50000 }))
    const r2 = await createGastoMensual(fd({ anio: ANIO, mes: 3, categoria: 'costo_laboratorio', descripcion: `${P}Factura`, monto: 30000, grupoExamen: 'imalab' }))
    expect(r1.success && r2.success).toBe(true)

    const { rows, total } = await searchGastosMensuales({ filters: { anio: String(ANIO), mes: '3' }, sort: null, page: 1, pageSize: 10 })
    expect(total).toBe(2)
    const ads = rows.find((r) => r.categoria === 'marketing')
    expect(rows.find((r) => r.categoria === 'costo_laboratorio')?.grupoExamen).toBe('imalab')

    const eerr = await getEstadoResultados(3, ANIO)
    expect(eerr.totales.gastosOperacionales).toBe(50000)
    expect(eerr.totales.costosDirectos).toBe(30000)
    expect(eerr.totales.resultado).toBe(-80000)

    const upd = await updateGastoMensual(fd({ id: ads.id, anio: ANIO, mes: 3, categoria: 'marketing', descripcion: `${P}Ads`, monto: 70000 }))
    expect(upd.success).toBe(true)
    expect((await getEstadoResultados(3, ANIO)).totales.gastosOperacionales).toBe(70000)

    expect((await deleteGastoMensual(ads.id)).success).toBe(true)
    expect((await getEstadoResultados(3, ANIO)).totales.gastosOperacionales).toBe(0)
  })

  it('el laboratorio se descarta si la categoría no es costo_laboratorio', async () => {
    await createGastoMensual(fd({ anio: ANIO, mes: 4, categoria: 'personal', descripcion: `${P}Sueldo`, monto: 1000, grupoExamen: 'imalab' }))
    const { rows } = await searchGastosMensuales({ filters: { anio: String(ANIO), mes: '4' }, sort: null, page: 1, pageSize: 10 })
    expect(rows[0].grupoExamen).toBeNull()
  })

  it('rechaza datos inválidos', async () => {
    expect((await createGastoMensual(fd({ anio: ANIO, mes: 13, categoria: 'marketing', descripcion: 'x', monto: 1 }))).success).toBe(false)
    expect((await createGastoMensual(fd({ anio: ANIO, mes: 1, categoria: 'inventada', descripcion: 'x', monto: 1 }))).success).toBe(false)
    expect((await createGastoMensual(fd({ anio: ANIO, mes: 1, categoria: 'marketing', descripcion: '  ', monto: 1 }))).success).toBe(false)
    expect((await createGastoMensual(fd({ anio: ANIO, mes: 1, categoria: 'marketing', descripcion: 'x', monto: -5 }))).success).toBe(false)
    expect((await createGastoMensual(fd({ anio: ANIO, mes: 1, categoria: 'costo_laboratorio', descripcion: 'x', monto: 5, grupoExamen: 'otro lab' }))).success).toBe(false)
  })

  it('copiar mes anterior no duplica y cruza el cambio de año', async () => {
    await createGastoMensual(fd({ anio: ANIO - 1, mes: 12, categoria: 'administracion', descripcion: `${P}Contador`, monto: 90000 }))
    await createGastoMensual(fd({ anio: ANIO - 1, mes: 12, categoria: 'costo_laboratorio', descripcion: `${P}Lab`, monto: 5000, grupoExamen: 'integramédica' }))

    const primera = await copiarGastosMesAnterior(1, ANIO)
    expect(primera).toEqual({ success: true, data: { copiados: 2 } })
    const segunda = await copiarGastosMesAnterior(1, ANIO)
    expect(segunda).toEqual({ success: true, data: { copiados: 0 } })

    const { total } = await searchGastosMensuales({ filters: { anio: String(ANIO), mes: '1' }, sort: null, page: 1, pageSize: 10 })
    expect(total).toBe(2)
    expect((await copiarGastosMesAnterior(6, ANIO)).success).toBe(false) // mayo no tiene gastos
  })
})

describe('tasa de retención con vigencia', () => {
  it('la tasa de un mes es la última vigente a su fin de mes; los meses pasados no cambian', async () => {
    const mk = async (vigenteDesde: string, porcentaje: number) => {
      const r = await createTasaRetencion(fd({ vigenteDesde, porcentaje }))
      expect(r.success).toBe(true)
    }
    await mk('2031-01-01', 20)
    await mk('2031-07-01', 22.5)
    const filas = (await getTasasRetencion()).filter((t) => t.vigenteDesde.startsWith('2031'))
    created.tasas.push(...filas.map((t) => t.id))

    expect((await getEstadoResultados(6, 2031)).tasaRetencion).toBe(20)
    expect((await getEstadoResultados(7, 2031)).tasaRetencion).toBe(22.5)
    expect((await createTasaRetencion(fd({ vigenteDesde: '2031-07-01', porcentaje: 30 }))).success).toBe(false)
    expect((await createTasaRetencion(fd({ vigenteDesde: '2031-08-01', porcentaje: 101 }))).success).toBe(false)
  })

  it('la migración deja la tasa legal de 2026', async () => {
    expect((await getEstadoResultados(10, 2026)).tasaRetencion).toBe(15.25)
  })
})
