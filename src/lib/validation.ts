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

export const fields = {
  id: z.coerce.number().positive('ID inválido'),
  nombre: z.string().trim().min(1, 'Nombre requerido'),
  codigo: z.string().trim().min(1, 'Código requerido'),
  precio: z.coerce.number().int().min(0, 'Precio inválido'),
  precioRequerido: z.coerce.number().int().positive('Precio es requerido'),
}
