/**
 * Validates and normalizes a Chilean RUT.
 * Accepts formats: 12345678-9, 12.345.678-9, 123456789 (with check digit appended)
 * Returns { valid: true, normalized: '12.345.678-9' } or { valid: false }
 */
export function validateRut(raw: string): { valid: true; normalized: string } | { valid: false } {
  const clean = raw.replace(/[\s.]/g, '').toUpperCase()
  if (!/^\d{7,8}[-]?[\dK]$/.test(clean)) return { valid: false }

  const [body, dv] = clean.includes('-') ? clean.split('-') : [clean.slice(0, -1), clean.slice(-1)]

  if (!body || !dv) return { valid: false }

  let sum = 0
  let factor = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]!) * factor
    factor = factor === 7 ? 2 : factor + 1
  }

  const expected = 11 - (sum % 11)
  const expectedDv = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected)

  if (dv !== expectedDv) return { valid: false }

  const n = parseInt(body)
  const normalized = `${Math.floor(n / 1_000_000)}.${String(Math.floor((n % 1_000_000) / 1_000)).padStart(3, '0')}.${String(n % 1_000).padStart(3, '0')}-${dv}`

  return { valid: true, normalized }
}
