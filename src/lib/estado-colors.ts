export type EstadoVisitaStyle = {
  bg: string
  color: string
  border: string
  label: string
  opacity?: string
}

export type EstadoCotizacionStyle = {
  bg: string
  color: string
  label: string
  step: number
}

export const ESTADO_VISITA_STYLES: Record<string, EstadoVisitaStyle> = {
  creada: {
    bg: 'var(--state-visita-creada-bg)',
    color: 'var(--state-visita-creada-fg)',
    border: 'var(--state-visita-creada-border)',
    label: 'Creada',
  },
  confirmada: {
    bg: 'var(--state-visita-confirmada-bg)',
    color: 'var(--state-visita-confirmada-fg)',
    border: 'var(--state-visita-confirmada-border)',
    label: 'Confirmada',
  },
  realizada: {
    bg: 'var(--state-visita-realizada-bg)',
    color: 'var(--state-visita-realizada-fg)',
    border: 'var(--state-visita-realizada-border)',
    label: 'Realizada',
  },
  cancelada: {
    bg: 'var(--muted)',
    color: 'var(--muted-foreground)',
    border: 'var(--border)',
    label: 'Cancelada',
    opacity: '0.6',
  },
  no_realizada: {
    bg: 'var(--state-visita-no-realizada-bg)',
    color: 'var(--state-visita-no-realizada-fg)',
    border: 'var(--state-visita-no-realizada-border)',
    label: 'No realizada',
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
