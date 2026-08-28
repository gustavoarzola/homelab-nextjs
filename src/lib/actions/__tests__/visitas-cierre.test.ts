// @ts-nocheck
import { afterAll, describe, expect, it, vi } from 'vitest'
import { db } from '@/db'
import { addresses, patients, nurses, exams, visits, visitExams, visitExamResults } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { P } from './helpers'

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({ user: { id: 'test-user' } })),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  unstable_cache: (fn: any) => fn,
}))

import {
  guardarFacturacionVisita,
  guardarPagoVisita,
  guardarEnvioExamenesVisita,
  completarVisita,
} from '../visitas'

const created = {
  addresses: [] as number[],
  patients: [] as number[],
  nurses: [] as number[],
  exams: [] as number[],
  visits: [] as number[],
}

afterAll(async () => {
  await Promise.all([created.visits.length ? db.delete(visits).where(inArray(visits.id, created.visits)) : null])
  await Promise.all([
    created.patients.length ? db.delete(patients).where(inArray(patients.id, created.patients)) : null,
    created.nurses.length ? db.delete(nurses).where(inArray(nurses.id, created.nurses)) : null,
    created.exams.length ? db.delete(exams).where(inArray(exams.id, created.exams)) : null,
  ])
  await Promise.all([
    created.addresses.length ? db.delete(addresses).where(inArray(addresses.id, created.addresses)) : null,
  ])
})

function unique(label: string) {
  return `${P}${label}_${Math.random().toString(36).slice(2, 8)}`
}

async function seedPaciente() {
  const [address] = await db.insert(addresses).values({ direccion: unique('direccion'), areaAdministrativa3: 'Santiago' }).returning()
  created.addresses.push(address!.id)
  const [patient] = await db.insert(patients).values({ nombres: unique('Paciente'), apellidoPaterno: 'Test', idDireccion: address!.id }).returning()
  created.patients.push(patient!.id)
  return patient!
}

async function seedEnfermera() {
  const [nurse] = await db.insert(nurses).values({ nombres: unique('Enfermera'), apellidoPaterno: 'Test' }).returning()
  created.nurses.push(nurse!.id)
  return nurse!
}

async function seedExamen() {
  const [exam] = await db.insert(exams).values({ nombre: unique('Examen'), codigo: unique('EX'), grupoExamen: 'imalab' }).returning()
  created.exams.push(exam!.id)
  return exam!
}

async function seedVisitaRealizada(fecha: string, options: { conExamenes?: boolean } = {}) {
  const patient = await seedPaciente()
  const nurse = await seedEnfermera()
  const [visit] = await db.insert(visits).values({
    fecha,
    estado: 'realizada',
    idPaciente: patient.id,
    idEnfermera: nurse.id,
  }).returning()
  created.visits.push(visit!.id)

  if (options.conExamenes) {
    const exam = await seedExamen()
    await db.insert(visitExams).values({ idExamen: exam.id, idVisita: visit!.id, precio: 5000 })
    await db.update(visits).set({ resultadosTotalCount: 1 }).where(eq(visits.id, visit!.id))
    return { visit: visit!, exam }
  }

  return { visit: visit!, exam: null }
}

async function seedVisitaEnEstado(estado: string, fecha: string) {
  const patient = await seedPaciente()
  const [visit] = await db.insert(visits).values({ fecha, estado, idPaciente: patient.id }).returning()
  created.visits.push(visit!.id)
  return visit!
}

describe('guardado parcial de facturación', () => {
  it('persiste boleta/tipo documento sin cambiar el estado de la visita', async () => {
    const { visit } = await seedVisitaRealizada('2099-01-10')

    const result = await guardarFacturacionVisita(visit.id, {
      tipoDocumento: 'boleta',
      numeroBoleta: '000123',
      numeroAtencion: null,
    })
    expect(result.success).toBe(true)

    const [row] = await db.select().from(visits).where(eq(visits.id, visit.id))
    expect(row!.estado).toBe('realizada')
    expect(row!.numeroBoleta).toBe('000123')
    expect(row!.tipoDocumento).toBe('boleta')
  })

  it('rechaza N° de boleta duplicado para el mismo tipo de documento', async () => {
    const { visit: v1 } = await seedVisitaRealizada('2099-01-11')
    const { visit: v2 } = await seedVisitaRealizada('2099-01-11')

    const boleta = unique('boleta').slice(0, 20)
    const first = await guardarFacturacionVisita(v1.id, { tipoDocumento: 'boleta', numeroBoleta: boleta, numeroAtencion: null })
    expect(first.success).toBe(true)

    const second = await guardarFacturacionVisita(v2.id, { tipoDocumento: 'boleta', numeroBoleta: boleta, numeroAtencion: null })
    expect(second.success).toBe(false)
    expect(second.error).toMatch(/Ya existe una boleta/)
  })

  it('falla si la visita no está en estado realizada', async () => {
    const visit = await seedVisitaEnEstado('confirmada', '2099-01-12')
    const result = await guardarFacturacionVisita(visit.id, { tipoDocumento: 'boleta', numeroBoleta: '999', numeroAtencion: null })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Solo se puede completar una visita realizada/)
  })
})

