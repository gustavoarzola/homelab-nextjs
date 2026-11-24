// @ts-nocheck
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db'
import { auth } from '@/auth'
import { addresses, comunas, patients, visits } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { P, fd } from './helpers'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unstable_cache: (fn: any) => fn,
}))

import { createExamen, toggleProcedimiento, createTaller, createTipoRecargo, createComuna } from '../catalogos'
import { createPrecioVisita, togglePrecioVisita } from '../precios'
import { deleteVisita, cambiarEstadoVisita } from '../visitas'

const DENIED = { success: false, error: 'No tienes permisos para realizar esta acción' }

function asRole(role: string) {
  vi.mocked(auth).mockImplementation(async () => ({ user: { id: 'test-user', role } }))
}

const created = { addresses: [] as number[], patients: [] as number[], visits: [] as number[] }

afterEach(() => {
  asRole('admin')
})

afterAll(async () => {
  if (created.visits.length) await db.delete(visits).where(inArray(visits.id, created.visits))
  if (created.patients.length) await db.delete(patients).where(inArray(patients.id, created.patients))
  if (created.addresses.length) await db.delete(addresses).where(inArray(addresses.id, created.addresses))
  await db.delete(comunas).where(eq(comunas.nombre, `${P}Comuna`))
})

async function seedVisita(estado: string) {
  const [address] = await db.insert(addresses).values({ direccion: `${P}dir` }).returning()
  created.addresses.push(address.id)
  const [patient] = await db
    .insert(patients)
    .values({ nombres: `${P}Paciente`, apellidoPaterno: 'Test', idDireccion: address.id })
    .returning()
  created.patients.push(patient.id)
  const [visit] = await db
    .insert(visits)
    .values({ idPaciente: patient.id, fecha: '2026-01-15', estado })
    .returning()
  created.visits.push(visit.id)
  return visit
}

describe('mutaciones solo-admin con rol ejecutivo', () => {
  it('rechaza crear/modificar exámenes, procedimientos, talleres y recargos', async () => {
    asRole('ejecutivo')
    expect(await createExamen(fd({ nombre: `${P}Examen`, precio: 1000 }))).toEqual(DENIED)
    expect(await toggleProcedimiento(1, true)).toEqual(DENIED)
    expect(await createTaller(fd({ nombre: `${P}Taller` }))).toEqual(DENIED)
    expect(await createTipoRecargo(fd({ nombre: `${P}Recargo`, precio: 1000 }))).toEqual(DENIED)
  })

  it('rechaza crear/modificar precios de visita', async () => {
    asRole('ejecutivo')
    expect(await createPrecioVisita(fd({ precio: 1000 }))).toEqual(DENIED)
    expect(await togglePrecioVisita(1, true)).toEqual(DENIED)
  })

  it('sigue permitiendo catálogos no restringidos (comunas)', async () => {
    asRole('ejecutivo')
    const res = await createComuna(fd({ nombre: `${P}Comuna` }))
    expect(res).toEqual({ success: true })
  })
})

describe('deleteVisita', () => {
  it('ejecutivo no puede eliminar visitas realizadas o completadas', async () => {
    for (const estado of ['realizada', 'completada']) {
      const visit = await seedVisita(estado)
      asRole('ejecutivo')
      const res = await deleteVisita(visit.id)
      expect(res.success).toBe(false)
      const [still] = await db.select({ id: visits.id }).from(visits).where(eq(visits.id, visit.id))
      expect(still).toBeDefined()
    }
  })

  it('ejecutivo puede eliminar visitas en otros estados', async () => {
    const visit = await seedVisita('programada')
    asRole('ejecutivo')
    expect(await deleteVisita(visit.id)).toEqual({ success: true })
  })

  it('admin puede eliminar visitas completadas', async () => {
    const visit = await seedVisita('completada')
    asRole('admin')
    expect(await deleteVisita(visit.id)).toEqual({ success: true })
  })
})

describe('cambiarEstadoVisita', () => {
  async function estadoDe(id: number) {
    const [row] = await db.select().from(visits).where(eq(visits.id, id))
    return row
  }

  it('ejecutivo no puede cambiar el estado', async () => {
    const visit = await seedVisita('completada')
    asRole('ejecutivo')
    const res = await cambiarEstadoVisita(visit.id, 'programada')
    expect(res.success).toBe(false)
    expect((await estadoDe(visit.id)).estado).toBe('completada')
  })

  it('admin devuelve una visita completada a programada conservando la facturación', async () => {
    const visit = await seedVisita('completada')
    await db.update(visits).set({ numeroBoleta: `${P}B1`, tipoDocumento: 'boleta', pagado: true }).where(eq(visits.id, visit.id))
    asRole('admin')
    expect(await cambiarEstadoVisita(visit.id, 'programada')).toEqual({ success: true })
    const row = await estadoDe(visit.id)
    expect(row.estado).toBe('programada')
    expect(row.numeroBoleta).toBe(`${P}B1`)
    expect(row.pagado).toBe(true)
  })

  it('admin reabre una visita cancelada y limpia el motivo', async () => {
    const visit = await seedVisita('cancelada')
    await db.update(visits).set({ motivoCancelacion: 'error' }).where(eq(visits.id, visit.id))
    expect(await cambiarEstadoVisita(visit.id, 'confirmada')).toEqual({ success: true })
    const row = await estadoDe(visit.id)
    expect(row.estado).toBe('confirmada')
    expect(row.motivoCancelacion).toBeNull()
  })

  it('rechaza estados terminales y realizada sin enfermera', async () => {
    const visit = await seedVisita('programada')
    expect((await cambiarEstadoVisita(visit.id, 'completada')).success).toBe(false)
    expect((await cambiarEstadoVisita(visit.id, 'cancelada')).success).toBe(false)
    expect((await cambiarEstadoVisita(visit.id, 'realizada')).success).toBe(false)
    expect((await estadoDe(visit.id)).estado).toBe('programada')
  })
})
