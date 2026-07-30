// ─── Global setup de Vitest (Paso 3) ────────────────────────────────────────
//
// Corre UNA VEZ en el proceso principal, antes de crear los workers de test
// (ver `pool:'forks'` en vitest.config.ts). Deja la BD de test
// (`HOMELAB_TEST_DATABASE_URL`) migrada + sembrada de forma determinista.
//
// Crítico: `src/db/index.ts` lee `process.env.HOMELAB_DATABASE_URL` en el
// momento del import (top-level). Por eso acá NO se hace ningún import
// estático de `@/db` ni de `../db/seed/*` — todos son `import()` dinámicos
// que se disparan DESPUÉS de setear `process.env.HOMELAB_DATABASE_URL` a la
// URL de test. `process.env` modificado acá se propaga a los workers (Vitest
// mezcla el `process.env` del proceso principal al spawnear cada worker).
//
// Salvaguarda anti-dev: si la URL no contiene "test", abortamos. Nunca debe
// migrarse/truncarse/sembrar la BD de desarrollo.

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

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

export async function setup(): Promise<() => Promise<void>> {
  loadEnvLocal()

  const testUrl = process.env.HOMELAB_TEST_DATABASE_URL
  if (!testUrl) {
    throw new Error(
      'HOMELAB_TEST_DATABASE_URL no está definida — no se puede preparar la BD de test.'
    )
  }
  if (!/test/i.test(testUrl)) {
    throw new Error('HOMELAB_TEST_DATABASE_URL no parece de test — abortando por seguridad')
  }

  // Redirige ANTES de cualquier import dinámico de módulos que lean
  // HOMELAB_DATABASE_URL al cargar (`src/db/index.ts` la lee en el import).
  process.env.HOMELAB_DATABASE_URL = testUrl

  console.log(`[global-setup] BD de test: ${redactUrl(testUrl)}`)

  const postgres = (await import('postgres')).default
  const { drizzle } = await import('drizzle-orm/postgres-js')
  const { migrate } = await import('drizzle-orm/postgres-js/migrator')

  console.log('[global-setup] Migrando BD de test...')
  const migrationClient = postgres(testUrl, { max: 1 })
  const migrationDb = drizzle(migrationClient)
  await migrate(migrationDb, { migrationsFolder: './src/db/migrations' })
  await migrationClient.end()

  console.log('[global-setup] Sembrando BD de test (catálogos + operación determinista)...')
  const { seedCatalogos } = await import('../db/seed/catalogos')
  const { seedOperacion } = await import('../db/seed/operacion')
  const { db } = await import('../db')

  await seedCatalogos(db)
  await seedOperacion({ now: '2026-03-15', seed: 42 })

  console.log('[global-setup] BD de test lista.')

  // Teardown: cierra la conexión que abrió `../db` en este proceso principal
  // para que Vitest pueda salir limpiamente al terminar la corrida.
  return async () => {
    const client = (db as unknown as { $client?: { end: () => Promise<void> } }).$client
    await client?.end?.()
  }
}
