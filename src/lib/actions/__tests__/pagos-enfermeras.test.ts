// @ts-nocheck
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db'
import { addresses, healthInsurances, nurses, patients, procedures, visitProcedures, visits } from '@/db/schema'
import { inArray } from 'drizzle-orm'
import { P } from './helpers'

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({ user: { id: 'test-user' } })),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  unstable_cache: (fn: any) => fn,
}))

import { getPagoEnfermeraDetalle, searchPagosEnfermerasMensual } from '../pagos-enfermeras'

const created = {
  addresses: [] as number[],
  patients: [] as number[],
  healthInsurances: [] as number[],
  procedures: [] as number[],
  nurses: [] as number[],
  visits: [] as number[],
}

afterEach(async () => {
  await Promise.all([
    created.visits.length ? db.delete(visits).where(inArray(visits.id, created.visits)) : null,
  ])
  await Promise.all([
    created.procedures.length ? db.delete(procedures).where(inArray(procedures.id, created.procedures)) : null,
    created.nurses.length ? db.delete(nurses).where(inArray(nurses.id, created.nurses)) : null,
    created.patients.length ? db.delete(patients).where(inArray(patients.id, created.patients)) : null,
  ])
  await Promise.all([
    created.addresses.length ? db.delete(addresses).where(inArray(addresses.id, created.addresses)) : null,
    created.healthInsurances.length
      ? db.delete(healthInsurances).where(inArray(healthInsurances.id, created.healthInsurances))
      : null,
  ])

  created.addresses = []
  created.patients = []
  created.healthInsurances = []
  created.procedures = []
  created.nurses = []
  created.visits = []
})

function unique(label: string) {
  return `${P}${label}_${Math.random().toString(36).slice(2, 8)}`
}

async function seedNurse(porcentajePago = 67.5) {
  const [row] = await db
    .insert(nurses)
    .values({ nombres: unique('Enf'), apellidoPaterno: 'Test', porcentajePago: String(porcentajePago) })
    .returning()
  created.nurses.push(row!.id)
  return row!
}

async function seedPaciente() {
  const [address] = await db.insert(addresses).values({ direccion: unique('direccion') }).returning()
  created.addresses.push(address!.id)

  const [prevision] = await db
    .insert(healthInsurances)
    .values({ nombre: unique('Fonasa'), categoria: 'fonasa' })
    .returning()
  created.healthInsurances.push(prevision!.id)

  const [patient] = await db
    .insert(patients)
    .values({
      nombres: unique('Paciente'),
      apellidoPaterno: 'Test',
      idDireccion: address!.id,
      idCompaniaSeguro: prevision!.id,
    })
    .returning()
  created.patients.push(patient!.id)
  return patient!
}

async function seedProcedimiento(precio = 10000) {
  const [row] = await db
    .insert(procedures)
    .values({ nombre: unique('Procedimiento'), codigo: unique('PROC'), precio })
    .returning()
  created.procedures.push(row!.id)
  return row!
}

async function seedVisitaPagable(opts: {
  idPaciente: number
  idEnfermera: number
  costo: number
  estado?: string
  montoDescuentoProcedimientos?: number
  descuentoProcedimientosAfectaPagoEnfermera?: boolean
  montoDescuento?: number
  montoVisitaOriginal?: number
  descuentoAfectaPagoEnfermera?: boolean
}) {
  const [visit] = await db
    .insert(visits)
    .values({
      fecha: '2026-06-10',
      idPaciente: opts.idPaciente,
      idEnfermera: opts.idEnfermera,
      estado: opts.estado ?? 'completada',
      costo: opts.costo,
      montoDescuentoProcedimientos: opts.montoDescuentoProcedimientos ?? 0,
      descuentoProcedimientosAfectaPagoEnfermera: opts.descuentoProcedimientosAfectaPagoEnfermera ?? false,
      montoDescuento: opts.montoDescuento ?? 0,
      montoVisitaOriginal: opts.montoVisitaOriginal ?? 0,
      descuentoAfectaPagoEnfermera: opts.descuentoAfectaPagoEnfermera ?? false,
    })
    .returning()
  created.visits.push(visit!.id)
  return visit!
}

