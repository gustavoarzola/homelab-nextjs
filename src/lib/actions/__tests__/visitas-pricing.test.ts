// @ts-nocheck
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db'
import {
  addresses,
  examPrices,
  exams,
  healthInsurances,
  nursingVisitPrices,
  patients,
  procedures,
  visitExams,
  visitProcedures,
  visits,
} from '@/db/schema'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { P } from './helpers'

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({ user: { id: 'test-user' } })),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { calcularCostoVisitaPersistida } from '@/lib/pricing/visitas'
import { createVisita, getVisitaFormPricingContext, updateVisita } from '../visitas'

const created = {
  addresses: [] as number[],
  patients: [] as number[],
  healthInsurances: [] as number[],
  procedures: [] as number[],
  exams: [] as number[],
  examPrices: [] as number[],
  nursingVisitPrices: [] as number[],
  visits: [] as number[],
}

afterEach(async () => {
  await Promise.all([
    created.visits.length ? db.delete(visits).where(inArray(visits.id, created.visits)) : null,
    created.examPrices.length ? db.delete(examPrices).where(inArray(examPrices.id, created.examPrices)) : null,
    created.nursingVisitPrices.length
      ? db.delete(nursingVisitPrices).where(inArray(nursingVisitPrices.id, created.nursingVisitPrices))
      : null,
  ])
  await Promise.all([
    created.procedures.length ? db.delete(procedures).where(inArray(procedures.id, created.procedures)) : null,
    created.exams.length ? db.delete(exams).where(inArray(exams.id, created.exams)) : null,
  ])
  await Promise.all([
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
  created.exams = []
  created.examPrices = []
  created.nursingVisitPrices = []
  created.visits = []
})

function unique(label: string) {
  return `${P}${label}_${Math.random().toString(36).slice(2, 8)}`
}

async function seedPaciente(comuna: string) {
  const [address] = await db
    .insert(addresses)
    .values({ direccion: unique('direccion'), areaAdministrativa3: comuna })
    .returning()
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

async function seedExamen(precioBase = 5000) {
  const [exam] = await db
    .insert(exams)
    .values({ nombre: unique('Examen'), codigo: unique('EX') })
    .returning()
  created.exams.push(exam!.id)

  const [price] = await db
    .insert(examPrices)
    .values({ idExamen: exam!.id, tipoPrevision: 'fonasa', comuna: null, precio: precioBase })
    .returning()
  created.examPrices.push(price!.id)

  return exam!
}

async function seedPrecioVisita(comuna: string | null, precio: number) {
  const [row] = await db.insert(nursingVisitPrices).values({ comuna, precio }).returning()
  created.nursingVisitPrices.push(row!.id)
  return row!
}

async function seedOrUsePrecioBase(precio: number) {
  const [existing] = await db
    .select()
    .from(nursingVisitPrices)
    .where(and(isNull(nursingVisitPrices.comuna), eq(nursingVisitPrices.activo, true)))
    .limit(1)

  if (existing) return existing
  return seedPrecioVisita(null, precio)
}

async function seedVisita(idPaciente: number, montoInsumos = 0) {
  const [visit] = await db
    .insert(visits)
    .values({ fecha: '2026-05-05', idPaciente, costo: 999999, montoInsumos })
    .returning()
  created.visits.push(visit!.id)
  return visit!
}

async function addProc(idVisita: number, idProcedimiento: number, precio: number) {
  await db.insert(visitProcedures).values({ idVisita, idProcedimiento, precio })
}

async function addExam(idVisita: number, idExamen: number, precio: number) {
  await db.insert(visitExams).values({ idVisita, idExamen, precio })
}

function visitaForm(data: Record<string, string | number>, proceduresIds: number[] = [], examIds: number[] = []) {
  const form = new FormData()
  Object.entries(data).forEach(([key, value]) => form.append(key, String(value)))
  proceduresIds.forEach((id) => form.append('procedure_ids', String(id)))
  examIds.forEach((id) => form.append('exam_ids', String(id)))
  return form
}

describe('calcularCostoVisitaPersistida', () => {
  it('suma procedimientos y exámenes sin costo de visita', async () => {
    const comuna = unique('ComunaProcExam')
    const patient = await seedPaciente(comuna)
    const proc = await seedProcedimiento()
    const exam = await seedExamen()
    const visit = await seedVisita(patient.id)
    await seedPrecioVisita(comuna, 30000)
    await addProc(visit.id, proc.id, 12000)
    await addExam(visit.id, exam.id, 8000)

    const costo = await calcularCostoVisitaPersistida(visit.id)

    expect(costo.total).toBe(20000)
    expect(costo.costoVisitaEnfermeria).toBe(0)
  })

  it('agrega costo de visita por comuna cuando solo hay exámenes', async () => {
    const comuna = unique('ComunaSoloExam')
    const patient = await seedPaciente(comuna)
    const exam = await seedExamen()
    const visit = await seedVisita(patient.id)
    await seedPrecioVisita(comuna, 42000)
    await addExam(visit.id, exam.id, 9000)

    const costo = await calcularCostoVisitaPersistida(visit.id)

    expect(costo.total).toBe(51000)
    expect(costo.costoVisitaEnfermeria).toBe(42000)
  })

  it('usa precio base cuando no hay precio por comuna', async () => {
    const patient = await seedPaciente(unique('ComunaSinPrecio'))
    const exam = await seedExamen()
    const visit = await seedVisita(patient.id)
    const precioBase = await seedOrUsePrecioBase(25000)
    await addExam(visit.id, exam.id, 7000)

    const costo = await calcularCostoVisitaPersistida(visit.id)

    expect(costo.total).toBe(7000 + precioBase.precio)
    expect(costo.costoVisitaEnfermeria).toBe(precioBase.precio)
  })

  it('solo procedimientos suma procedimientos', async () => {
    const comuna = unique('ComunaSoloProc')
    const patient = await seedPaciente(comuna)
    const proc = await seedProcedimiento()
    const visit = await seedVisita(patient.id)
    await seedPrecioVisita(comuna, 30000)
    await addProc(visit.id, proc.id, 14000)

    const costo = await calcularCostoVisitaPersistida(visit.id)

    expect(costo.total).toBe(14000)
    expect(costo.aplicaVisitaEnfermeria).toBe(false)
  })

  it('visita sin procedimientos ni exámenes totaliza cero', async () => {
    const patient = await seedPaciente(unique('ComunaVacia'))
    const visit = await seedVisita(patient.id)

    const costo = await calcularCostoVisitaPersistida(visit.id)

    expect(costo.total).toBe(0)
  })

  it('suma el monto de insumos al total', async () => {
    const comuna = unique('ComunaInsumos')
    const patient = await seedPaciente(comuna)
    const exam = await seedExamen()
    const visit = await seedVisita(patient.id, 4000)
    await addExam(visit.id, exam.id, 9000)

    const costo = await calcularCostoVisitaPersistida(visit.id)

    expect(costo.montoInsumos).toBe(4000)
    expect(costo.total).toBe(13000)
  })
})

describe('createVisita/updateVisita costo calculado', () => {
  it('createVisita ignora costo enviado y guarda total calculado', async () => {
    const comuna = unique('ComunaCreate')
    const patient = await seedPaciente(comuna)
    const exam = await seedExamen(6000)
    await seedPrecioVisita(comuna, 44000)

    const result = await createVisita(
      visitaForm({ idPaciente: patient.id, fecha: '2026-05-05', costo: 999999 }, [], [exam.id]),
    )

    expect(result.success).toBe(true)
    created.visits.push(result.id)

    const [visit] = await db.select({ costo: visits.costo }).from(visits).where(eq(visits.id, result.id))
    expect(visit!.costo).toBe(50000)
  })

  it('updateVisita ignora costo enviado y guarda total calculado', async () => {
    const patient = await seedPaciente(unique('ComunaUpdate'))
    const exam = await seedExamen(11000)
    const visit = await seedVisita(patient.id)
    const precioBase = await seedOrUsePrecioBase(27000)

    const result = await updateVisita(
      visitaForm({ id: visit.id, idPaciente: patient.id, fecha: '2026-05-06', costo: 999999 }, [], [exam.id]),
    )

    expect(result.success).toBe(true)

    const [updated] = await db.select({ costo: visits.costo }).from(visits).where(eq(visits.id, visit.id))
    expect(updated!.costo).toBe(11000 + precioBase.precio)
  })
})

describe('getVisitaFormPricingContext', () => {
  it('usa precio de examen por comuna sobre precio base', async () => {
    const comuna = unique('ComunaCtxExam')
    const patient = await seedPaciente(comuna)
    const exam = await seedExamen(5000)
    const [specific] = await db
      .insert(examPrices)
      .values({ idExamen: exam.id, tipoPrevision: 'fonasa', comuna, precio: 9000 })
      .returning()
    created.examPrices.push(specific!.id)

    const context = await getVisitaFormPricingContext(patient.id, [exam.id])

    expect(context.examPrices).toEqual([{ idExamen: exam.id, precioActual: 9000 }])
  })

  it('usa precio base de examen si no hay precio por comuna', async () => {
    const patient = await seedPaciente(unique('ComunaCtxExamBase'))
    const exam = await seedExamen(6500)

    const context = await getVisitaFormPricingContext(patient.id, [exam.id])

    expect(context.examPrices).toEqual([{ idExamen: exam.id, precioActual: 6500 }])
  })

  it('usa precio de visita de enfermería por comuna sobre precio base', async () => {
    const comuna = unique('ComunaCtxVisita')
    const patient = await seedPaciente(comuna)
    await seedOrUsePrecioBase(25000)
    await seedPrecioVisita(comuna, 42000)

    const context = await getVisitaFormPricingContext(patient.id, [])

    expect(context.nursingVisitPrice).toBe(42000)
  })

  it('usa precio base de visita de enfermería si no hay precio por comuna', async () => {
    const patient = await seedPaciente(unique('ComunaCtxVisitaBase'))
    const precioBase = await seedOrUsePrecioBase(26000)

    const context = await getVisitaFormPricingContext(patient.id, [])

    expect(context.nursingVisitPrice).toBe(precioBase.precio)
  })
})
