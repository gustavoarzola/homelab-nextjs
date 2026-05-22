import { z } from 'zod'

export function parseFormData<T extends z.ZodType>(
  schema: T,
  formData: FormData,
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const raw = Object.fromEntries(formData)
  const result = schema.safeParse(raw)
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  return { success: true, data: result.data }
}

export function parseFormDataWithArrays<T extends z.ZodType>(
  schema: T,
  formData: FormData,
  arrayFields: string[] = [],
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const raw: Record<string, unknown> = Object.fromEntries(formData)
  for (const field of arrayFields) {
    raw[field] = formData.getAll(field)
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  return { success: true, data: result.data }
}

export const fields = {
  id: z.coerce.number().positive('ID inválido'),
  nombre: z.string().trim().min(1, 'Nombre requerido'),
  codigo: z.string().trim().min(1, 'Código requerido'),
  precio: z.coerce.number().int().min(0, 'Precio inválido'),
  precioRequerido: z.coerce.number().int().positive('Precio es requerido'),
  fechaRequerida: z.string().trim().min(1, 'Fecha requerida'),
  bool: z.string().optional().transform((v) => v === 'true'),
  nullableStr: z.string().trim().optional().transform((v) => v || null),
  nullableId: z.coerce.number().int().optional().transform((v) => v || null),
  ids: z.array(z.coerce.number().int().positive()).default([]),
}
