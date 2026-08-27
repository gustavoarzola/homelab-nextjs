'use server'

import { db } from '@/db'
import { procedures, exams, healthInsurances, elderlyResidences, surchargeTypes, workshops, comunas, contactOrigins } from '@/db/schema'
import { eq, asc, and, ilike } from 'drizzle-orm'
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import { z } from 'zod'
import type { SearchParams } from '@/components/data-table'
import { fields } from '@/lib/validation'
import { withQuery } from '@/lib/with-action'
import { PREVISION_CATEGORIAS } from '@/lib/previsiones'
import {
  catalogSearch,
  catalogCreate,
  catalogUpdate,
  catalogToggle,
  type CatalogConfig,
} from './_catalog-factory'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const procedimientoSchema = z.object({
  nombre: fields.nombre,
  codigo: fields.codigo,
  categoria: z.string().trim().optional().transform((v) => v || 'otros'),
  precio: fields.precio.optional().default(0),
})
const procedimientoUpdateSchema = procedimientoSchema.extend({ id: fields.id })

const examenSchema = z.object({
  nombre: fields.nombre,
  codigo: fields.codigo,
  grupoExamen: z.string().trim().min(1, 'Grupo requerido'),
  precio: fields.precio.optional().default(0),
})
const examenUpdateSchema = examenSchema.extend({ id: fields.id })

const previsionSchema = z.object({
  nombre: fields.nombre,
  categoria: z.enum(PREVISION_CATEGORIAS, { message: 'Categoría inválida' }),
})
const previsionUpdateSchema = previsionSchema.extend({ id: fields.id })

const residenciaSchema = z.object({ nombre: fields.nombre })
const residenciaUpdateSchema = residenciaSchema.extend({ id: fields.id })

const comunaSchema = z.object({ nombre: fields.nombre })
const comunaUpdateSchema = comunaSchema.extend({ id: fields.id })

const origenContactoSchema = z.object({ nombre: fields.nombre })
const origenContactoUpdateSchema = origenContactoSchema.extend({ id: fields.id })

const tipoRecargoSchema = z.object({ nombre: fields.nombre, precio: fields.precio.optional().default(0) })
const tipoRecargoUpdateSchema = tipoRecargoSchema.extend({ id: fields.id })

const tallerSchema = z.object({ nombre: fields.nombre, codigo: fields.codigo })
const tallerUpdateSchema = tallerSchema.extend({ id: fields.id })

// ─── Row types ────────────────────────────────────────────────────────────────

export type ProcedimientoRow = { id: number; nombre: string; codigo: string; categoria: string; precio: number; activo: boolean }
export type ExamenRow       = { id: number; nombre: string; codigo: string; grupoExamen: string; precio: number; activo: boolean }
export type TallerRow       = { id: number; nombre: string; codigo: string; activo: boolean }
export type PrevisionRow    = { id: number; nombre: string; categoria: string | null; activo: boolean }
export type ResidenciaRow   = { id: number; nombre: string; activo: boolean }
export type ComunaRow       = { id: number; nombre: string; activo: boolean }
export type OrigenContactoRow = { id: number; nombre: string; activo: boolean }
export type TipoRecargoRow  = { id: number; nombre: string; precio: number; activo: boolean }

// ─── Catalog configs ──────────────────────────────────────────────────────────

const procedimientoCfg: CatalogConfig = {
  table: procedures, idCol: procedures.id, nombreCol: procedures.nombre, activoCol: procedures.activo,
  searchCols: [procedures.codigo],
  sortCols: { codigo: procedures.codigo },
  createSchema: procedimientoSchema,
  updateSchema: procedimientoUpdateSchema,
  path: '/procedimientos', tag: 'procedimientos',
  extraFilters: (filters, conds) => {
    const cat = (filters.categoria as string | undefined)?.trim()
    if (cat) conds.push(eq(procedures.categoria, cat))
  },
}

