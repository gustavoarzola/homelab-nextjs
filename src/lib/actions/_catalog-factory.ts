import { db } from '@/db'
import { eq, count, and, or, ilike, asc, desc, not, type SQL } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import type { SearchParams } from '@/components/data-table'
import { parseFormData } from '@/lib/validation'
import { withQuery, withAction, ActionError, type ActionResult } from '@/lib/with-action'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCol = any

export type CatalogConfig = {
  table: AnyCol
  idCol: AnyCol
  nombreCol: AnyCol
  activoCol: AnyCol
  searchCols?: AnyCol[]                          // extra columns for OR ilike search
  sortCols?: Record<string, AnyCol>             // extra sort keys
  createSchema: z.ZodSchema<any>                // eslint-disable-line @typescript-eslint/no-explicit-any
  updateSchema: z.ZodSchema<any>                // eslint-disable-line @typescript-eslint/no-explicit-any
  path: string
  tag?: string
  extraFilters?: (filters: Record<string, unknown>, conditions: SQL[]) => void
  extraUpdateFields?: Record<string, unknown> | (() => Record<string, unknown>)
}

export async function catalogSearch(
  config: CatalogConfig,
  params: SearchParams,
): Promise<{ rows: unknown[]; total: number }> {
  return withQuery(async () => {
    const { filters, sort, page, pageSize } = params
    const buscar = (filters.buscar as string | undefined)?.trim()
    const mostrarInactivos = filters.mostrarInactivos as boolean | undefined

    const conditions: SQL[] = []
    if (buscar) {
      const cols = [config.nombreCol, ...(config.searchCols ?? [])]
      conditions.push(cols.length === 1 ? ilike(cols[0], `%${buscar}%`) : or(...cols.map((c) => ilike(c, `%${buscar}%`)))!)
    }
    if (!mostrarInactivos) conditions.push(eq(config.activoCol, true))
    config.extraFilters?.(filters, conditions)
    const where = conditions.length ? and(...conditions) : undefined

    const [countRow] = await db.select({ total: count() }).from(config.table).where(where)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sortable: Record<string, any> = { nombre: config.nombreCol, ...(config.sortCols ?? {}) }
    const sortCol = (sort?.key && sortable[sort.key]) ?? config.nombreCol
    const order = sort?.dir === 'desc' ? desc(sortCol) : asc(sortCol)

    const rows = await db
      .select()
      .from(config.table)
      .where(where)
      .orderBy(order, asc(config.nombreCol))
      .limit(pageSize)
      .offset((page - 1) * pageSize)

    return { rows, total: Number(countRow?.total ?? 0) }
  })
}

export async function catalogCreate(config: CatalogConfig, formData: FormData): Promise<ActionResult> {
  return withAction('Error al crear', async () => {
    const parsed = parseFormData(config.createSchema, formData)
    if (!parsed.success) throw new ActionError(parsed.error)
    const existing = await db
      .select({ id: config.idCol })
      .from(config.table)
      .where(ilike(config.nombreCol, parsed.data.nombre))
    if (existing.length > 0) throw new ActionError('Este nombre ya existe')
    await db.insert(config.table).values(parsed.data)
    revalidatePath(config.path)
    if (config.tag) revalidateTag(config.tag, 'days')
  })
}

export async function catalogUpdate(config: CatalogConfig, formData: FormData): Promise<ActionResult> {
  return withAction('Error al actualizar', async () => {
    const parsed = parseFormData(config.updateSchema, formData)
    if (!parsed.success) throw new ActionError(parsed.error)
    const { id, ...data } = parsed.data
    const duplicated = await db
      .select({ id: config.idCol })
      .from(config.table)
      .where(and(ilike(config.nombreCol, data.nombre), not(eq(config.idCol, id))))
    if (duplicated.length > 0) throw new ActionError('Este nombre ya existe')
    const extra =
      typeof config.extraUpdateFields === 'function'
        ? config.extraUpdateFields()
        : (config.extraUpdateFields ?? {})
    await db.update(config.table).set({ ...data, ...extra }).where(eq(config.idCol, id))
    revalidatePath(config.path)
    if (config.tag) revalidateTag(config.tag, 'days')
  })
}

export async function catalogToggle(
  config: CatalogConfig,
  id: number,
  activo: boolean,
): Promise<ActionResult> {
  return withAction('Error al cambiar estado', async () => {
    await db.update(config.table).set({ activo: !activo }).where(eq(config.idCol, id))
    revalidatePath(config.path)
    if (config.tag) revalidateTag(config.tag, 'days')
  })
}
