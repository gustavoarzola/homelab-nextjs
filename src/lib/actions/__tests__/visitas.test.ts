// @ts-nocheck
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db'
import {
  addresses,
  healthInsurances,
  nursingVisitPrices,
  patients,
  procedures,
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
import { createVisita, getVisita, updateVisita } from '../visitas'

const created = {
  addresses: [] as number[],
  patients: [] as number[],
  healthInsurances: [] as number[],
  procedures: [] as number[],
  nursingVisitPrices: [] as number[],
  visits: [] as number[],
}

afterEach(async () => {
  await Promise.all([
    created.visits.length ? db.delete(visits).where(inArray(visits.id, created.visits)) : null,
    created.nursingVisitPrices.length
      ? db.delete(nursingVisitPrices).where(inArray(nursingVisitPrices.id, created.nursingVisitPrices))
      : null,
  ])
  await Promise.all([
    created.procedures.length ? db.delete(procedures).where(inArray(procedures.id, created.procedures)) : null,
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

async function seedPrecioVisita(comuna: string, precio: number) {
  const [row] = await db.insert(nursingVisitPrices).values({ comuna, precio }).returning()
  created.nursingVisitPrices.push(row!.id)
  return row!
}

function visitaForm(data: Record<string, string | number>, procedureIds: number[] = []) {
  const form = new FormData()
  Object.entries(data).forEach(([key, value]) => form.append(key, String(value)))
  procedureIds.forEach((id) => form.append('procedure_ids', String(id)))
  return form
}

describe('createVisita — descuento de visita + descuento de procedimiento + insumos', () => {
  it('descuento de tipo monto: persiste costo/montoDescuento/montoVisitaOriginal/montoDescuentoProcedimientos según calcularCostoVisitaPersistida', async () => {
    const comuna = unique('ComunaDescMonto')
    const patient = await seedPaciente(comuna)
    const proc = await seedProcedimiento(12000)
    await seedPrecioVisita(comuna, 30000)

    const result = await createVisita(
      visitaForm(
        {
          idPaciente: patient.id,
          fecha: '2026-03-10',
          cobraVisita: 'true',
          montoInsumos: 3000,
          descuentoTipo: 'monto',
          descuentoValor: 5000,
          descuentoAfectaPagoEnfermera: 'false',
          descuentoProcedimientosAfectaPagoEnfermera: 'true',
          [`procedimiento_descuento_${proc.id}`]: 2000,
        },
        [proc.id],
      ),
    )

    expect(result.success).toBe(true)
    const id = (result as { success: true; data: { id: number } }).data.id
    created.visits.push(id)

    const recompute = await calcularCostoVisitaPersistida(id)
    const [row] = await db.select().from(visits).where(eq(visits.id, id))

    expect(row!.montoVisitaOriginal).toBe(30000)
    expect(row!.montoDescuento).toBe(resolverMontoDescuento(30000, 'monto', 5000))
    expect(row!.montoDescuento).toBe(5000)
    expect(row!.montoDescuentoProcedimientos).toBe(2000)
    expect(row!.descuentoAfectaPagoEnfermera).toBe(false)
    expect(row!.descuentoProcedimientosAfectaPagoEnfermera).toBe(true)
    // procedimientos (12000-2000) + fee (30000-5000) + insumos 3000
    expect(row!.costo).toBe(10000 + 25000 + 3000)
    expect(row!.costo).toBe(recompute.total)
  })

  it('descuento de tipo porcentaje: se resuelve con resolverMontoDescuento antes de persistir', async () => {
    const comuna = unique('ComunaDescPct')
    const patient = await seedPaciente(comuna)
    await seedPrecioVisita(comuna, 40000)

    const result = await createVisita(
      visitaForm({
        idPaciente: patient.id,
        fecha: '2026-03-11',
        cobraVisita: 'true',
        descuentoTipo: 'porcentaje',
        descuentoValor: 25,
      }),
    )

    expect(result.success).toBe(true)
    const id = (result as { success: true; data: { id: number } }).data.id
    created.visits.push(id)

    const [row] = await db.select().from(visits).where(eq(visits.id, id))
    expect(row!.montoVisitaOriginal).toBe(40000)
    expect(row!.montoDescuento).toBe(10000) // 25% de 40000
    expect(row!.costo).toBe(30000)
  })

  it('si cobraVisita es false, el descuento de visita se ignora aunque se envíe descuentoValor', async () => {
    const comuna = unique('ComunaSinCobro')
    const patient = await seedPaciente(comuna)
    await seedPrecioVisita(comuna, 20000)

    const result = await createVisita(
      visitaForm({
        idPaciente: patient.id,
        fecha: '2026-03-12',
        cobraVisita: 'false',
        descuentoTipo: 'monto',
        descuentoValor: 9999,
      }),
    )

    expect(result.success).toBe(true)
    const id = (result as { success: true; data: { id: number } }).data.id
    created.visits.push(id)

    const [row] = await db.select().from(visits).where(eq(visits.id, id))
    expect(row!.descuentoValor).toBe(0)
    expect(row!.montoDescuento).toBe(0)
    expect(row!.montoVisitaOriginal).toBe(0)
    expect(row!.costo).toBe(0)
  })

  it('getVisita expone los campos de descuento/insumos persistidos y el descuento por línea de procedimiento', async () => {
    const comuna = unique('ComunaGetVisita')
    const patient = await seedPaciente(comuna)
    const proc = await seedProcedimiento(8000)
    await seedPrecioVisita(comuna, 15000)

    const result = await createVisita(
      visitaForm(
        {
          idPaciente: patient.id,
          fecha: '2026-03-13',
          cobraVisita: 'true',
          montoInsumos: 1500,
          descuentoTipo: 'monto',
          descuentoValor: 4000,
          [`procedimiento_descuento_${proc.id}`]: 1000,
        },
        [proc.id],
      ),
    )
    expect(result.success).toBe(true)
    const id = (result as { success: true; data: { id: number } }).data.id
    created.visits.push(id)

    const detalle = await getVisita(id)
    expect(detalle).not.toBeNull()
    expect(detalle!.descuentoTipo).toBe('monto')
    expect(detalle!.descuentoValor).toBe(4000)
    expect(detalle!.montoInsumos).toBe(1500)
    expect(detalle!.montoDescuento).toBe(4000)
    expect(detalle!.montoVisitaOriginal).toBe(15000)
    expect(detalle!.montoDescuentoProcedimientos).toBe(1000)
    expect(detalle!.procedurePrices).toEqual([{ idProcedimiento: proc.id, precio: 8000, descuento: 1000 }])
  })
})

describe('updateVisita — recalcula tras modificar descuentos e insumos', () => {
  it('actualiza descuento de visita, insumos y descuento de procedimiento, y recalcula costo', async () => {
    const comuna = unique('ComunaUpdateDesc')
    const patient = await seedPaciente(comuna)
    const proc = await seedProcedimiento(10000)
    await seedPrecioVisita(comuna, 20000)

    const createResult = await createVisita(
      visitaForm(
        {
          idPaciente: patient.id,
          fecha: '2026-03-14',
          cobraVisita: 'true',
          montoInsumos: 0,
          descuentoTipo: 'monto',
          descuentoValor: 0,
          [`procedimiento_descuento_${proc.id}`]: 0,
        },
        [proc.id],
      ),
    )
    expect(createResult.success).toBe(true)
    const id = (createResult as { success: true; data: { id: number } }).data.id
    created.visits.push(id)

    const updateResult = await updateVisita(
      visitaForm(
        {
          id,
          idPaciente: patient.id,
          fecha: '2026-03-14',
          cobraVisita: 'true',
          montoInsumos: 2500,
          descuentoTipo: 'porcentaje',
          descuentoValor: 10,
          descuentoAfectaPagoEnfermera: 'true',
          descuentoProcedimientosAfectaPagoEnfermera: 'true',
          [`procedimiento_descuento_${proc.id}`]: 4000,
        },
        [proc.id],
      ),
    )

    expect(updateResult.success).toBe(true)

    const recompute = await calcularCostoVisitaPersistida(id)
    const [row] = await db.select().from(visits).where(eq(visits.id, id))

    expect(row!.montoInsumos).toBe(2500)
    expect(row!.descuentoTipo).toBe('porcentaje')
    expect(row!.descuentoValor).toBe(10)
    expect(row!.montoDescuento).toBe(2000) // 10% de 20000
    expect(row!.montoDescuentoProcedimientos).toBe(4000)
    expect(row!.descuentoAfectaPagoEnfermera).toBe(true)
    expect(row!.descuentoProcedimientosAfectaPagoEnfermera).toBe(true)
    expect(row!.costo).toBe(recompute.total)
    // procedimientos (10000-4000) + fee (20000-2000) + insumos 2500
    expect(row!.costo).toBe(6000 + 18000 + 2500)
  })

  it('conserva el descuento de procedimiento existente si no se reenvía el campo (comportamiento ya cubierto en visitas-pricing.test.ts) sigue siendo consistente combinado con descuento de visita nuevo', async () => {
    const comuna = unique('ComunaUpdateDescCombo')
    const patient = await seedPaciente(comuna)
    const proc = await seedProcedimiento(9000)
    await seedPrecioVisita(comuna, 16000)

    const createResult = await createVisita(
      visitaForm(
        {
          idPaciente: patient.id,
          fecha: '2026-03-15',
          cobraVisita: 'false',
          [`procedimiento_descuento_${proc.id}`]: 3000,
        },
        [proc.id],
      ),
    )
    expect(createResult.success).toBe(true)
    const id = (createResult as { success: true; data: { id: number } }).data.id
    created.visits.push(id)

    // Reenvía el mismo procedimiento sin el campo de descuento (debe conservarse)
    // pero ahora activa el cobro de visita con descuento de monto.
    const updateResult = await updateVisita(
      visitaForm(
        {
          id,
          idPaciente: patient.id,
          fecha: '2026-03-15',
          cobraVisita: 'true',
          descuentoTipo: 'monto',
          descuentoValor: 6000,
        },
        [proc.id],
      ),
    )
    expect(updateResult.success).toBe(true)

    const recompute = await calcularCostoVisitaPersistida(id)
    const [row] = await db.select().from(visits).where(eq(visits.id, id))

    expect(row!.montoDescuentoProcedimientos).toBe(3000) // conservado
    expect(row!.montoVisitaOriginal).toBe(16000)
    expect(row!.montoDescuento).toBe(6000)
    expect(row!.costo).toBe(recompute.total)
    // procedimientos (9000-3000) + fee (16000-6000)
    expect(row!.costo).toBe(6000 + 10000)
  })
})
