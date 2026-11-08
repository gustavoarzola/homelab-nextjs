// Destinatarios reales de un correo de salida según el ambiente.
//
// - `EMAIL_REDIRECT_TO` definida: todo se manda solo a esa casilla (sin CC) y el
//   asunto indica a quién iba dirigido. Pensado para Preview/Development.
// - Preview sin `EMAIL_REDIRECT_TO`: no se envía nada (fail-closed), para que un
//   preview —que trabaja sobre una copia de la base con correos reales— nunca
//   escriba a enfermeras o pacientes.
// - Producción / local sin redirección: se envía tal cual.

export type EmailEnvelope = { to: string; cc?: string; subject: string }

export type ResolvedEnvelope =
  | { ok: true; envelope: EmailEnvelope; redirected: boolean }
  | { ok: false; error: string }

type Env = Record<string, string | undefined>

export function resolveEmailEnvelope(original: EmailEnvelope, env: Env = process.env): ResolvedEnvelope {
  const redirectTo = env.EMAIL_REDIRECT_TO?.trim()

  if (redirectTo) {
    const destinatarios = [original.to, original.cc].filter(Boolean).join(', ')
    return {
      ok: true,
      redirected: true,
      envelope: { to: redirectTo, subject: `[PRUEBA → ${destinatarios}] ${original.subject}` },
    }
  }

  if (env.VERCEL_ENV === 'preview') {
    return {
      ok: false,
      error: 'Envío de correos deshabilitado en este preview: falta EMAIL_REDIRECT_TO',
    }
  }

  return { ok: true, redirected: false, envelope: original }
}
