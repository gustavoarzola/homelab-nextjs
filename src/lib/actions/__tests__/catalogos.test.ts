import { describe, it, expect, vi, afterAll } from 'vitest'
import { db } from '@/db'
import { procedures, exams, healthInsurances, elderlyResidences } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { P, fd } from './helpers'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import {
  createProcedimiento,
  updateProcedimiento,
  toggleProcedimiento,
  createExamen,
  updateExamen,
  toggleExamen,
  createPrevision,
  updatePrevision,
  togglePrevision,
  createResidencia,
  updateResidencia,
  toggleResidencia,
} from '../catalogos'

const created = {
  procedures: [] as number[],
  exams: [] as number[],
  healthInsurances: [] as number[],
  elderlyResidences: [] as number[],
}

afterAll(async () => {
  await Promise.all([
    created.procedures.length
      ? db.delete(procedures).where(inArray(procedures.id, created.procedures))
      : null,
    created.exams.length
      ? db.delete(exams).where(inArray(exams.id, created.exams))
      : null,
    created.healthInsurances.length
      ? db.delete(healthInsurances).where(inArray(healthInsurances.id, created.healthInsurances))
      : null,
    created.elderlyResidences.length
      ? db.delete(elderlyResidences).where(inArray(elderlyResidences.id, created.elderlyResidences))
      : null,
  ])
})

// Seeds
async function seedProcedimiento(nombre: string, codigo: string) {
  const [r] = await db.insert(procedures).values({ nombre: `${P}${nombre}`, codigo: `${P}${codigo}` }).returning()
  created.procedures.push(r.id)
  return r
}
async function seedExamen(nombre: string, codigo: string) {
  const [r] = await db.insert(exams).values({ nombre: `${P}${nombre}`, codigo: `${P}${codigo}` }).returning()
  created.exams.push(r.id)
  return r
}
async function seedPrevision(nombre: string) {
  const [r] = await db.insert(healthInsurances).values({ nombre: `${P}${nombre}` }).returning()
  created.healthInsurances.push(r.id)
  return r
}
async function seedResidencia(nombre: string) {
  const [r] = await db.insert(elderlyResidences).values({ nombre: `${P}${nombre}` }).returning()
  created.elderlyResidences.push(r.id)
  return r
}

// ─── PROCEDIMIENTOS ───────────────────────────────────────────────────────────

describe('createProcedimiento', () => {
  it('inserta un procedimiento con nombre y código', async () => {
    const nombre = `${P}Toma de muestra`
    const codigo = `${P}TM-001`

    const result = await createProcedimiento(fd({ nombre, codigo }))
    expect(result.success).toBe(true)

    const [row] = await db.select().from(procedures).where(eq(procedures.nombre, nombre))
    expect(row).toBeDefined()
    expect(row.codigo).toBe(codigo)
    expect(row.activo).toBe(true)
    created.procedures.push(row.id)
  })

  it('rechaza sin nombre', async () => {
    const result = await createProcedimiento(fd({ nombre: '', codigo: 'X-001' }))
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rechaza sin código', async () => {
    const result = await createProcedimiento(fd({ nombre: 'Algo', codigo: '' }))
    expect(result.success).toBe(false)
  })
})

describe('updateProcedimiento', () => {
  it('actualiza nombre y código', async () => {
    const proc = await seedProcedimiento('Proc editar', 'ED-001')
    const nuevoNombre = `${P}Proc actualizado`
    const nuevoCodigo = `${P}ED-002`

    const result = await updateProcedimiento(
      fd({ id: proc.id, nombre: nuevoNombre, codigo: nuevoCodigo })
    )
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(procedures).where(eq(procedures.id, proc.id))
    expect(updated.nombre).toBe(nuevoNombre)
    expect(updated.codigo).toBe(nuevoCodigo)
  })

  it('rechaza nombre vacío', async () => {
    const proc = await seedProcedimiento('Proc nombre vacío', 'NV-001')
    const result = await updateProcedimiento(fd({ id: proc.id, nombre: '', codigo: 'NV-001' }))
    expect(result.success).toBe(false)
  })

  it('rechaza id 0', async () => {
    const result = await updateProcedimiento(fd({ id: 0, nombre: 'algo', codigo: 'X' }))
    expect(result.success).toBe(false)
  })
})

describe('toggleProcedimiento', () => {
  it('desactiva un procedimiento activo', async () => {
    const proc = await seedProcedimiento('Proc toggle off', 'TO-001')
    expect(proc.activo).toBe(true)

    const result = await toggleProcedimiento(proc.id, true)
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(procedures).where(eq(procedures.id, proc.id))
    expect(updated.activo).toBe(false)
  })

  it('activa un procedimiento inactivo', async () => {
    const proc = await seedProcedimiento('Proc toggle on', 'TO-002')
    await db.update(procedures).set({ activo: false }).where(eq(procedures.id, proc.id))

    const result = await toggleProcedimiento(proc.id, false)
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(procedures).where(eq(procedures.id, proc.id))
    expect(updated.activo).toBe(true)
  })
})

// ─── EXÁMENES ─────────────────────────────────────────────────────────────────

describe('createExamen', () => {
  it('inserta un examen con nombre y código', async () => {
    const nombre = `${P}Hemograma`
    const codigo = `${P}HEM-001`

    const result = await createExamen(fd({ nombre, codigo }))
    expect(result.success).toBe(true)

    const [row] = await db.select().from(exams).where(eq(exams.nombre, nombre))
    expect(row).toBeDefined()
    expect(row.codigo).toBe(codigo)
    expect(row.activo).toBe(true)
    created.exams.push(row.id)
  })

  it('rechaza sin nombre', async () => {
    const result = await createExamen(fd({ nombre: '', codigo: 'GLI-001' }))
    expect(result.success).toBe(false)
  })

  it('rechaza sin código', async () => {
    const result = await createExamen(fd({ nombre: 'Glicemia', codigo: '' }))
    expect(result.success).toBe(false)
  })
})

