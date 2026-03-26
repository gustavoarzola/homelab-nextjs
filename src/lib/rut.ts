/**
 * Validates and normalizes a Chilean RUT.
 * Accepts formats: 12345678-9, 12.345.678-9, 123456789 (with check digit appended)
 * Returns { valid: true, normalized: '123456789' } (no dots/hyphens) or { valid: false }
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

  return { valid: true, normalized: body + dv }
}

/**
 * Formats a stored RUT (no dots/hyphens, e.g. '123456785') for display ('12.345.678-5').
 */
export function formatRut(stored: string): string {
  const match = stored.match(/^(\d{7,8})([0-9K])$/i)
  if (!match) return stored
  const n = parseInt(match[1]!, 10)
  const dv = match[2]!.toUpperCase()
  const parts: string[] = []
  let rem = n
  while (rem >= 1000) {
    parts.unshift(String(rem % 1000).padStart(3, '0'))
    rem = Math.floor(rem / 1000)
  }
  parts.unshift(String(rem))
  return parts.join('.') + '-' + dv
}

/**
 * Validates a passport number: alphanumeric, 8-16 characters.
 * Returns normalized (uppercase) or invalid.
 */
export function validatePasaporte(raw: string): { valid: true; normalized: string } | { valid: false } {
  const clean = raw.trim().toUpperCase()
  if (!/^[A-Z0-9]{8,16}$/.test(clean)) return { valid: false }
  return { valid: true, normalized: clean }
}
