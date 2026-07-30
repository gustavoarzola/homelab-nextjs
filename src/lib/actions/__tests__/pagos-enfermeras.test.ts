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

async function seedVisitaRealizada(opts: {
  idPaciente: number
  idEnfermera: number
  costo: number
  montoDescuentoProcedimientos?: number
  descuentoProcedimientosAfectaPagoEnfermera?: boolean
}) {
  const [visit] = await db
    .insert(visits)
    .values({
      fecha: '2026-06-10',
      idPaciente: opts.idPaciente,
      idEnfermera: opts.idEnfermera,
      estado: 'realizada',
      costo: opts.costo,
      montoDescuentoProcedimientos: opts.montoDescuentoProcedimientos ?? 0,
      descuentoProcedimientosAfectaPagoEnfermera: opts.descuentoProcedimientosAfectaPagoEnfermera ?? false,
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
    const visit = await seedVisitaRealizada({
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
    const visit = await seedVisitaRealizada({
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
    const visit = await seedVisitaRealizada({
      idPaciente: patient.id, idEnfermera: nurse.id, costo: 6000,
      montoDescuentoProcedimientos: 4000, descuentoProcedimientosAfectaPagoEnfermera: false,
    })
    await addProc(visit.id, proc.id, 10000)

    const { rows } = await searchPagosEnfermerasMensual({ month: 6, year: 2026, enfermeraId: String(nurse.id) })
    const row = rows.find((r) => r.enfermeraId === nurse.id)!
    expect(row.base).toBe(row.montoVisitas + row.montoProcs + row.montoRecargos)
  })
})
