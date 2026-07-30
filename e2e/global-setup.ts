// ─── Global setup de Playwright (Paso 5) ────────────────────────────────────
//
// Corre UNA VEZ antes de todos los tests (y en paralelo al arranque del
// `webServer`, ver `playwright.config.ts`). Deja la BD de test
// (`HOMELAB_TEST_DATABASE_URL`) migrada + sembrada de forma determinista, con
// el MISMO `(now, seed)` que usa `src/test/global-setup.ts` (Vitest) para que
// ambas suites vean datos equivalentes.
//
// El trabajo real (migrar + `seedCatalogos`/`seedOperacion`) se delega a
// `e2e/seed-test-db.ts`, ejecutado como proceso aparte vía `tsx` — el
// runtime de Playwright no transpila imports `.ts` dinámicos fuera de sus
// propios archivos de test, así que un `await import('../src/db/seed/...')`
// directo en este archivo falla ("Cannot use import statement outside a
// module"). `tsx` es exactamente el mecanismo que ya usa `pnpm db:seed`
// (`tsx --env-file=.env.local src/db/seed/index.ts`), así que es un patrón
// probado en este repo.
//
// Este archivo es una adaptación deliberada de `src/test/global-setup.ts`
// (que no se debe modificar — ver plan del Paso 5), no una reescritura de su
// lógica de seed: reusa `seedCatalogos`/`seedOperacion` sin duplicarlos.
//
// Salvaguarda anti-dev: si la URL no contiene "test", abortamos. Nunca debe
// migrarse/truncarse/sembrar la BD de desarrollo.

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { execFileSync } from 'child_process'

function loadEnvLocal() {
  const envPath = join(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
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

function redactUrl(url: string): string {
  return url.replace(/:[^:@/]+@/, ':***@')
}

export default async function globalSetup(): Promise<void> {
  loadEnvLocal()

  const testUrl = process.env.HOMELAB_TEST_DATABASE_URL
  if (!testUrl) {
    throw new Error(
      'HOMELAB_TEST_DATABASE_URL no está definida — no se puede preparar la BD de test para E2E.'
    )
  }
  if (!/test/i.test(testUrl)) {
    throw new Error('HOMELAB_TEST_DATABASE_URL no parece de test — abortando por seguridad')
  }

  console.log(`[e2e/global-setup] BD de test: ${redactUrl(testUrl)}`)

  execFileSync('pnpm', ['exec', 'tsx', 'e2e/seed-test-db.ts'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      // Redirige explícitamente a la BD de test para el proceso hijo — NUNCA
      // a HOMELAB_DATABASE_URL de desarrollo, sin importar qué haya en
      // process.env del proceso que lanza Playwright.
      HOMELAB_DATABASE_URL: testUrl,
    },
  })

  console.log('[e2e/global-setup] BD de test lista.')
}
