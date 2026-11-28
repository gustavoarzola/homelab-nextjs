// @ts-nocheck
import { afterAll, describe, expect, it, vi } from 'vitest'
import ExcelJS from 'exceljs'
import { db } from '@/db'
import { expenseCategories, expenseGroups, monthlyExpenses, visits } from '@/db/schema'
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

import { auth } from '@/auth'
import { CONCEPTOS_INGRESO } from '@/lib/reportes/financiero'
import { listVisitasReporteFinanciero } from '@/lib/reportes/financiero-query'
import { getGastosMensuales, guardarGastosMensuales } from '../gastos-mensuales'
import { getDashboardVisitsByDay } from '../dashboard'
import { createCategoriaGasto, createGrupoGasto } from '../catalogos'
import { fd } from './helpers'
import { GET } from '@/app/api/reportes/financiero/export/route'

const createdCategorias: number[] = []
const createdGrupos: number[] = []

afterAll(async () => {
  if (createdCategorias.length) {
    await db.delete(monthlyExpenses).where(inArray(monthlyExpenses.idCategoria, createdCategorias))
    await db.delete(expenseCategories).where(inArray(expenseCategories.id, createdCategorias))
  }
  if (createdGrupos.length) await db.delete(expenseGroups).where(inArray(expenseGroups.id, createdGrupos))
})

async function grupo(nombre: string, orden = 0) {
  const [g] = await db.insert(expenseGroups).values({ nombre: `${P}${nombre}`, orden }).returning()
  createdGrupos.push(g!.id)
  return g!
}

let grupoDefault: { id: number } | null = null
async function categoria(nombre: string, activo = true, idGrupo?: number, orden = 0) {
  grupoDefault ??= await grupo('Default', 99)
  const [c] = await db.insert(expenseCategories).values({ nombre: `${P}${nombre}`, activo, idGrupo: idGrupo ?? grupoDefault.id, orden }).returning()
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
  it('crea los grupos del informe de fin de mes en orden, sin categorías', async () => {
    const grupos = await db.select({ nombre: expenseGroups.nombre, orden: expenseGroups.orden }).from(expenseGroups)
    const porNombre = new Map(grupos.map((g) => [g.nombre, g.orden]))
    expect(porNombre.get('Facturas laboratorio')).toBe(1)
    expect(porNombre.get('Sueldo Rinaldo')).toBe(2)
    expect(porNombre.get('Gastos fijos y variables sin el personal')).toBe(3)
    // Las categorías las crea el admin: fuera de las de estos tests (prefijo _t…), no hay ninguna.
    const categorias = await db.select({ nombre: expenseCategories.nombre }).from(expenseCategories)
    expect(categorias.filter((c) => !c.nombre.startsWith('_t'))).toEqual([])
  })
})