describe('updateExamen', () => {
  it('actualiza nombre y código', async () => {
    const exam = await seedExamen('Exam editar', 'EX-001')
    const nuevoNombre = `${P}Exam actualizado`
    const nuevoCodigo = `${P}EX-002`

    const result = await updateExamen(
      fd({ id: exam.id, nombre: nuevoNombre, codigo: nuevoCodigo })
    )
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(exams).where(eq(exams.id, exam.id))
    expect(updated.nombre).toBe(nuevoNombre)
    expect(updated.codigo).toBe(nuevoCodigo)
  })

  it('rechaza id 0', async () => {
    const result = await updateExamen(fd({ id: 0, nombre: 'algo', codigo: 'X' }))
    expect(result.success).toBe(false)
  })
})

describe('toggleExamen', () => {
  it('desactiva un examen activo', async () => {
    const exam = await seedExamen('Exam toggle', 'ET-001')

    const result = await toggleExamen(exam.id, true)
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(exams).where(eq(exams.id, exam.id))
    expect(updated.activo).toBe(false)
  })

  it('activa un examen inactivo', async () => {
    const exam = await seedExamen('Exam toggle on', 'ET-002')
    await db.update(exams).set({ activo: false }).where(eq(exams.id, exam.id))

    const result = await toggleExamen(exam.id, false)
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(exams).where(eq(exams.id, exam.id))
    expect(updated.activo).toBe(true)
  })
})

// ─── PREVISIONES DE SALUD ─────────────────────────────────────────────────────

describe('createPrevision', () => {
  it('inserta una previsión', async () => {
    const nombre = `${P}Fonasa`

    const result = await createPrevision(fd({ nombre }))
    expect(result.success).toBe(true)

    const [row] = await db.select().from(healthInsurances).where(eq(healthInsurances.nombre, nombre))
    expect(row).toBeDefined()
    expect(row.activo).toBe(true)
    created.healthInsurances.push(row.id)
  })

  it('rechaza nombre vacío', async () => {
    const result = await createPrevision(fd({ nombre: '' }))
    expect(result.success).toBe(false)
  })
})

describe('updatePrevision', () => {
  it('actualiza el nombre', async () => {
    const prev = await seedPrevision('Prev editar')
    const nuevoNombre = `${P}Prev actualizada`

    const result = await updatePrevision(fd({ id: prev.id, nombre: nuevoNombre }))
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(healthInsurances).where(eq(healthInsurances.id, prev.id))
    expect(updated.nombre).toBe(nuevoNombre)
  })

  it('rechaza nombre vacío', async () => {
    const prev = await seedPrevision('Prev nombre vacío')
    const result = await updatePrevision(fd({ id: prev.id, nombre: '' }))
    expect(result.success).toBe(false)
  })
})

describe('togglePrevision', () => {
  it('desactiva una previsión activa', async () => {
    const prev = await seedPrevision('Prev toggle')

    const result = await togglePrevision(prev.id, true)
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(healthInsurances).where(eq(healthInsurances.id, prev.id))
    expect(updated.activo).toBe(false)
  })

  it('activa una previsión inactiva', async () => {
    const prev = await seedPrevision('Prev toggle on')
    await db.update(healthInsurances).set({ activo: false }).where(eq(healthInsurances.id, prev.id))

    const result = await togglePrevision(prev.id, false)
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(healthInsurances).where(eq(healthInsurances.id, prev.id))
    expect(updated.activo).toBe(true)
  })
})

// ─── RESIDENCIAS ──────────────────────────────────────────────────────────────

describe('createResidencia', () => {
  it('inserta una residencia', async () => {
    const nombre = `${P}Casa de reposo Los Olivos`

    const result = await createResidencia(fd({ nombre }))
    expect(result.success).toBe(true)

    const [row] = await db.select().from(elderlyResidences).where(eq(elderlyResidences.nombre, nombre))
    expect(row).toBeDefined()
    expect(row.activo).toBe(true)
    created.elderlyResidences.push(row.id)
  })

  it('rechaza nombre vacío', async () => {
    const result = await createResidencia(fd({ nombre: '' }))
    expect(result.success).toBe(false)
  })
})

describe('updateResidencia', () => {
  it('actualiza el nombre', async () => {
    const res = await seedResidencia('Residencia editar')
    const nuevoNombre = `${P}Residencia actualizada`

    const result = await updateResidencia(fd({ id: res.id, nombre: nuevoNombre }))
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(elderlyResidences).where(eq(elderlyResidences.id, res.id))
    expect(updated.nombre).toBe(nuevoNombre)
  })

  it('rechaza nombre vacío', async () => {
    const res = await seedResidencia('Residencia nombre vacío')
    const result = await updateResidencia(fd({ id: res.id, nombre: '' }))
    expect(result.success).toBe(false)
  })
})

describe('toggleResidencia', () => {
  it('desactiva una residencia activa', async () => {
    const res = await seedResidencia('Residencia toggle')

    const result = await toggleResidencia(res.id, true)
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(elderlyResidences).where(eq(elderlyResidences.id, res.id))
    expect(updated.activo).toBe(false)
  })

  it('activa una residencia inactiva', async () => {
    const res = await seedResidencia('Residencia toggle on')
    await db.update(elderlyResidences).set({ activo: false }).where(eq(elderlyResidences.id, res.id))

    const result = await toggleResidencia(res.id, false)
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(elderlyResidences).where(eq(elderlyResidences.id, res.id))
    expect(updated.activo).toBe(true)
  })
})
