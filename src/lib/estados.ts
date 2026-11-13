// Estados de visita y cotización: única fuente de verdad para las listas, los tipos y los labels.
// En la DB son `varchar` (sin enum); `src/db/schema.ts` los tipa con `$type<...>()`.

// ─── Visitas ────────────────────────────────────────────────────────────────
//
// Ciclo de vida: programada → confirmada → realizada → completada
//                                   └→ no_realizada        (desde confirmada)
//                programada|confirmada → cancelada

export const ESTADOS_VISITA = [
  'programada',
  'confirmada',
  'realizada',
  'completada',
  'no_realizada',
  'cancelada',
] as const

export type EstadoVisita = (typeof ESTADOS_VISITA)[number]

export function isEstadoVisita(value: string): value is EstadoVisita {
  return (ESTADOS_VISITA as readonly string[]).includes(value)
}

export const ESTADO_VISITA_LABEL: Record<EstadoVisita, string> = {
  programada: 'Programada',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  completada: 'Completada',
  no_realizada: 'No realizada',
  cancelada: 'Cancelada',
}

/** Desenlaces del ciclo de vida (la "bifurcación" final del stepper). */
export const ESTADOS_VISITA_TERMINALES: readonly EstadoVisita[] = ['completada', 'no_realizada', 'cancelada']

/** No se puede editar la visita (página `/visitas/[id]/editar`, `updateVisita` y la vista de detalle). */
export const ESTADOS_VISITA_NO_EDITABLES: readonly EstadoVisita[] = ESTADOS_VISITA_TERMINALES

/** Aparecen en el board de asignación de enfermeras. */
export const ESTADOS_VISITA_ASIGNABLES: readonly EstadoVisita[] = ['programada', 'confirmada']

/** Se pueden cancelar (`cancelarVisita`). */
export const ESTADOS_VISITA_CANCELABLES: readonly EstadoVisita[] = ['programada', 'confirmada']

/** La visita realmente ocurrió (métricas del dashboard). */
export const ESTADOS_VISITA_EFECTIVOS: readonly EstadoVisita[] = ['realizada', 'completada']

/** Solo un admin puede eliminar visitas en estos estados (`deleteVisita`). */
export const ESTADOS_VISITA_ELIMINACION_SOLO_ADMIN: readonly EstadoVisita[] = ['realizada', 'completada']

/** La visita no ocurrió: se muestra como inactiva en el listado. */
export const ESTADOS_VISITA_INACTIVOS: readonly EstadoVisita[] = ['cancelada', 'no_realizada']

// ─── Cotizaciones ───────────────────────────────────────────────────────────
//
// Ciclo de vida: creada → enviada → aceptada (se convierte en visita) | rechazada

export const ESTADOS_COTIZACION = ['creada', 'enviada', 'aceptada', 'rechazada'] as const

export type EstadoCotizacion = (typeof ESTADOS_COTIZACION)[number]

export function isEstadoCotizacion(value: string): value is EstadoCotizacion {
  return (ESTADOS_COTIZACION as readonly string[]).includes(value)
}

export const ESTADO_COTIZACION_LABEL: Record<EstadoCotizacion, string> = {
  creada: 'Creada',
  enviada: 'Enviada',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
}