const examenCfg: CatalogConfig = {
  table: exams, idCol: exams.id, nombreCol: exams.nombre, activoCol: exams.activo,
  searchCols: [exams.codigo],
  sortCols: { codigo: exams.codigo },
  createSchema: examenSchema,
  updateSchema: examenUpdateSchema,
  path: '/examenes', tag: 'examenes',
  extraUpdateFields: () => ({ updatedAt: new Date() }),
}

const previsionCfg: CatalogConfig = {
  table: healthInsurances, idCol: healthInsurances.id, nombreCol: healthInsurances.nombre, activoCol: healthInsurances.activo,
  createSchema: previsionSchema,
  updateSchema: previsionUpdateSchema,
  path: '/previsiones', tag: 'previsiones',
  extraFilters: (filters, conds) => {
    const cat = (filters.categoria as string | undefined)?.trim()
    if (cat) conds.push(eq(healthInsurances.categoria, cat))
  },
}

const residenciaCfg: CatalogConfig = {
  table: elderlyResidences, idCol: elderlyResidences.id, nombreCol: elderlyResidences.nombre, activoCol: elderlyResidences.activo,
  createSchema: residenciaSchema,
  updateSchema: residenciaUpdateSchema,
  path: '/residencias',
}

const comunaCfg: CatalogConfig = {
  table: comunas, idCol: comunas.id, nombreCol: comunas.nombre, activoCol: comunas.activo,
  createSchema: comunaSchema,
  updateSchema: comunaUpdateSchema,
  path: '/comunas', tag: 'comunas',
  extraUpdateFields: () => ({ updatedAt: new Date() }),
}

const origenContactoCfg: CatalogConfig = {
  table: contactOrigins, idCol: contactOrigins.id, nombreCol: contactOrigins.nombre, activoCol: contactOrigins.activo,
  createSchema: origenContactoSchema,
  updateSchema: origenContactoUpdateSchema,
  path: '/origenes-contacto', tag: 'origenes-contacto',
  extraUpdateFields: () => ({ updatedAt: new Date() }),
}

const tipoRecargoCfg: CatalogConfig = {
  table: surchargeTypes, idCol: surchargeTypes.id, nombreCol: surchargeTypes.nombre, activoCol: surchargeTypes.activo,
  createSchema: tipoRecargoSchema,
  updateSchema: tipoRecargoUpdateSchema,
  path: '/tipos-recargos', tag: 'tipos-recargos',
  extraUpdateFields: () => ({ updatedAt: new Date() }),
}

const tallerCfg: CatalogConfig = {
  table: workshops, idCol: workshops.id, nombreCol: workshops.nombre, activoCol: workshops.activo,
  searchCols: [workshops.codigo],
  sortCols: { codigo: workshops.codigo },
  createSchema: tallerSchema,
  updateSchema: tallerUpdateSchema,
  path: '/talleres', tag: 'talleres',
  extraUpdateFields: () => ({ updatedAt: new Date() }),
}

// ─── Procedimientos ───────────────────────────────────────────────────────────

export async function searchProcedimientos(params: SearchParams): Promise<{ rows: ProcedimientoRow[]; total: number }> {
  return catalogSearch(procedimientoCfg, params) as Promise<{ rows: ProcedimientoRow[]; total: number }>
}
export async function createProcedimiento(formData: FormData) { return catalogCreate(procedimientoCfg, formData) }
export async function updateProcedimiento(formData: FormData) { return catalogUpdate(procedimientoCfg, formData) }
export async function toggleProcedimiento(id: number, activo: boolean) { return catalogToggle(procedimientoCfg, id, activo) }

// ─── Exámenes ─────────────────────────────────────────────────────────────────

export async function searchExamenes(params: SearchParams): Promise<{ rows: ExamenRow[]; total: number }> {
  return catalogSearch(examenCfg, params) as Promise<{ rows: ExamenRow[]; total: number }>
}
export async function createExamen(formData: FormData) { return catalogCreate(examenCfg, formData) }
export async function updateExamen(formData: FormData) { return catalogUpdate(examenCfg, formData) }
export async function toggleExamen(id: number, activo: boolean) { return catalogToggle(examenCfg, id, activo) }

