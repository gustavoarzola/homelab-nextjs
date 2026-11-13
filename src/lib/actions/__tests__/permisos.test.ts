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
import { deleteVisita } from '../visitas'

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