describe('catálogo de grupos y categorías de gasto', () => {
  it('crea un grupo y una categoría con grupo y orden; exige grupo', async () => {
    expect((await createGrupoGasto(fd({ nombre: `${P}GrupoUI`, orden: 7 }))).success).toBe(true)
    const [g] = await db.select().from(expenseGroups).where(eq(expenseGroups.nombre, `${P}GrupoUI`))
    createdGrupos.push(g!.id)
    expect(g!.orden).toBe(7)

    expect((await createCategoriaGasto(fd({ nombre: `${P}CatUI`, idGrupo: g!.id, orden: 3 }))).success).toBe(true)
    const [c] = await db.select().from(expenseCategories).where(eq(expenseCategories.nombre, `${P}CatUI`))
    createdCategorias.push(c!.id)
    expect(c).toMatchObject({ idGrupo: g!.id, orden: 3 })

    expect(await createCategoriaGasto(fd({ nombre: `${P}SinGrupo` }))).toMatchObject({ success: false })
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

describe('gastos mensuales', () => {
  it('upsert por categoría/mes; 0 sin notas borra; inactiva con monto sigue apareciendo', async () => {
    const lab = await categoria('Laboratorio')
    const arriendo = await categoria('Arriendo')

    let res = await guardarGastosMensuales({
      anio: 2031, mes: 4,
      items: [
        { idCategoria: lab.id, monto: 150000, notas: 'Factura 123' },
        { idCategoria: arriendo.id, monto: 400000 },
      ],
    })
    expect(res.success).toBe(true)

    res = await guardarGastosMensuales({
      anio: 2031, mes: 4,
      items: [
        { idCategoria: lab.id, monto: 175000, notas: 'Factura 124' },
        { idCategoria: arriendo.id, monto: 0, notas: '' },
      ],
    })
    expect(res.success).toBe(true)

    const guardados = await db
      .select()
      .from(monthlyExpenses)
      .where(and(inArray(monthlyExpenses.idCategoria, [lab.id, arriendo.id]), eq(monthlyExpenses.anio, 2031)))
    expect(guardados).toHaveLength(1)
    expect(guardados[0]).toMatchObject({ idCategoria: lab.id, mes: 4, monto: 175000, notas: 'Factura 124' })

    await db.update(expenseCategories).set({ activo: false }).where(eq(expenseCategories.id, lab.id))
    const form = await getGastosMensuales(2031, 4)
    expect(form.find((r) => r.idCategoria === lab.id)).toMatchObject({ activo: false, monto: 175000 })
    expect(form.find((r) => r.idCategoria === lab.id)?.grupo).toBe(`${P}Default`)
    const otroMes = await getGastosMensuales(2031, 5)
    expect(otroMes.find((r) => r.idCategoria === lab.id)).toBeUndefined()
    expect(otroMes.find((r) => r.idCategoria === arriendo.id)).toMatchObject({ monto: 0, notas: '' })
  })

  it('rechaza montos negativos y meses inválidos', async () => {
    const c = await categoria('Validacion')
    expect((await guardarGastosMensuales({ anio: 2031, mes: 13, items: [] })).success).toBe(false)
    const neg = await guardarGastosMensuales({ anio: 2031, mes: 1, items: [{ idCategoria: c.id, monto: -1 }] })
    expect(neg).toMatchObject({ success: false })
  })
})

describe('GET /api/reportes/financiero/export', () => {
  it('entrega un Excel con hojas Resumen, Visitas y Gastos mensuales', async () => {
    const g = await grupo('GrupoExcel', 0)
    const c = await categoria('Excel', true, g.id, 1)
    await guardarGastosMensuales({ anio: 2026, mes: 3, items: [{ idCategoria: c.id, monto: 12345 }] })

    const res = await GET(new Request(
      'http://localhost/api/reportes/financiero/export?fechaInicio=2026-03-01&fechaFin=2026-03-31&estado=realizada,completada,no_realizada&columns=id,estado,totalBoleta',
    ))
    expect(res.headers.get('Content-Type')).toContain('spreadsheetml')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await res.arrayBuffer())
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Resumen', 'Visitas', 'Gastos mensuales'])

    const visitas = wb.getWorksheet('Visitas')!
    expect(visitas.getRow(1).values.filter(Boolean)).toEqual(['ID', 'Estado', 'Total boleta'])

    const resumen = wb.getWorksheet('Resumen')!
    expect(resumen.getRow(1).values.filter(Boolean)).toEqual(['Concepto', '2026-03'])
    const conceptos = resumen.getColumn(1).values as unknown[]
    const fila = (c: string) => conceptos.findIndex((v) => v === c)
    const filaGasto = fila(`${P}Excel`)
    expect(filaGasto).toBeGreaterThan(0)
    expect(resumen.getRow(filaGasto).getCell(2).value).toBe(12345)
    expect(fila(`${P}GrupoExcel`)).toBe(filaGasto - 1)
    expect(resumen.getRow(filaGasto - 1).getCell(2).value).toBe(12345)

    // Orden de bloques y celdas manuales vacías en amarillo
    const orden = ['PACIENTES', 'INGRESOS', 'Total ingresos', 'UTILIDAD ANTES DE GASTOS', 'Producción Visitas',
      'Total Facturado', 'GASTOS TOTALES', 'Enfermeras visitas', 'Gastos totales', 'UTILIDAD ANTES DE IMPUESTOS',
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

    const gastosSheet = wb.getWorksheet('Gastos mensuales')!
    const nombres = gastosSheet.getColumn(3).values
    expect(nombres).toContain(`${P}Excel`)
  })
})

describe('permisos del reporte financiero', () => {
  it('un ejecutivo no puede descargarlo; un admin sí', async () => {
    const url = 'http://localhost/api/reportes/financiero/export?fechaInicio=2026-03-01&fechaFin=2026-03-31&columns=id'
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: 'u2', role: 'ejecutivo' } })
    await expect(GET(new Request(url))).rejects.toThrow(/permisos/)
    expect((await GET(new Request(url))).status).toBe(200)
  })
})
