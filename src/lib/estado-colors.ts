export type EstadoVisitaStyle = {
  bg: string
  color: string
  border: string
  label: string
  step: number
  badgeClass: string
  opacity?: string
}

export type EstadoCotizacionStyle = {
  bg: string
  color: string
  label: string
  step: number
  badgeClass: string
}

export const ESTADO_VISITA_STYLES: Record<string, EstadoVisitaStyle> = {
  programada: {
    bg: 'var(--estado-creada-bg)',
    color: 'var(--estado-creada-fg)',
    border: 'var(--estado-creada-fg)',
    label: 'Programada',
    step: 0,
    badgeClass: 'is-creada',
  },
  // backward compat alias
  creada: {
    bg: 'var(--estado-creada-bg)',
    color: 'var(--estado-creada-fg)',
    border: 'var(--estado-creada-fg)',
    label: 'Programada',
    step: 0,
    badgeClass: 'is-creada',
  },
  confirmada: {
    bg: 'var(--estado-confirmada-bg)',
    color: 'var(--estado-confirmada-fg)',
    border: 'var(--estado-confirmada-fg)',
    label: 'Confirmada',
    step: 1,
    badgeClass: 'is-confirmada',
  },
  realizada: {
    bg: 'var(--estado-realizada-bg)',
    color: 'var(--estado-realizada-fg)',
    border: 'var(--estado-realizada-fg)',
    label: 'Realizada',
    step: 2,
    badgeClass: 'is-realizada',
  },
  // "completada" reutiliza el badge verde de cotización aceptada, igual que
  // en el mockup Visita Ciclo de Vida DS (ESTADOS.completada.cls = 'is-cot-aceptada')
  completada: {
    bg: 'var(--cot-aceptada-bg)',
    color: 'var(--cot-aceptada-fg)',
    border: 'var(--cot-aceptada-fg)',
    label: 'Completada',
    step: 3,
    badgeClass: 'is-cot-aceptada',
  },
  no_realizada: {
    bg: 'var(--estado-norealizada-bg)',
    color: 'var(--estado-norealizada-fg)',
    border: 'var(--estado-norealizada-fg)',
    label: 'No realizada',
    step: 3,
    badgeClass: 'is-norealizada',
  },
  cancelada: {
    bg: 'var(--estado-cancelada-bg)',
    color: 'var(--estado-cancelada-fg)',
    border: 'var(--estado-cancelada-fg)',
    label: 'Cancelada',
    step: 3,
    badgeClass: 'is-cancelada',
  },
}

export const ESTADO_COTIZACION_STYLES: Record<string, EstadoCotizacionStyle> = {
  creada: {
    bg: 'var(--cot-creada-bg)',
    color: 'var(--cot-creada-fg)',
    label: 'Creada',
    step: 0,
    badgeClass: 'is-cot-creada',
  },
  enviada: {
    bg: 'var(--cot-enviada-bg)',
    color: 'var(--cot-enviada-fg)',
    label: 'Enviada',
    step: 1,
    badgeClass: 'is-cot-enviada',
  },
  aceptada: {
    bg: 'var(--cot-aceptada-bg)',
    color: 'var(--cot-aceptada-fg)',
    label: 'Aceptada',
    step: 2,
    badgeClass: 'is-cot-aceptada',
  },
  rechazada: {
    bg: 'var(--cot-rechazada-bg)',
    color: 'var(--cot-rechazada-fg)',
    label: 'Rechazada',
    step: 2,
    badgeClass: 'is-cot-rechazada',
  },
}
