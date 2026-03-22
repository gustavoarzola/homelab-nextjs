import { describe, it, expect, vi, afterAll } from 'vitest'
import { db } from '@/db'
import { laboratories, branches } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import {
  createCadena,
  updateCadena,
  toggleCadena,
  createSucursal,
  updateSucursal,
  toggleSucursal,
} from '../laboratorios'

// ─── helpers ─────────────────────────────────────────────────────────────────

const P = `_test_${Date.now()}_` // unique prefix for this test run

function fd(data: Record<string, string | number>): FormData {
  const form = new FormData()
  Object.entries(data).forEach(([k, v]) => form.append(k, String(v)))
  return form
}

const createdLabs: number[] = []
const createdBranches: number[] = []

/** Insert a lab directly and track its id for cleanup */
async function seedLab(nombre: string) {
  const [row] = await db
    .insert(laboratories)
    .values({ nombre: `${P}${nombre}` })
    .returning()
  createdLabs.push(row.id)
  return row
}

/** Insert a branch directly and track its id for cleanup */
async function seedBranch(nombre: string, idLaboratorio: number) {
  const [row] = await db
    .insert(branches)
    .values({ nombre: `${P}${nombre}`, idLaboratorio })
    .returning()
  createdBranches.push(row.id)
  return row
}

afterAll(async () => {
  if (createdBranches.length)
    await db.delete(branches).where(inArray(branches.id, createdBranches))
  if (createdLabs.length)
    await db.delete(laboratories).where(inArray(laboratories.id, createdLabs))
})

// ─── createCadena ─────────────────────────────────────────────────────────────

describe('createCadena', () => {
  it('inserta una cadena y devuelve success', async () => {
    const nombre = `${P}Laboratorio A`
    const result = await createCadena(fd({ nombre }))

    expect(result.success).toBe(true)

    const [row] = await db.select().from(laboratories).where(eq(laboratories.nombre, nombre))
    expect(row).toBeDefined()
    expect(row.activo).toBe(true)
    createdLabs.push(row.id)
  })

  it('rechaza nombre vacío', async () => {
    const result = await createCadena(fd({ nombre: '' }))
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rechaza nombre solo con espacios', async () => {
    const result = await createCadena(fd({ nombre: '   ' }))
    expect(result.success).toBe(false)
  })
})

// ─── updateCadena ─────────────────────────────────────────────────────────────

describe('updateCadena', () => {
  it('actualiza el nombre de una cadena existente', async () => {
    const lab = await seedLab('Para editar')
    const nuevoNombre = `${P}Nombre editado`

    const result = await updateCadena(fd({ id: lab.id, nombre: nuevoNombre }))

    expect(result.success).toBe(true)

    const [updated] = await db.select().from(laboratories).where(eq(laboratories.id, lab.id))
    expect(updated.nombre).toBe(nuevoNombre)
  })

  it('rechaza nombre vacío', async () => {
    const lab = await seedLab('Nombre vacío update')
    const result = await updateCadena(fd({ id: lab.id, nombre: '' }))
    expect(result.success).toBe(false)
  })

  it('rechaza id inválido', async () => {
    const result = await updateCadena(fd({ id: 0, nombre: 'algo' }))
    expect(result.success).toBe(false)
  })
})

// ─── toggleCadena ─────────────────────────────────────────────────────────────

describe('toggleCadena', () => {
  it('desactiva una cadena activa', async () => {
    const lab = await seedLab('Toggle off')
    expect(lab.activo).toBe(true)

    const result = await toggleCadena(lab.id, true)
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(laboratories).where(eq(laboratories.id, lab.id))
    expect(updated.activo).toBe(false)
  })

  it('activa una cadena inactiva', async () => {
    const lab = await seedLab('Toggle on')
    await db.update(laboratories).set({ activo: false }).where(eq(laboratories.id, lab.id))

    const result = await toggleCadena(lab.id, false)
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(laboratories).where(eq(laboratories.id, lab.id))
    expect(updated.activo).toBe(true)
  })
})

// ─── createSucursal ───────────────────────────────────────────────────────────

describe('createSucursal', () => {
  it('inserta una sucursal asociada a una cadena', async () => {
    const lab = await seedLab('Para sucursal')
    const nombre = `${P}Sucursal Norte`

    const result = await createSucursal(fd({ nombre, idLaboratorio: lab.id }))
    expect(result.success).toBe(true)

    const [row] = await db.select().from(branches).where(eq(branches.nombre, nombre))
    expect(row).toBeDefined()
    expect(row.idLaboratorio).toBe(lab.id)
    expect(row.activo).toBe(true)
    createdBranches.push(row.id)
  })

  it('rechaza nombre vacío', async () => {
    const lab = await seedLab('Lab nombre vacío')
    const result = await createSucursal(fd({ nombre: '', idLaboratorio: lab.id }))
    expect(result.success).toBe(false)
  })

  it('rechaza sin idLaboratorio', async () => {
    const result = await createSucursal(fd({ nombre: `${P}Sin lab`, idLaboratorio: 0 }))
    expect(result.success).toBe(false)
  })
})

// ─── updateSucursal ───────────────────────────────────────────────────────────

describe('updateSucursal', () => {
  it('actualiza nombre y cadena de una sucursal', async () => {
    const lab1 = await seedLab('Lab origen')
    const lab2 = await seedLab('Lab destino')
    const branch = await seedBranch('Sucursal antes', lab1.id)
    const nuevoNombre = `${P}Sucursal después`

    const result = await updateSucursal(
      fd({ id: branch.id, nombre: nuevoNombre, idLaboratorio: lab2.id })
    )
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(branches).where(eq(branches.id, branch.id))
    expect(updated.nombre).toBe(nuevoNombre)
    expect(updated.idLaboratorio).toBe(lab2.id)
  })

  it('rechaza nombre vacío', async () => {
    const lab = await seedLab('Lab update vacio')
    const branch = await seedBranch('Sucursal update vacío', lab.id)
    const result = await updateSucursal(fd({ id: branch.id, nombre: '', idLaboratorio: lab.id }))
    expect(result.success).toBe(false)
  })
})

// ─── toggleSucursal ───────────────────────────────────────────────────────────

describe('toggleSucursal', () => {
  it('desactiva una sucursal activa', async () => {
    const lab = await seedLab('Lab toggle suc')
    const branch = await seedBranch('Sucursal toggle off', lab.id)

    const result = await toggleSucursal(branch.id, true)
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(branches).where(eq(branches.id, branch.id))
    expect(updated.activo).toBe(false)
  })

  it('activa una sucursal inactiva', async () => {
    const lab = await seedLab('Lab toggle suc on')
    const branch = await seedBranch('Sucursal toggle on', lab.id)
    await db.update(branches).set({ activo: false }).where(eq(branches.id, branch.id))

    const result = await toggleSucursal(branch.id, false)
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(branches).where(eq(branches.id, branch.id))
    expect(updated.activo).toBe(true)
  })
})
