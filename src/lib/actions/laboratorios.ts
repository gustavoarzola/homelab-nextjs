'use server'

import { db } from '@/db'
import { laboratories, branches } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

type Result = { success: boolean; error?: string }

// ─── Cadenas (Laboratories/Clinics) ──────────────────────────────────────────

export async function createCadena(formData: FormData): Promise<Result> {
  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { success: false, error: 'Nombre requerido' }
  try {
    await db.insert(laboratories).values({ nombre })
    revalidatePath('/laboratorios')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al crear la cadena' }
  }
}

export async function updateCadena(formData: FormData): Promise<Result> {
  const id = Number(formData.get('id'))
  const nombre = (formData.get('nombre') as string)?.trim()
  if (!id || !nombre) return { success: false, error: 'Datos inválidos' }
  try {
    await db.update(laboratories).set({ nombre }).where(eq(laboratories.id, id))
    revalidatePath('/laboratorios')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar' }
  }
}

export async function toggleCadena(id: number, activo: boolean): Promise<Result> {
  try {
    await db.update(laboratories).set({ activo: !activo }).where(eq(laboratories.id, id))
    revalidatePath('/laboratorios')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al cambiar estado' }
  }
}

// ─── Sucursales ───────────────────────────────────────────────────────────────

export async function createSucursal(formData: FormData): Promise<Result> {
  const nombre = (formData.get('nombre') as string)?.trim()
  const idLaboratorio = Number(formData.get('idLaboratorio'))
  if (!nombre || !idLaboratorio) return { success: false, error: 'Nombre y cadena son requeridos' }
  try {
    await db.insert(branches).values({ nombre, idLaboratorio })
    revalidatePath('/laboratorios')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al crear la sucursal' }
  }
}

export async function updateSucursal(formData: FormData): Promise<Result> {
  const id = Number(formData.get('id'))
  const nombre = (formData.get('nombre') as string)?.trim()
  const idLaboratorio = Number(formData.get('idLaboratorio'))
  if (!id || !nombre || !idLaboratorio) return { success: false, error: 'Datos inválidos' }
  try {
    await db.update(branches).set({ nombre, idLaboratorio }).where(eq(branches.id, id))
    revalidatePath('/laboratorios')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al actualizar' }
  }
}

export async function toggleSucursal(id: number, activo: boolean): Promise<Result> {
  try {
    await db.update(branches).set({ activo: !activo }).where(eq(branches.id, id))
    revalidatePath('/laboratorios')
    return { success: true }
  } catch {
    return { success: false, error: 'Error al cambiar estado' }
  }
}
