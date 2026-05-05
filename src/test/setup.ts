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

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({ user: { id: 'test-user', email: 'test@example.com' } })),
}))