async function addProc(idVisita: number, idProcedimiento: number, precio: number) {
  await db.insert(visitProcedures).values({ idVisita, idProcedimiento, precio })
}

describe('pagos-enfermeras con descuento de procedimientos', () => {
  it('sin afectar pago: la enfermera cobra el procedimiento sin descuento (valor original)', async () => {
    const nurse = await seedNurse()
    const patient = await seedPaciente()
    const proc = await seedProcedimiento(10000)
    // costo persistido ya neto del descuento: 10000 - 4000 = 6000
    const visit = await seedVisitaPagable({
      idPaciente: patient.id, idEnfermera: nurse.id, costo: 6000,
      montoDescuentoProcedimientos: 4000, descuentoProcedimientosAfectaPagoEnfermera: false,
    })
    await addProc(visit.id, proc.id, 10000)

    const detalle = await getPagoEnfermeraDetalle(nurse.id, 6, 2026)
    expect(detalle).not.toBeNull()
    const row = detalle!.rows.find((r) => r.id === visit.id)!
    expect(row.procedimientos).toBe(10000)
    expect(row.base).toBe(row.feeVisita + row.procedimientos + row.recargos)
  })

  it('afectando pago: la enfermera cobra el procedimiento neto del descuento', async () => {
    const nurse = await seedNurse()
    const patient = await seedPaciente()
    const proc = await seedProcedimiento(10000)
    const visit = await seedVisitaPagable({
      idPaciente: patient.id, idEnfermera: nurse.id, costo: 6000,
      montoDescuentoProcedimientos: 4000, descuentoProcedimientosAfectaPagoEnfermera: true,
    })
    await addProc(visit.id, proc.id, 10000)

    const detalle = await getPagoEnfermeraDetalle(nurse.id, 6, 2026)
    const row = detalle!.rows.find((r) => r.id === visit.id)!
    expect(row.procedimientos).toBe(6000)
    expect(row.base).toBe(row.feeVisita + row.procedimientos + row.recargos)
  })

  it('el resumen mensual mantiene el invariante base = montoVisitas + montoProcs + montoRecargos', async () => {
    const nurse = await seedNurse()
    const patient = await seedPaciente()
    const proc = await seedProcedimiento(10000)
    const visit = await seedVisitaPagable({
      idPaciente: patient.id, idEnfermera: nurse.id, costo: 6000,
      montoDescuentoProcedimientos: 4000, descuentoProcedimientosAfectaPagoEnfermera: false,
    })
    await addProc(visit.id, proc.id, 10000)

    const { rows } = await searchPagosEnfermerasMensual({ month: 6, year: 2026, enfermeraId: String(nurse.id) })
    const row = rows.find((r) => r.enfermeraId === nurse.id)!
    expect(row.base).toBe(row.montoVisitas + row.montoProcs + row.montoRecargos)
  })
})

// ─── Combinado: descuento de visita + descuento de procedimiento a la vez ─────
//
// Fixture fijo para las 4 combinaciones de afecta/no-afecta:
// montoVisitaOriginal=30000, descuento visita (monto)=10000 → feeVisita neto=20000
// procedimiento: precio=8000, descuento=3000 → subtotal procedimiento neto=5000
// costo persistido (neto de ambos descuentos) = 20000 + 5000 = 25000
const COMBINADO_FIXTURE = {
  montoVisitaOriginal: 30000,
  montoDescuento: 10000,
  precioProcedimiento: 8000,
  montoDescuentoProcedimientos: 3000,
  costo: 25000, // (30000-10000) + (8000-3000)
}