describe('guardado parcial de pago', () => {
  it('persiste pagado=true sin método ni fecha (guardado parcial) y la visita sigue realizada', async () => {
    const { visit } = await seedVisitaRealizada('2099-01-13')

    const result = await guardarPagoVisita(visit.id, { pagado: true, metodoPago: null, fechaPago: null })
    expect(result.success).toBe(true)

    const [row] = await db.select().from(visits).where(eq(visits.id, visit.id))
    expect(row!.estado).toBe('realizada')
    expect(row!.pagado).toBe(true)
    expect(row!.metodoPago).toBeNull()
    expect(row!.fechaPago).toBeNull()
  })

  it('limpia método y fecha si se desmarca como pagada', async () => {
    const { visit } = await seedVisitaRealizada('2099-01-14')
    await guardarPagoVisita(visit.id, { pagado: true, metodoPago: 'Efectivo', fechaPago: '2099-01-14' })

    const result = await guardarPagoVisita(visit.id, { pagado: false, metodoPago: 'Efectivo', fechaPago: '2099-01-14' })
    expect(result.success).toBe(true)

    const [row] = await db.select().from(visits).where(eq(visits.id, visit.id))
    expect(row!.pagado).toBe(false)
    expect(row!.metodoPago).toBeNull()
    expect(row!.fechaPago).toBeNull()
  })
})

describe('guardado parcial de envío de exámenes', () => {
  it('permite marcar solo algunos exámenes como enviados y actualiza los contadores', async () => {
    const { visit, exam } = await seedVisitaRealizada('2099-01-15', { conExamenes: true })

    const result = await guardarEnvioExamenesVisita(visit.id, [
      { idExamen: exam!.id, enviado: true, fechaEnvio: '2099-01-15' },
    ])
    expect(result.success).toBe(true)

    const [row] = await db.select().from(visits).where(eq(visits.id, visit.id))
    expect(row!.estado).toBe('realizada')
    expect(row!.resultadosEnviadosCount).toBe(1)
    expect(row!.resultadosTotalCount).toBe(1)

    const [resultRow] = await db.select().from(visitExamResults).where(eq(visitExamResults.idVisita, visit.id))
    expect(resultRow!.enviado).toBe(true)
    expect(resultRow!.fechaEnvio).toBe('2099-01-15')
  })

  it('rechaza un examen que no pertenece a la visita', async () => {
    const { visit } = await seedVisitaRealizada('2099-01-16', { conExamenes: true })
    const otroExamen = await seedExamen()

    const result = await guardarEnvioExamenesVisita(visit.id, [
      { idExamen: otroExamen.id, enviado: true, fechaEnvio: '2099-01-16' },
    ])
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/no pertenece a esta visita/)
  })
})

describe('completarVisita tras guardados parciales', () => {
  it('completa la visita usando lo guardado en pasadas separadas', async () => {
    const { visit, exam } = await seedVisitaRealizada('2099-01-17', { conExamenes: true })

    await guardarFacturacionVisita(visit.id, { tipoDocumento: 'boleta', numeroBoleta: unique('bol').slice(0, 20), numeroAtencion: null })
    await guardarPagoVisita(visit.id, { pagado: true, metodoPago: 'Efectivo', fechaPago: '2099-01-17' })
    await guardarEnvioExamenesVisita(visit.id, [{ idExamen: exam!.id, enviado: true, fechaEnvio: '2099-01-17' }])

    const [before] = await db.select().from(visits).where(eq(visits.id, visit.id))

    const result = await completarVisita(visit.id, {
      tipoDocumento: before!.tipoDocumento as 'boleta' | 'factura',
      numeroBoleta: before!.numeroBoleta!,
      numeroAtencion: before!.numeroAtencion,
      pagado: before!.pagado,
      metodoPago: before!.metodoPago,
      fechaPago: before!.fechaPago,
      examenes: [{ idExamen: exam!.id, fechaEnvio: '2099-01-17' }],
    })
    expect(result.success).toBe(true)

    const [after] = await db.select().from(visits).where(eq(visits.id, visit.id))
    expect(after!.estado).toBe('completada')
  })

  it('sigue exigiendo los 3 pasos completos — falla si falta el pago', async () => {
    const { visit, exam } = await seedVisitaRealizada('2099-01-18', { conExamenes: true })
    await guardarFacturacionVisita(visit.id, { tipoDocumento: 'boleta', numeroBoleta: unique('bol').slice(0, 20), numeroAtencion: null })
    await guardarEnvioExamenesVisita(visit.id, [{ idExamen: exam!.id, enviado: true, fechaEnvio: '2099-01-18' }])

    const [row] = await db.select().from(visits).where(eq(visits.id, visit.id))
    const result = await completarVisita(visit.id, {
      tipoDocumento: row!.tipoDocumento as 'boleta' | 'factura',
      numeroBoleta: row!.numeroBoleta!,
      numeroAtencion: null,
      pagado: false,
      metodoPago: null,
      fechaPago: null,
      examenes: [{ idExamen: exam!.id, fechaEnvio: '2099-01-18' }],
    })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/pagada/)

    const [after] = await db.select().from(visits).where(eq(visits.id, visit.id))
    expect(after!.estado).toBe('realizada')
  })
})
