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

export const archivoItemSchema = z.object({
  key: z.string().trim().min(1).max(500),
  nombreOriginal: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((v) => v || null),
  contentType: z.string().trim().max(100),
  tamano: z.coerce.number().int().min(0),
})

export type ArchivoItemInput = z.infer<typeof archivoItemSchema>

export const fields = {
  id: z.coerce.number().positive('ID inválido'),
  nombre: z.string().trim().min(1, 'Nombre requerido'),
  codigo: z.string().trim().min(1, 'Código requerido'),
  precio: z.coerce.number().int().min(0, 'Precio inválido'),
  precioRequerido: z.coerce.number().int().positive('Precio es requerido'),
  montoInsumos: z.coerce.number().int().min(0, 'Monto de insumos inválido').optional().default(0),
  descuentoTipo: z.enum(['monto', 'porcentaje']).optional().default('monto'),
  descuentoValor: z.coerce.number().int().min(0, 'Valor de descuento inválido').optional().default(0),
  fechaRequerida: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  bool: z.string().optional().transform((v) => v === 'true'),
  nullableStr: z.string().trim().optional().transform((v) => v || null),
  nullableId: z.coerce.number().int().optional().transform((v) => v || null),
  ids: z.array(z.coerce.number().int().positive()).default([]),
  archivos: z
    .string()
    .optional()
    .default('[]')
    .transform((raw, ctx) => {
      try {
        return JSON.parse(raw) as unknown
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Archivos inválidos' })
        return z.NEVER
      }
    })
    .pipe(z.array(archivoItemSchema).max(20)),
}

// ─── parseItemExtras ──────────────────────────────────────────────────────────

export type IsapreExamInput = {
  idExamen: number
  valorCompleto: number
  valorPagar: number
  idPrevision: number | null
}

export type ItemExtras = {
  /** Descuento por procedimiento (>= 0). `null` si el campo no vino en el FormData. */
  procedimientoDescuentos: Record<number, number | null>
  /** Precio libre por taller (0 si falta o es inválido). */
  tallerPrecios: Record<number, number>
  isapreExams: IsapreExamInput[]
  isaprePrevisionId: number | null
}

/**
 * Parsea los campos dinámicos del FormData de visitas/cotizaciones que no pasan por Zod:
 * `procedimiento_descuento_${id}`, `taller_precio_${id}`, `isapre_exam_ids`,
 * `isapre_prevision_id`, `isapre_exam_valor_${id}` e `isapre_exam_valor_pagar_${id}`.
 *
 * `numberParser` controla cómo se leen descuentos y precios de taller: 'number' usa `Number`
 * (visitas) y 'int' usa `parseInt` (cotizaciones). Los valores de isapre siempre usan `Number`.
 */
export function parseItemExtras(
  fd: FormData,
  ids: { procedureIds?: number[]; tallerIds?: number[] },
  opts: { numberParser?: 'number' | 'int' } = {},
): ItemExtras {
  const parse = (raw: FormDataEntryValue | null): number =>
    (opts.numberParser === 'int' ? parseInt(raw as string) : Number(raw)) || 0

  const procedimientoDescuentos: Record<number, number | null> = {}
  for (const id of ids.procedureIds ?? []) {
    const raw = fd.get(`procedimiento_descuento_${id}`)
    procedimientoDescuentos[id] = raw === null ? null : Math.max(0, parse(raw))
  }

  const tallerPrecios: Record<number, number> = {}
  for (const id of ids.tallerIds ?? []) {
    tallerPrecios[id] = parse(fd.get(`taller_precio_${id}`))
  }

  const isapreExamIds = fd.getAll('isapre_exam_ids').map((v) => Number(v)).filter(Boolean)
  const isaprePrevisionId = fd.get('isapre_prevision_id') ? Number(fd.get('isapre_prevision_id')) : null
  const isapreExams = isapreExamIds.map((examId) => ({
    idExamen: examId,
    valorCompleto: Number(fd.get(`isapre_exam_valor_${examId}`)) || 0,
    valorPagar: Number(fd.get(`isapre_exam_valor_pagar_${examId}`)) || 0,
    idPrevision: isaprePrevisionId,
  }))

  return { procedimientoDescuentos, tallerPrecios, isapreExams, isaprePrevisionId }
}