// ─── Previsiones ──────────────────────────────────────────────────────────────

export async function searchPrevisiones(params: SearchParams): Promise<{ rows: PrevisionRow[]; total: number }> {
  return catalogSearch(previsionCfg, params) as Promise<{ rows: PrevisionRow[]; total: number }>
}
export async function createPrevision(formData: FormData) { return catalogCreate(previsionCfg, formData) }
export async function updatePrevision(formData: FormData) { return catalogUpdate(previsionCfg, formData) }
export async function togglePrevision(id: number, activo: boolean) { return catalogToggle(previsionCfg, id, activo) }

// ─── Residencias ──────────────────────────────────────────────────────────────

export async function searchResidencias(params: SearchParams): Promise<{ rows: ResidenciaRow[]; total: number }> {
  return catalogSearch(residenciaCfg, params) as Promise<{ rows: ResidenciaRow[]; total: number }>
}
export async function createResidencia(formData: FormData) { return catalogCreate(residenciaCfg, formData) }
export async function updateResidencia(formData: FormData) { return catalogUpdate(residenciaCfg, formData) }
export async function toggleResidencia(id: number, activo: boolean) { return catalogToggle(residenciaCfg, id, activo) }

// ─── Comunas ──────────────────────────────────────────────────────────────────

export async function searchComunas(params: SearchParams): Promise<{ rows: ComunaRow[]; total: number }> {
  return catalogSearch(comunaCfg, params) as Promise<{ rows: ComunaRow[]; total: number }>
}
export async function createComuna(formData: FormData) { return catalogCreate(comunaCfg, formData) }
export async function updateComuna(formData: FormData) { return catalogUpdate(comunaCfg, formData) }
export async function toggleComuna(id: number, activo: boolean) { return catalogToggle(comunaCfg, id, activo) }

const _fetchComunas = unstable_cache(
  () => db.select({ id: comunas.id, nombre: comunas.nombre }).from(comunas).where(eq(comunas.activo, true)).orderBy(asc(comunas.nombre)),
  ['comunas'],
  { tags: ['comunas'], revalidate: 86400 },
)
export async function getComunasForSelect(): Promise<{ id: number; nombre: string }[]> {
  return withQuery(() => _fetchComunas())
}

// ─── Orígenes de contacto ─────────────────────────────────────────────────────

export async function searchOrigenesContacto(params: SearchParams): Promise<{ rows: OrigenContactoRow[]; total: number }> {
  return catalogSearch(origenContactoCfg, params) as Promise<{ rows: OrigenContactoRow[]; total: number }>
}
export async function createOrigenContacto(formData: FormData) { return catalogCreate(origenContactoCfg, formData) }
export async function updateOrigenContacto(formData: FormData) { return catalogUpdate(origenContactoCfg, formData) }
export async function toggleOrigenContacto(id: number, activo: boolean) { return catalogToggle(origenContactoCfg, id, activo) }

const _fetchOrigenesContacto = unstable_cache(
  () => db.select({ id: contactOrigins.id, nombre: contactOrigins.nombre }).from(contactOrigins).where(eq(contactOrigins.activo, true)).orderBy(asc(contactOrigins.nombre)),
  ['origenes-contacto'],
  { tags: ['origenes-contacto'], revalidate: 86400 },
)
/**
 * Orígenes activos para el select del formulario de visita. `incluirId` es el
 * origen ya seleccionado en la visita (si viene de `getVisita`); si quedó
 * inactivo desde entonces, se agrega igual para no perder la selección al editar.
 */
export async function getOrigenesContactoForSelect(incluirId?: number | null): Promise<{ id: number; nombre: string }[]> {
  return withQuery(async () => {
    const activos = await _fetchOrigenesContacto()
    if (!incluirId || activos.some((o) => o.id === incluirId)) return activos
    const [inactivo] = await db
      .select({ id: contactOrigins.id, nombre: contactOrigins.nombre })
      .from(contactOrigins)
      .where(eq(contactOrigins.id, incluirId))
    return inactivo ? [...activos, inactivo].sort((a, b) => a.nombre.localeCompare(b.nombre)) : activos
  })
}

