import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { vi } from 'vitest'

// Load .env.local so HOMELAB_DATABASE_URL is available during tests
const envPath = join(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (!(key in process.env)) process.env[key] = value
  }
}

// Redirige la conexión a la BD de test ANTES de que cualquier test importe
// `@/db` (ese módulo lee `HOMELAB_DATABASE_URL` en el momento del import).
// Salvaguarda anti-dev: si la URL no contiene "test", abortamos — nunca
// queremos que una corrida de test toque la BD de desarrollo.
if (process.env.VITEST && process.env.HOMELAB_TEST_DATABASE_URL) {
  if (!/test/i.test(process.env.HOMELAB_TEST_DATABASE_URL)) {
    throw new Error('HOMELAB_TEST_DATABASE_URL no parece de test — abortando por seguridad')
  }
  process.env.HOMELAB_DATABASE_URL = process.env.HOMELAB_TEST_DATABASE_URL
}

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({ user: { id: 'test-user', email: 'test@example.com' } })),
}))
