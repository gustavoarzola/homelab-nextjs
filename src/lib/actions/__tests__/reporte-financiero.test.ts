// @ts-nocheck
import { afterAll, describe, expect, it, vi } from 'vitest'
import ExcelJS from 'exceljs'
import { db } from '@/db'
import { costCategories, monthlyCosts, visits } from '@/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { P } from './helpers'

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({ user: { id: 'test-user', role: 'admin' } })),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: any) => fn,
}))

import { CONCEPTOS_INGRESO } from '@/lib/reportes/financiero'
import { listVisitasReporteFinanciero } from '@/lib/reportes/financiero-query'
import { getCostosMensuales, guardarCostosMensuales } from '../costos-mensuales'
import { GET } from '@/app/api/reportes/financiero/export/route'

const createdCategorias: number[] = []

afterAll(async () => {
  if (createdCategorias.length) {
    await db.delete(monthlyCosts).where(inArray(monthlyCosts.idCategoria, createdCategorias))
    await db.delete(costCategories).where(inArray(costCategories.id, createdCategorias))
  }
})

async function categoria(nombre: string, activo = true) {
  const [c] = await db.insert(costCategories).values({ nombre: `${P}${nombre}`, activo }).returning()
  createdCategorias.push(c!.id)
  return c!
}

describe('listVisitasReporteFinanciero (BD sembrada)', () => {
  it('cada fila cuadra: Σ columnas de ingreso = Total boleta, y = visitas.costo en visitas con servicios', async () => {
    const rows = await listVisitasReporteFinanciero({})
    expect(rows.length).toBeGreaterThan(100)
    const costos = new Map(
      (await db.select({ id: visits.id, costo: visits.costo, costoTraslado: visits.costoTraslado }).from(visits)).map((v) => [v.id, v]),
    )
    for (const r of rows) {
      const suma = CONCEPTOS_INGRESO.reduce((acc, c) => acc + c.get(r.montos), 0)
      expect(suma, `visita ${r.id}`).toBe(r.montos.totalBoleta)
      if (r.estado === 'no_realizada') {
        expect(r.montos.totalBoleta, `visita ${r.id}`).toBe(costos.get(r.id)!.costoTraslado)
        expect(r.procedimientos).toBe('')
      } else if (r.estado === 'cancelada') {
        expect(r.montos.totalBoleta).toBe(0)
      } else {
        expect(r.montos.descuadreCostoRegistrado, `visita ${r.id}`).toBe(0)
        expect(r.montos.totalBoleta, `visita ${r.id}`).toBe(costos.get(r.id)!.costo)
      }
    }
  })

  it('respeta el filtro de estados', async () => {
    const rows = await listVisitasReporteFinanciero({ estado: 'realizada,completada,no_realizada' })
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) expect(['realizada', 'completada', 'no_realizada']).toContain(r.estado)
    expect(rows.some((r) => r.estado === 'no_realizada')).toBe(true)
  })
})

describe('costos mensuales', () => {
  it('upsert por categoría/mes; 0 sin notas borra; inactiva con monto sigue apareciendo', async () => {
    const lab = await categoria('Laboratorio')
    const arriendo = await categoria('Arriendo')

    let res = await guardarCostosMensuales({
      anio: 2031, mes: 4,
      items: [
        { idCategoria: lab.id, monto: 150000, notas: 'Factura 123' },
        { idCategoria: arriendo.id, monto: 400000 },
      ],
    })
    expect(res.success).toBe(true)

    res = await guardarCostosMensuales({
      anio: 2031, mes: 4,
      items: [
        { idCategoria: lab.id, monto: 175000, notas: 'Factura 124' },
        { idCategoria: arriendo.id, monto: 0, notas: '' },
      ],
    })
    expect(res.success).toBe(true)

    const guardados = await db
      .select()
      .from(monthlyCosts)
      .where(and(inArray(monthlyCosts.idCategoria, [lab.id, arriendo.id]), eq(monthlyCosts.anio, 2031)))
    expect(guardados).toHaveLength(1)
    expect(guardados[0]).toMatchObject({ idCategoria: lab.id, mes: 4, monto: 175000, notas: 'Factura 124' })

    await db.update(costCategories).set({ activo: false }).where(eq(costCategories.id, lab.id))
    const form = await getCostosMensuales(2031, 4)
    expect(form.find((r) => r.idCategoria === lab.id)).toMatchObject({ activo: false, monto: 175000 })
    const otroMes = await getCostosMensuales(2031, 5)
    expect(otroMes.find((r) => r.idCategoria === lab.id)).toBeUndefined()
    expect(otroMes.find((r) => r.idCategoria === arriendo.id)).toMatchObject({ monto: 0, notas: '' })
  })

  it('rechaza montos negativos y meses inválidos', async () => {
    const c = await categoria('Validacion')
    expect((await guardarCostosMensuales({ anio: 2031, mes: 13, items: [] })).success).toBe(false)
    const neg = await guardarCostosMensuales({ anio: 2031, mes: 1, items: [{ idCategoria: c.id, monto: -1 }] })
    expect(neg).toMatchObject({ success: false })
  })
})

describe('GET /api/reportes/financiero/export', () => {
  it('entrega un Excel con hojas Resumen, Visitas y Costos mensuales', async () => {
    const c = await categoria('Excel')
    await guardarCostosMensuales({ anio: 2026, mes: 3, items: [{ idCategoria: c.id, monto: 12345 }] })

    const res = await GET(new Request(
      'http://localhost/api/reportes/financiero/export?fechaInicio=2026-03-01&fechaFin=2026-03-31&estado=realizada,completada,no_realizada&columns=id,estado,totalBoleta',
    ))
    expect(res.headers.get('Content-Type')).toContain('spreadsheetml')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await res.arrayBuffer())
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Resumen', 'Visitas', 'Costos mensuales'])

    const visitas = wb.getWorksheet('Visitas')!
    expect(visitas.getRow(1).values.filter(Boolean)).toEqual(['ID', 'Estado', 'Total boleta'])

    const resumen = wb.getWorksheet('Resumen')!
    expect(resumen.getRow(1).values.filter(Boolean)).toEqual(['Concepto', '2026-03', 'Total'])
    const filaCosto = resumen.getColumn(1).values.findIndex((v) => v === `${P}Excel`)
    expect(filaCosto).toBeGreaterThan(0)
    expect(resumen.getRow(filaCosto).getCell(2).value).toBe(12345)

    const costosSheet = wb.getWorksheet('Costos mensuales')!
    const nombres = costosSheet.getColumn(2).values
    expect(nombres).toContain(`${P}Excel`)
  })
})
