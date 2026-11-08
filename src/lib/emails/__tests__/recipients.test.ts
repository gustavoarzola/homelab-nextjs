import { describe, expect, it } from 'vitest'
import { resolveEmailEnvelope } from '@/lib/emails/recipients'

const original = { to: 'enfermera@example.com', cc: 'contacto@homelab.cl', subject: 'Programación del 08/11/2026' }

describe('resolveEmailEnvelope', () => {
  it('con EMAIL_REDIRECT_TO manda solo a esa casilla, sin CC, y marca el asunto', () => {
    const r = resolveEmailEnvelope(original, { VERCEL_ENV: 'preview', EMAIL_REDIRECT_TO: ' qa@example.com ' })
    expect(r).toEqual({
      ok: true,
      redirected: true,
      envelope: {
        to: 'qa@example.com',
        subject: '[PRUEBA → enfermera@example.com, contacto@homelab.cl] Programación del 08/11/2026',
      },
    })
  })

  it('en preview sin EMAIL_REDIRECT_TO no envía', () => {
    const r = resolveEmailEnvelope(original, { VERCEL_ENV: 'preview' })
    expect(r.ok).toBe(false)
  })

  it('en producción sin redirección envía tal cual', () => {
    expect(resolveEmailEnvelope(original, { VERCEL_ENV: 'production' })).toEqual({
      ok: true, redirected: false, envelope: original,
    })
  })

  it('local (sin VERCEL_ENV) sin redirección envía tal cual', () => {
    expect(resolveEmailEnvelope(original, {}).ok).toBe(true)
  })
})
