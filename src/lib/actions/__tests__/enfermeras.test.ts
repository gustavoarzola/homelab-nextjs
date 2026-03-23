import { describe, it, expect, vi, afterAll } from 'vitest'
import { db } from '@/db'
import { nurses, visits } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { P, fd } from './helpers'
import { validateRut } from '@/lib/rut'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import {
  createEnfermera,
  updateEnfermera,
  toggleEnfermera,
  deleteEnfermera,
} from '../enfermeras'

// ─── helpers ─────────────────────────────────────────────────────────────────

const created = { nurses: [] as number[], visits: [] as number[] }

async function seedNurse(nombres: string, apellidoPaterno: string) {
  const [r] = await db
    .insert(nurses)
    .values({ nombres: `${P}${nombres}`, apellidoPaterno: `${P}${apellidoPaterno}` })
    .returning()
  created.nurses.push(r.id)
  return r
}

afterAll(async () => {
  await Promise.all([
    created.visits.length ? db.delete(visits).where(inArray(visits.id, created.visits)) : null,
    created.nurses.length ? db.delete(nurses).where(inArray(nurses.id, created.nurses)) : null,
  ])
})

// ─── validateRut ──────────────────────────────────────────────────────────────

describe('validateRut', () => {
  it('acepta RUT válido con puntos y guión', () => {
    const r = validateRut('12.345.678-5')
    expect(r.valid).toBe(true)
    if (r.valid) expect(r.normalized).toBe('12.345.678-5')
  })

  it('acepta RUT válido sin puntos ni guión', () => {
    const r = validateRut('11111111-1')
    expect(r.valid).toBe(true)
    if (r.valid) expect(r.normalized).toBe('11.111.111-1')
  })

  it('acepta RUT con dígito verificador K', () => {
    const r = validateRut('7.750.401-K')
    expect(r.valid).toBe(true)
    if (r.valid) expect(r.normalized).toBe('7.750.401-K')
  })

  it('rechaza RUT con dígito verificador incorrecto', () => {
    expect(validateRut('12.345.678-9').valid).toBe(false)
  })

  it('rechaza string vacío', () => {
    expect(validateRut('').valid).toBe(false)
  })

  it('rechaza formato inválido', () => {
    expect(validateRut('abc-def').valid).toBe(false)
  })
})

// ─── createEnfermera ──────────────────────────────────────────────────────────

describe('createEnfermera', () => {
  it('inserta una enfermera con campos obligatorios', async () => {
    const nombres = `${P}María`
    const apellidoPaterno = `${P}González`

    const result = await createEnfermera(fd({ nombres, apellidoPaterno }))
    expect(result.success).toBe(true)

    const [row] = await db.select().from(nurses).where(eq(nurses.nombres, nombres))
    expect(row).toBeDefined()
    expect(row.apellidoPaterno).toBe(apellidoPaterno)
    expect(row.activo).toBe(true)
    created.nurses.push(row.id)
  })

  it('inserta enfermera con todos los campos opcionales', async () => {
    const nombres = `${P}Ana`
    const apellidoPaterno = `${P}Pérez`

    const result = await createEnfermera(fd({
      nombres,
      apellidoPaterno,
      apellidoMaterno: 'López',
      rut: '12.345.678-5',
      telefono: '+56912345678',
      correo: 'ana@ejemplo.cl',
    }))
    expect(result.success).toBe(true)

    const [row] = await db.select().from(nurses).where(eq(nurses.nombres, nombres))
    expect(row.telefono).toBe('+56912345678')
    expect(row.correo).toBe('ana@ejemplo.cl')
    created.nurses.push(row.id)
  })

  it('rechaza sin nombres', async () => {
    const result = await createEnfermera(fd({ nombres: '', apellidoPaterno: 'González' }))
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rechaza sin apellido paterno', async () => {
    const result = await createEnfermera(fd({ nombres: 'María', apellidoPaterno: '' }))
    expect(result.success).toBe(false)
  })

  it('acepta RUT válido y lo normaliza', async () => {
    const nombres = `${P}RutOk`
    const result = await createEnfermera(fd({ nombres, apellidoPaterno: `${P}A`, rut: '12345678-5' }))
    expect(result.success).toBe(true)

    const [row] = await db.select().from(nurses).where(eq(nurses.nombres, nombres))
    expect(row.rut).toBe('12.345.678-5')
    created.nurses.push(row.id)
  })

  it('rechaza RUT inválido', async () => {
    const result = await createEnfermera(fd({ nombres: `${P}RutMal`, apellidoPaterno: `${P}A`, rut: '12.345.678-0' }))
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/rut/i)
  })
})

// ─── updateEnfermera ──────────────────────────────────────────────────────────

describe('updateEnfermera', () => {
  it('actualiza todos los campos', async () => {
    const nurse = await seedNurse('Antes', 'ApellidoAntes')

    const result = await updateEnfermera(fd({
      id: nurse.id,
      nombres: `${P}Después`,
      apellidoPaterno: `${P}ApellidoDespués`,
      telefono: '+56900000001',
    }))
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(nurses).where(eq(nurses.id, nurse.id))
    expect(updated.nombres).toBe(`${P}Después`)
    expect(updated.telefono).toBe('+56900000001')
  })

  it('rechaza nombres vacíos', async () => {
    const nurse = await seedNurse('NombresVacíos', 'Apellido')
    const result = await updateEnfermera(fd({ id: nurse.id, nombres: '', apellidoPaterno: 'Apellido' }))
    expect(result.success).toBe(false)
  })

  it('rechaza id 0', async () => {
    const result = await updateEnfermera(fd({ id: 0, nombres: 'algo', apellidoPaterno: 'algo' }))
    expect(result.success).toBe(false)
  })
})

// ─── toggleEnfermera ──────────────────────────────────────────────────────────

describe('toggleEnfermera', () => {
  it('desactiva una enfermera activa', async () => {
    const nurse = await seedNurse('ToggleOff', 'Apellido')
    expect(nurse.activo).toBe(true)

    const result = await toggleEnfermera(nurse.id, true)
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(nurses).where(eq(nurses.id, nurse.id))
    expect(updated.activo).toBe(false)
  })

  it('activa una enfermera inactiva', async () => {
    const nurse = await seedNurse('ToggleOn', 'Apellido')
    await db.update(nurses).set({ activo: false }).where(eq(nurses.id, nurse.id))

    const result = await toggleEnfermera(nurse.id, false)
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(nurses).where(eq(nurses.id, nurse.id))
    expect(updated.activo).toBe(true)
  })
})

// ─── deleteEnfermera ──────────────────────────────────────────────────────────

describe('deleteEnfermera', () => {
  it('elimina una enfermera sin visitas', async () => {
    const nurse = await seedNurse('SinVisitas', 'Apellido')
    // Quitar del tracking para que afterAll no intente eliminarla
    created.nurses.splice(created.nurses.indexOf(nurse.id), 1)

    const result = await deleteEnfermera(nurse.id)
    expect(result.success).toBe(true)

    const rows = await db.select().from(nurses).where(eq(nurses.id, nurse.id))
    expect(rows.length).toBe(0)
  })

  it('rechaza eliminar enfermera con visitas asignadas', async () => {
    const nurse = await seedNurse('ConVisitas', 'Apellido')

    const [visit] = await db
      .insert(visits)
      .values({ fecha: '2026-01-01', idEnfermera: nurse.id })
      .returning()
    created.visits.push(visit.id)

    const result = await deleteEnfermera(nurse.id)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/visita/i)
  })
})
