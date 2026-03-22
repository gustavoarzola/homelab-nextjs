'use server'

import { db } from '@/db'
import { procedures, exams, healthInsurances, elderlyResidences } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

type Result = { success: boolean; error?: string }

// ─── Procedimientos ───────────────────────────────────────────────────────────

export async function createProcedimiento(formData: FormData): Promise<Result> {
  const nombre = (formData.get('nombre') as string)?.trim()
  const codigo = (formData.get('codigo') as string)?.trim()
  if (!nombre || !codigo) return { success: false, error: 'Nombre y código son requeridos' }
  try {
    await db.insert(procedures).values({ nombre, codigo })
    revalidatePath('/catalogos')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al crear' }
  }
}

export async function updateProcedimiento(formData: FormData): Promise<Result> {
  const id = Number(formData.get('id'))
  const nombre = (formData.get('nombre') as string)?.trim()
  const codigo = (formData.get('codigo') as string)?.trim()
  if (!id || !nombre || !codigo) return { success: false, error: 'Datos inválidos' }
  try {
    await db.update(procedures).set({ nombre, codigo }).where(eq(procedures.id, id))
    revalidatePath('/catalogos')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar' }
  }
}

export async function toggleProcedimiento(id: number, activo: boolean): Promise<Result> {
  try {
    await db.update(procedures).set({ activo: !activo }).where(eq(procedures.id, id))
    revalidatePath('/catalogos')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al cambiar estado' }
  }
}

// ─── Exámenes ─────────────────────────────────────────────────────────────────

export async function createExamen(formData: FormData): Promise<Result> {
  const nombre = (formData.get('nombre') as string)?.trim()
  const codigo = (formData.get('codigo') as string)?.trim()
  if (!nombre || !codigo) return { success: false, error: 'Nombre y código son requeridos' }
  try {
    await db.insert(exams).values({ nombre, codigo })
    revalidatePath('/catalogos')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al crear' }
  }
}

export async function updateExamen(formData: FormData): Promise<Result> {
  const id = Number(formData.get('id'))
  const nombre = (formData.get('nombre') as string)?.trim()
  const codigo = (formData.get('codigo') as string)?.trim()
  if (!id || !nombre || !codigo) return { success: false, error: 'Datos inválidos' }
  try {
    await db.update(exams).set({ nombre, codigo }).where(eq(exams.id, id))
    revalidatePath('/catalogos')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar' }
  }
}

export async function toggleExamen(id: number, activo: boolean): Promise<Result> {
  try {
    await db.update(exams).set({ activo: !activo }).where(eq(exams.id, id))
    revalidatePath('/catalogos')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al cambiar estado' }
  }
}

// ─── Previsiones de Salud ─────────────────────────────────────────────────────

export async function createPrevision(formData: FormData): Promise<Result> {
  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { success: false, error: 'Nombre requerido' }
  try {
    await db.insert(healthInsurances).values({ nombre })
    revalidatePath('/catalogos')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al crear' }
  }
}

export async function updatePrevision(formData: FormData): Promise<Result> {
  const id = Number(formData.get('id'))
  const nombre = (formData.get('nombre') as string)?.trim()
  if (!id || !nombre) return { success: false, error: 'Datos inválidos' }
  try {
    await db.update(healthInsurances).set({ nombre }).where(eq(healthInsurances.id, id))
    revalidatePath('/catalogos')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar' }
  }
}

export async function togglePrevision(id: number, activo: boolean): Promise<Result> {
  try {
    await db.update(healthInsurances).set({ activo: !activo }).where(eq(healthInsurances.id, id))
    revalidatePath('/catalogos')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al cambiar estado' }
  }
}

// ─── Residencias de Adulto Mayor ──────────────────────────────────────────────

export async function createResidencia(formData: FormData): Promise<Result> {
  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { success: false, error: 'Nombre requerido' }
  try {
    await db.insert(elderlyResidences).values({ nombre })
    revalidatePath('/catalogos')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al crear' }
  }
}

export async function updateResidencia(formData: FormData): Promise<Result> {
  const id = Number(formData.get('id'))
  const nombre = (formData.get('nombre') as string)?.trim()
  if (!id || !nombre) return { success: false, error: 'Datos inválidos' }
  try {
    await db.update(elderlyResidences).set({ nombre }).where(eq(elderlyResidences.id, id))
    revalidatePath('/catalogos')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar' }
  }
}

export async function toggleResidencia(id: number, activo: boolean): Promise<Result> {
  try {
    await db.update(elderlyResidences).set({ activo: !activo }).where(eq(elderlyResidences.id, id))
    revalidatePath('/catalogos')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al cambiar estado' }
  }
}
