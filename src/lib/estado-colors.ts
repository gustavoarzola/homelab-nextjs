export type EstadoVisitaStyle = {
  bg: string
  color: string
  border: string
  label: string
  step: number
  opacity?: string
}

export type EstadoCotizacionStyle = {
  bg: string
  color: string
  label: string
  step: number
}

export const ESTADO_VISITA_STYLES: Record<string, EstadoVisitaStyle> = {
  programada: {
    bg: 'var(--state-visita-programada-bg)',
    color: 'var(--state-visita-programada-fg)',
    border: 'var(--state-visita-programada-border)',
    label: 'Programada',
    step: 0,
  },
  // backward compat alias
  creada: {
    bg: 'var(--state-visita-programada-bg)',
    color: 'var(--state-visita-programada-fg)',
    border: 'var(--state-visita-programada-border)',
    label: 'Programada',
    step: 0,
  },
  confirmada: {
    bg: 'var(--state-visita-confirmada-bg)',
    color: 'var(--state-visita-confirmada-fg)',
    border: 'var(--state-visita-confirmada-border)',
    label: 'Confirmada',
    step: 1,
  },
  realizada: {
    bg: 'var(--state-visita-realizada-bg)',
    color: 'var(--state-visita-realizada-fg)',
    border: 'var(--state-visita-realizada-border)',
    label: 'Realizada',
    step: 2,
  },
  completada: {
    bg: 'var(--state-visita-completada-bg)',
    color: 'var(--state-visita-completada-fg)',
    border: 'var(--state-visita-completada-border)',
    label: 'Completada',
    step: 3,
  },
  no_realizada: {
    bg: 'var(--state-visita-no-realizada-bg)',
    color: 'var(--state-visita-no-realizada-fg)',
    border: 'var(--state-visita-no-realizada-border)',
    label: 'No realizada',
    step: 3,
  },
  cancelada: {
    bg: 'var(--state-visita-cancelada-bg)',
    color: 'var(--state-visita-cancelada-fg)',
    border: 'var(--state-visita-cancelada-border)',
    label: 'Cancelada',
    step: 3,
  },
}

export const ESTADO_COTIZACION_STYLES: Record<string, EstadoCotizacionStyle> = {
  creada: {
    bg: 'var(--state-cot-creada-bg)',
    color: 'var(--state-cot-creada-fg)',
    label: 'Creada',
    step: 0,
  },
  enviada: {
    bg: 'var(--state-cot-enviada-bg)',
    color: 'var(--state-cot-enviada-fg)',
    label: 'Enviada',
    step: 1,
  },
  aceptada: {
    bg: 'var(--state-cot-aceptada-bg)',
    color: 'var(--state-cot-aceptada-fg)',
    label: 'Aceptada',
    step: 2,
  },
  rechazada: {
    bg: 'var(--state-cot-rechazada-bg)',
    color: 'var(--state-cot-rechazada-fg)',
    label: 'Rechazada',
    step: 2,
  },
}