// ─── Tipos de Recargos ────────────────────────────────────────────────────────

export async function searchTiposRecargos(params: SearchParams): Promise<{ rows: TipoRecargoRow[]; total: number }> {
  return catalogSearch(tipoRecargoCfg, params) as Promise<{ rows: TipoRecargoRow[]; total: number }>
}
export async function createTipoRecargo(formData: FormData) { return catalogCreate(tipoRecargoCfg, formData) }
export async function updateTipoRecargo(formData: FormData) { return catalogUpdate(tipoRecargoCfg, formData) }
export async function toggleTipoRecargo(id: number, activo: boolean) { return catalogToggle(tipoRecargoCfg, id, activo) }

const _fetchTiposRecargos = unstable_cache(
  async () => {
    const rows = await db
      .select({ id: surchargeTypes.id, nombre: surchargeTypes.nombre, precio: surchargeTypes.precio })
      .from(surchargeTypes)
      .where(eq(surchargeTypes.activo, true))
      .orderBy(asc(surchargeTypes.nombre))
    return rows.map((r) => ({ id: r.id, label: r.nombre, precio: r.precio }))
  },
  ['tipos-recargos'],
  { tags: ['tipos-recargos'], revalidate: 86400 },
)
export async function getTiposRecargosForSelect(): Promise<{ id: number; label: string; precio: number }[]> {
  return withQuery(() => _fetchTiposRecargos())
}

// ─── Talleres ─────────────────────────────────────────────────────────────────

export async function searchTalleres(params: SearchParams): Promise<{ rows: TallerRow[]; total: number }> {
  return catalogSearch(tallerCfg, params) as Promise<{ rows: TallerRow[]; total: number }>
}
export async function createTaller(formData: FormData) { return catalogCreate(tallerCfg, formData) }
export async function updateTaller(formData: FormData) { return catalogUpdate(tallerCfg, formData) }
export async function toggleTaller(id: number, activo: boolean) { return catalogToggle(tallerCfg, id, activo) }

const _fetchTalleres = unstable_cache(
  () => db.select().from(workshops).where(eq(workshops.activo, true)).orderBy(asc(workshops.nombre)),
  ['talleres'],
  { tags: ['talleres'], revalidate: 86400 },
)
export async function getTalleres(): Promise<TallerRow[]> {
  return withQuery(() => _fetchTalleres())
}

// ─── Selects ──────────────────────────────────────────────────────────────────

const _fetchProcedimientos = unstable_cache(
  () => db.select().from(procedures).where(eq(procedures.activo, true)).orderBy(asc(procedures.nombre)),
  ['procedimientos'],
  { tags: ['procedimientos'], revalidate: 86400 },
)
export async function getProcedimientos(): Promise<ProcedimientoRow[]> {
  return withQuery(() => _fetchProcedimientos())
}

const _fetchExamenes = unstable_cache(
  () => db.select().from(exams).where(eq(exams.activo, true)).orderBy(asc(exams.nombre)),
  ['examenes'],
  { tags: ['examenes'], revalidate: 86400 },
)
export async function getExamenes(): Promise<ExamenRow[]> {
  return withQuery(() => _fetchExamenes())
}

export type IsaprePrevisionRow = { id: number; nombre: string }

const _fetchIsaprePrevisiones = unstable_cache(
  () =>
    db
      .select({ id: healthInsurances.id, nombre: healthInsurances.nombre })
      .from(healthInsurances)
      .where(and(eq(healthInsurances.categoria, 'isapre'), eq(healthInsurances.activo, true)))
      .orderBy(asc(healthInsurances.nombre)),
  ['previsiones'],
  { tags: ['previsiones'], revalidate: 86400 },
)
export async function getIsaprePrevisiones(): Promise<IsaprePrevisionRow[]> {
  return withQuery(() => _fetchIsaprePrevisiones())
}