describe('pagos-enfermeras con descuento de visita + descuento de procedimiento combinados', () => {
  it.each([
    {
      descuentoAfectaPagoEnfermera: false,
      descuentoProcedimientosAfectaPagoEnfermera: false,
      expectedFeeVisita: 30000, // se revierte: enfermera cobra el fee original
      expectedProcedimientos: 8000, // se revierte: enfermera cobra el procedimiento original
      expectedBase: 38000,
    },
    {
      descuentoAfectaPagoEnfermera: true,
      descuentoProcedimientosAfectaPagoEnfermera: false,
      expectedFeeVisita: 20000, // afecta: enfermera cobra el fee neto de descuento
      expectedProcedimientos: 8000,
      expectedBase: 28000,
    },
    {
      descuentoAfectaPagoEnfermera: false,
      descuentoProcedimientosAfectaPagoEnfermera: true,
      expectedFeeVisita: 30000,
      expectedProcedimientos: 5000, // afecta: enfermera cobra el procedimiento neto de descuento
      expectedBase: 35000,
    },
    {
      descuentoAfectaPagoEnfermera: true,
      descuentoProcedimientosAfectaPagoEnfermera: true,
      expectedFeeVisita: 20000,
      expectedProcedimientos: 5000,
      expectedBase: 25000,
    },
  ])(
    'afecta visita=$descuentoAfectaPagoEnfermera / afecta procedimiento=$descuentoProcedimientosAfectaPagoEnfermera → base=$expectedBase',
    async ({
      descuentoAfectaPagoEnfermera,
      descuentoProcedimientosAfectaPagoEnfermera,
      expectedFeeVisita,
      expectedProcedimientos,
      expectedBase,
    }) => {
      const nurse = await seedNurse()
      const patient = await seedPaciente()
      const proc = await seedProcedimiento(COMBINADO_FIXTURE.precioProcedimiento)
      const visit = await seedVisitaPagable({
        idPaciente: patient.id,
        idEnfermera: nurse.id,
        costo: COMBINADO_FIXTURE.costo,
        montoDescuento: COMBINADO_FIXTURE.montoDescuento,
        montoVisitaOriginal: COMBINADO_FIXTURE.montoVisitaOriginal,
        descuentoAfectaPagoEnfermera,
        montoDescuentoProcedimientos: COMBINADO_FIXTURE.montoDescuentoProcedimientos,
        descuentoProcedimientosAfectaPagoEnfermera,
      })
      await addProc(visit.id, proc.id, COMBINADO_FIXTURE.precioProcedimiento)

      const detalle = await getPagoEnfermeraDetalle(nurse.id, 6, 2026)
      const row = detalle!.rows.find((r) => r.id === visit.id)!

      expect(row.feeVisita).toBe(expectedFeeVisita)
      expect(row.procedimientos).toBe(expectedProcedimientos)
      expect(row.base).toBe(expectedBase)
      expect(row.base).toBe(row.feeVisita + row.procedimientos + row.recargos)
      expect(row.pagoEstimado).toBe(Math.round((row.base * row.porcentaje) / 100))

      const { rows: resumen } = await searchPagosEnfermerasMensual({ month: 6, year: 2026, enfermeraId: String(nurse.id) })
      const resumenRow = resumen.find((r) => r.enfermeraId === nurse.id)!
      expect(resumenRow.base).toBe(resumenRow.montoVisitas + resumenRow.montoProcs + resumenRow.montoRecargos)
      expect(resumenRow.base).toBe(expectedBase)
    },
  )
})

describe('pagos-enfermeras filtra por estado', () => {
  it('incluye visitas completadas y excluye las que aún están en realizada', async () => {
    const nurse = await seedNurse(65)
    const patient = await seedPaciente()
    const proc = await seedProcedimiento(44000)

    const completada = await seedVisitaPagable({ idPaciente: patient.id, idEnfermera: nurse.id, costo: 44000 })
    await addProc(completada.id, proc.id, 44000)
    const realizada = await seedVisitaPagable({ idPaciente: patient.id, idEnfermera: nurse.id, costo: 44000, estado: 'realizada' })
    await addProc(realizada.id, proc.id, 44000)

    const detalle = await getPagoEnfermeraDetalle(nurse.id, 6, 2026)
    expect(detalle!.rows.map((r) => r.id)).toEqual([completada.id])
    expect(detalle!.cantidadVisitas).toBe(1)
    expect(detalle!.baseTotal).toBe(44000)
    expect(detalle!.pagoTotal).toBe(28600) // 44000 * 65%

    const { rows } = await searchPagosEnfermerasMensual({ month: 6, year: 2026, enfermeraId: String(nurse.id) })
    expect(rows.find((r) => r.enfermeraId === nurse.id)!.cantidadVisitas).toBe(1)
  })
})
