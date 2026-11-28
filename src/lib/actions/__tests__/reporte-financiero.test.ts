// @ts-nocheck
import { afterAll, describe, expect, it, vi } from 'vitest'
import ExcelJS from 'exceljs'
import { db } from '@/db'
import { costCategories, costGroups, monthlyCosts, visits } from '@/db/schema'
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
import { getDashboardVisitsByDay } from '../dashboard'
import { createCategoriaCosto, createGrupoCosto } from '../catalogos'
import { fd } from './helpers'
import { GET } from '@/app/api/reportes/financiero/export/route'

const createdCategorias: number[] = []
const createdGrupos: number[] = []

afterAll(async () => {
  if (createdCategorias.length) {
    await db.delete(monthlyCosts).where(inArray(monthlyCosts.idCategoria, createdCategorias))
    await db.delete(costCategories).where(inArray(costCategories.id, createdCategorias))
  }
  if (createdGrupos.length) await db.delete(costGroups).where(inArray(costGroups.id, createdGrupos))
})

async function grupo(nombre: string, orden = 0) {
  const [g] = await db.insert(costGroups).values({ nombre: `${P}${nombre}`, orden }).returning()
  createdGrupos.push(g!.id)
  return g!
}

let grupoDefault: { id: number } | null = null
async function categoria(nombre: string, activo = true, idGrupo?: number, orden = 0) {
  grupoDefault ??= await grupo('Default', 99)
  const [c] = await db.insert(costCategories).values({ nombre: `${P}${nombre}`, activo, idGrupo: idGrupo ?? grupoDefault.id, orden }).returning()
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

describe('migración 0026', () => {
  it('trae los grupos y categorías iniciales del informe de fin de mes, todas con grupo', async () => {
    const rows = await db
      .select({ categoria: costCategories.nombre, grupo: costGroups.nombre })
      .from(costCategories)
      .innerJoin(costGroups, eq(costCategories.idGrupo, costGroups.id))
    const porNombre = new Map(rows.map((r) => [r.categoria, r.grupo]))
    expect(porNombre.get('Factura Imalab')).toBe('Facturas laboratorio')
    expect(porNombre.get('Rinaldo · Bono')).toBe('Sueldo Rinaldo')
    expect(porNombre.get('Contador')).toBe('Gastos fijos y variables sin el personal')
    expect([...porNombre.keys()].some((n) => /descuento/i.test(n))).toBe(false)
  })
})

describe('catálogo de grupos y categorías de costo', () => {
  it('crea un grupo y una categoría con grupo y orden; exige grupo', async () => {
    expect((await createGrupoCosto(fd({ nombre: `${P}GrupoUI`, orden: 7 }))).success).toBe(true)
    const [g] = await db.select().from(costGroups).where(eq(costGroups.nombre, `${P}GrupoUI`))
    createdGrupos.push(g!.id)
    expect(g!.orden).toBe(7)

    expect((await createCategoriaCosto(fd({ nombre: `${P}CatUI`, idGrupo: g!.id, orden: 3 }))).success).toBe(true)
    const [c] = await db.select().from(costCategories).where(eq(costCategories.nombre, `${P}CatUI`))
    createdCategorias.push(c!.id)
    expect(c).toMatchObject({ idGrupo: g!.id, orden: 3 })

    expect(await createCategoriaCosto(fd({ nombre: `${P}SinGrupo` }))).toMatchObject({ success: false })
  })
})

describe('conteos del Resumen vs dashboard', () => {
  it('para un mes, los conteos coinciden con "Ítems atendidos" del dashboard', async () => {
    const rows = await listVisitasReporteFinanciero({ fechaInicio: '2026-03-01', fechaFin: '2026-03-31' })
    const dash = await getDashboardVisitsByDay(3, 2026)
    const contar = (f: (c: any) => boolean) => rows.filter((r) => f(r.montos.conteo)).length
    const esperado = Object.fromEntries(dash.itemsAtendidos.map((i) => [i.label, i.value]))
    expect(esperado['Exámenes']).toBeGreaterThan(0)
    expect(contar((c) => c.examen)).toBe(esperado['Exámenes'])
    expect(contar((c) => c.curacion)).toBe(esperado['Curaciones'])
    expect(contar((c) => c.otroProcedimiento)).toBe(esperado['Otros procedimientos'])
    expect(contar((c) => c.taller)).toBe(esperado['Talleres'] ?? 0)
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
    expect(form.find((r) => r.idCategoria === lab.id)?.grupo).toBe(`${P}Default`)
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
    const g = await grupo('GrupoExcel', 0)
    const c = await categoria('Excel', true, g.id, 1)
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
    expect(resumen.getRow(1).values.filter(Boolean)).toEqual(['Concepto', '2026-03'])
    const conceptos = resumen.getColumn(1).values as unknown[]
    const fila = (c: string) => conceptos.findIndex((v) => v === c)
    const filaCosto = fila(`${P}Excel`)
    expect(filaCosto).toBeGreaterThan(0)
    expect(resumen.getRow(filaCosto).getCell(2).value).toBe(12345)
    expect(fila(`${P}GrupoExcel`)).toBe(filaCosto - 1)
    expect(resumen.getRow(filaCosto - 1).getCell(2).value).toBe(12345)

    // Orden de bloques y celdas manuales vacías en amarillo
    const orden = ['PACIENTES', 'INGRESOS', 'Total ingresos', 'UTILIDAD ANTES DE COSTOS', 'Producción Visitas',
      'Total Facturado', 'COSTOS TOTALES', 'Enfermeras visitas', 'Costos totales', 'UTILIDAD ANTES DE IMPUESTOS',
      'Insumos recuperados', 'Utilidad antes de impuestos + materiales']
    const posiciones = orden.map(fila)
    expect(posiciones.every((p) => p > 0)).toBe(true)
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones)
    const manual = resumen.getRow(fila('Total Facturado'))
    expect(manual.getCell(2).value).toBeNull()
    expect(manual.getCell(2).fill).toMatchObject({ fgColor: { argb: 'FFFFF2CC' } })

    // Cuadre en el Excel: Total ingresos = Prod. exámenes + IMED a pagar + Prod. visitas + insumos
    const v = (c: string) => Number(resumen.getRow(fila(c)).getCell(2).value)
    expect(v('Total ingresos')).toBeGreaterThan(0)
    expect(v('Total ingresos')).toBe(v('Producción Exámenes') + v('Producción de IMED a pagar') + v('Producción Visitas') + v('Insumos recuperados'))
    expect(fila('Exámenes (otro grupo)')).toBe(-1)

    const costosSheet = wb.getWorksheet('Costos mensuales')!
    const nombres = costosSheet.getColumn(3).values
    expect(nombres).toContain(`${P}Excel`)
  })
})
