// @ts-nocheck
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db'
import {
  addresses,
  exams,
  healthInsurances,
  nursingVisitPrices,
  patients,
  procedures,
  quotationProcedures,
  quotations,
  visitExams,
  visitProcedures,
  visits,
} from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { P } from './helpers'

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({ user: { id: 'test-user' } })),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  unstable_cache: (fn: any) => fn,
}))

import { calcularCostoVisitaPersistida } from '@/lib/pricing/visitas'
import { resolverMontoDescuento } from '@/lib/pricing/descuento'
import {
  convertirCotizacionAVisita,
  createCotizacion,
  getCotizacion,
  updateCotizacion,
} from '../cotizaciones'

const created = {
  addresses: [] as number[],
  patients: [] as number[],
  healthInsurances: [] as number[],
  procedures: [] as number[],
  exams: [] as number[],
  nursingVisitPrices: [] as number[],
  quotations: [] as number[],
  visits: [] as number[],
}

afterEach(async () => {
  await Promise.all([
    created.visits.length ? db.delete(visits).where(inArray(visits.id, created.visits)) : null,
    created.quotations.length ? db.delete(quotations).where(inArray(quotations.id, created.quotations)) : null,
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
  created.nursingVisitPrices = []
  created.quotations = []
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

async function seedExamen(precio = 5000) {
  const [row] = await db
    .insert(exams)
    .values({ nombre: unique('Examen'), codigo: unique('EX'), precio })
    .returning()
  created.exams.push(row!.id)
  return row!
}

async function seedPrecioVisita(comuna: string, precio: number) {
  const [row] = await db.insert(nursingVisitPrices).values({ comuna, precio }).returning()
  created.nursingVisitPrices.push(row!.id)
  return row!
}

function cotizacionForm(
  data: Record<string, string | number>,
  procedureIds: number[] = [],
  examIds: number[] = [],
) {
  const form = new FormData()
  Object.entries(data).forEach(([key, value]) => form.append(key, String(value)))
  procedureIds.forEach((id) => form.append('procedure_ids', String(id)))
  examIds.forEach((id) => form.append('exam_ids', String(id)))
  return form
}

describe('createCotizacion — descuento de visita + descuento de procedimiento + insumos', () => {
  it('persiste total/montoDescuento/montoVisitaOriginal/montoDescuentoProcedimientos según la misma fórmula de costo', async () => {
    const comuna = unique('ComunaCotiCreate')
    const patient = await seedPaciente(comuna)
    const proc = await seedProcedimiento(10000)
    const exam = await seedExamen(4000)
    await seedPrecioVisita(comuna, 25000)

    const result = await createCotizacion(
      cotizacionForm(
        {
          idPaciente: patient.id,
          comuna,
          cobraVisita: 'true',
          montoInsumos: 2000,
          descuentoTipo: 'monto',
          descuentoValor: 5000,
          descuentoAfectaPagoEnfermera: 'false',
          descuentoProcedimientosAfectaPagoEnfermera: 'true',
          [`procedimiento_descuento_${proc.id}`]: 3000,
        },
        [proc.id],
        [exam.id],
      ),
    )

    expect(result.success).toBe(true)
    const id = (result as { success: true; data: { id: number } }).data.id
    created.quotations.push(id)

    const [row] = await db.select().from(quotations).where(eq(quotations.id, id))
    expect(row!.montoVisitaOriginal).toBe(25000)
    expect(row!.montoDescuento).toBe(resolverMontoDescuento(25000, 'monto', 5000))
    expect(row!.montoDescuentoProcedimientos).toBe(3000)
    // procedimientos (10000-3000) + examen 4000 + fee (25000-5000) + insumos 2000
    expect(row!.total).toBe(7000 + 4000 + 20000 + 2000)

    const [procRow] = await db
      .select({ descuento: quotationProcedures.descuento })
      .from(quotationProcedures)
      .where(eq(quotationProcedures.idCotizacion, id))
    expect(procRow!.descuento).toBe(3000)
  })
})

describe('updateCotizacion — recalcula tras modificar descuentos e insumos', () => {
  it('reemplaza items y recalcula total', async () => {
    const comuna = unique('ComunaCotiUpdate')
    const patient = await seedPaciente(comuna)
    const proc = await seedProcedimiento(8000)
    await seedPrecioVisita(comuna, 18000)

    const createResult = await createCotizacion(
      cotizacionForm({ idPaciente: patient.id, comuna, cobraVisita: 'true' }, [proc.id]),
    )
    expect(createResult.success).toBe(true)
    const id = (createResult as { success: true; data: { id: number } }).data.id
    created.quotations.push(id)

    const updateResult = await updateCotizacion(
      cotizacionForm(
        {
          id,
          idPaciente: patient.id,
          comuna,
          cobraVisita: 'true',
          montoInsumos: 1000,
          descuentoTipo: 'porcentaje',
          descuentoValor: 20,
          [`procedimiento_descuento_${proc.id}`]: 2000,
        },
        [proc.id],
      ),
    )
    expect(updateResult.success).toBe(true)

    const [row] = await db.select().from(quotations).where(eq(quotations.id, id))
    expect(row!.montoDescuento).toBe(3600) // 20% de 18000
    expect(row!.montoDescuentoProcedimientos).toBe(2000)
    expect(row!.montoInsumos).toBe(1000)
    // procedimientos (8000-2000) + fee (18000-3600) + insumos 1000
    expect(row!.total).toBe(6000 + 14400 + 1000)

    const procRows = await db.select().from(quotationProcedures).where(eq(quotationProcedures.idCotizacion, id))
    expect(procRows).toHaveLength(1)
    expect(procRows[0]!.descuento).toBe(2000)
  })
})

describe('getCotizacion', () => {
  it('expone los campos de descuento/insumos y el detalle de items', async () => {
    const comuna = unique('ComunaCotiGet')
    const patient = await seedPaciente(comuna)
    const proc = await seedProcedimiento(6000)
    await seedPrecioVisita(comuna, 12000)

    const createResult = await createCotizacion(
      cotizacionForm(
        {
          idPaciente: patient.id,
          comuna,
          cobraVisita: 'true',
          montoInsumos: 500,
          descuentoTipo: 'monto',
          descuentoValor: 1000,
          [`procedimiento_descuento_${proc.id}`]: 1500,
        },
        [proc.id],
      ),
    )
    const id = (createResult as { success: true; data: { id: number } }).data.id
    created.quotations.push(id)

    const detalle = await getCotizacion(id)
    expect(detalle).not.toBeNull()
    expect(detalle!.montoInsumos).toBe(500)
    expect(detalle!.descuentoTipo).toBe('monto')
    expect(detalle!.descuentoValor).toBe(1000)
    expect(detalle!.montoVisitaOriginal).toBe(12000)
    expect(detalle!.montoDescuento).toBe(1000)
    expect(detalle!.montoDescuentoProcedimientos).toBe(1500)
    expect(detalle!.procedurePrices).toEqual([{ idProcedimiento: proc.id, precio: 6000, descuento: 1500 }])
  })
})

describe('convertirCotizacionAVisita', () => {
  it('copia items y campos de descuento/insumos a la visita resultante, y marca la cotización aceptada', async () => {
    const comuna = unique('ComunaCotiConvert')
    const patient = await seedPaciente(comuna)
    const proc = await seedProcedimiento(9000)
    const exam = await seedExamen(3000)
    await seedPrecioVisita(comuna, 22000)

    const createResult = await createCotizacion(
      cotizacionForm(
        {
          idPaciente: patient.id,
          comuna,
          cobraVisita: 'true',
          montoInsumos: 1200,
          descuentoTipo: 'porcentaje',
          descuentoValor: 10,
          descuentoAfectaPagoEnfermera: 'true',
          descuentoProcedimientosAfectaPagoEnfermera: 'false',
          [`procedimiento_descuento_${proc.id}`]: 2500,
        },
        [proc.id],
        [exam.id],
      ),
    )
    expect(createResult.success).toBe(true)
    const quotationId = (createResult as { success: true; data: { id: number } }).data.id
    created.quotations.push(quotationId)

    const [quotationBefore] = await db.select().from(quotations).where(eq(quotations.id, quotationId))

    const convertResult = await convertirCotizacionAVisita(quotationId)
    expect(convertResult.success).toBe(true)
    const visitId = (convertResult as { success: true; data: { idVisita: number } }).data.idVisita
    created.visits.push(visitId)

    const [visitRow] = await db.select().from(visits).where(eq(visits.id, visitId))
    expect(visitRow!.costo).toBe(quotationBefore!.total)
    expect(visitRow!.montoInsumos).toBe(quotationBefore!.montoInsumos)
    expect(visitRow!.cobraVisita).toBe(quotationBefore!.cobraVisita)
    expect(visitRow!.descuentoTipo).toBe(quotationBefore!.descuentoTipo)
    expect(visitRow!.descuentoValor).toBe(quotationBefore!.descuentoValor)
    expect(visitRow!.montoDescuento).toBe(quotationBefore!.montoDescuento)
    expect(visitRow!.montoVisitaOriginal).toBe(quotationBefore!.montoVisitaOriginal)
    expect(visitRow!.descuentoAfectaPagoEnfermera).toBe(quotationBefore!.descuentoAfectaPagoEnfermera)
    expect(visitRow!.montoDescuentoProcedimientos).toBe(quotationBefore!.montoDescuentoProcedimientos)
    expect(visitRow!.descuentoProcedimientosAfectaPagoEnfermera).toBe(
      quotationBefore!.descuentoProcedimientosAfectaPagoEnfermera,
    )

    const [visitProcRow] = await db.select().from(visitProcedures).where(eq(visitProcedures.idVisita, visitId))
    expect(visitProcRow!.idProcedimiento).toBe(proc.id)
    expect(visitProcRow!.precio).toBe(9000)
    expect(visitProcRow!.descuento).toBe(2500)

    const [visitExamRow] = await db.select().from(visitExams).where(eq(visitExams.idVisita, visitId))
    expect(visitExamRow!.idExamen).toBe(exam.id)
    expect(visitExamRow!.precio).toBe(3000)

    const [quotationAfter] = await db.select().from(quotations).where(eq(quotations.id, quotationId))
    expect(quotationAfter!.estado).toBe('aceptada')
    expect(quotationAfter!.idVisita).toBe(visitId)

    // Invariante adicional: la comuna del paciente coincide con la comuna de la
    // cotización y hay un precio de visita sembrado para esa misma comuna, así
    // que recalcular la visita con la fórmula real (`calcularCostoVisitaPersistida`)
    // debe coincidir con el costo copiado desde la cotización.
    const recompute = await calcularCostoVisitaPersistida(visitId)
    expect(recompute.total).toBe(visitRow!.costo)
  })

  it('cuando la cotización no tiene paciente, requiere idPatient explícito para convertir', async () => {
    const comuna = unique('ComunaCotiSinPaciente')
    await seedPrecioVisita(comuna, 15000)
    const patient = await seedPaciente(comuna)

    const createResult = await createCotizacion(
      cotizacionForm({
        nombreDestinatario: unique('Destinatario'),
        comuna,
        cobraVisita: 'false',
      }),
    )
    expect(createResult.success).toBe(true)
    const quotationId = (createResult as { success: true; data: { id: number } }).data.id
    created.quotations.push(quotationId)

    const withoutPatient = await convertirCotizacionAVisita(quotationId)
    expect(withoutPatient.success).toBe(false)

    const withPatient = await convertirCotizacionAVisita(quotationId, patient.id)
    expect(withPatient.success).toBe(true)
    const visitId = (withPatient as { success: true; data: { idVisita: number } }).data.idVisita
    created.visits.push(visitId)

    const [visitRow] = await db.select({ idPaciente: visits.idPaciente }).from(visits).where(eq(visits.id, visitId))
    expect(visitRow!.idPaciente).toBe(patient.id)
  })
})
