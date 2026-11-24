// Estados a los que un admin puede devolver una visita (cambiarEstadoVisita) para
// que el ejecutivo la corrija, en vez de borrarla y crear otra. Los estados
// terminales (completada, no_realizada, cancelada) se alcanzan solo por su flujo
// normal, que pide sus datos propios (motivo, costo de traslado, boleta…).
export const ESTADOS_REABRIBLES = ['programada', 'confirmada', 'realizada'] as const
export type EstadoReabrible = (typeof ESTADOS_REABRIBLES)[number]
