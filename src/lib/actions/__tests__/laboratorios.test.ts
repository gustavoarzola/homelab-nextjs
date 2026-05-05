// @ts-nocheck
import { describe, it, expect, vi, afterAll } from 'vitest'
import { db } from '@/db'
import { laboratories } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { P, fd } from './helpers'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import {
  createLaboratorio,
  updateLaboratorio,
  toggleLaboratorio,
} from '../laboratorios'

const createdLabs: number[] = []

/** Insert a lab directly and track its id for cleanup */
async function seedLab(nombre: string) {
  const [row] = await db
    .insert(laboratories)
    .values({ nombre: `${P}${nombre}` })
    .returning()
  createdLabs.push(row!.id)
  return row!
}

afterAll(async () => {
  if (createdLabs.length) {
    const { inArray } = await import('drizzle-orm')
    await db.delete(laboratories).where(inArray(laboratories.id, createdLabs))
  }
})

// ─── createLaboratorio ─────────────────────────────────────────────────────────────

describe('createLaboratorio', () => {
  it('inserta un laboratorio y devuelve success', async () => {
    const nombre = `${P}Laboratorio A`
    const result = await createLaboratorio(fd({ nombre }))

    expect(result.success).toBe(true)

    const [row] = await db.select().from(laboratories).where(eq(laboratories.nombre, nombre))
    expect(row).toBeDefined()
    expect(row.activo).toBe(true)
    createdLabs.push(row.id)
  })

  it('rechaza nombre vacío', async () => {
    const result = await createLaboratorio(fd({ nombre: '' }))
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rechaza nombre solo con espacios', async () => {
    const result = await createLaboratorio(fd({ nombre: '   ' }))
    expect(result.success).toBe(false)
  })
})

// ─── updateLaboratorio ─────────────────────────────────────────────────────────────

describe('updateLaboratorio', () => {
  it('actualiza el nombre de un laboratorio existente', async () => {
    const lab = await seedLab('Para editar')
    const nuevoNombre = `${P}Nombre editado`

    const result = await updateLaboratorio(fd({ id: lab.id, nombre: nuevoNombre }))

    expect(result.success).toBe(true)

    const [updated] = await db.select().from(laboratories).where(eq(laboratories.id, lab.id))
    expect(updated.nombre).toBe(nuevoNombre)
  })

  it('rechaza nombre vacío', async () => {
    const lab = await seedLab('Nombre vacío update')
    const result = await updateLaboratorio(fd({ id: lab.id, nombre: '' }))
    expect(result.success).toBe(false)
  })

  it('rechaza id inválido', async () => {
    const result = await updateLaboratorio(fd({ id: 0, nombre: 'algo' }))
    expect(result.success).toBe(false)
  })
})

// ─── toggleLaboratorio ─────────────────────────────────────────────────────────────

describe('toggleLaboratorio', () => {
  it('desactiva un laboratorio activo', async () => {
    const lab = await seedLab('Toggle off')
    expect(lab.activo).toBe(true)

    const result = await toggleLaboratorio(lab.id, true)
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(laboratories).where(eq(laboratories.id, lab.id))
    expect(updated.activo).toBe(false)
  })

  it('activa un laboratorio inactivo', async () => {
    const lab = await seedLab('Toggle on')
    await db.update(laboratories).set({ activo: false }).where(eq(laboratories.id, lab.id))

    const result = await toggleLaboratorio(lab.id, false)
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(laboratories).where(eq(laboratories.id, lab.id))
    expect(updated.activo).toBe(true)
  })
})
