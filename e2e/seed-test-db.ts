// ─── Script de seed E2E (ejecutado vía `tsx`, como proceso aparte) ──────────
//
// Migra + siembra `HOMELAB_DATABASE_URL` (que el proceso padre —
// e2e/global-setup.ts— ya redirigió a la BD de test) con el MISMO (now, seed)
// que usa `src/test/global-setup.ts` (Vitest), para reproducibilidad entre
// ambas suites.
//
// Por qué un proceso aparte: el runtime de Playwright no transpila imports
// `.ts` dinámicos fuera de sus propios archivos de test (a diferencia de
// Vitest, que sí instrumenta todo el árbol de imports). Un `await
// import('../src/db/seed/catalogos')` directo desde
// `e2e/global-setup.ts` falla con "Cannot use import statement outside a
// module". Corriendo este script vía `tsx` (igual que `pnpm db:seed`, que ya
// usa exactamente este mecanismo) evita el problema por completo.
//
// Salvaguarda anti-dev repetida acá también (además de en
// e2e/global-setup.ts, que es quien construye `HOMELAB_DATABASE_URL`): nunca
// debe migrarse/sembrar la BD de desarrollo.

import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

async function main() {
  const testUrl = process.env.HOMELAB_DATABASE_URL
  if (!testUrl) {
    throw new Error('HOMELAB_DATABASE_URL no está definida en el proceso de seed E2E.')
  }
  if (!/test/i.test(testUrl)) {
    throw new Error('HOMELAB_DATABASE_URL no parece de test — abortando seed E2E por seguridad.')
  }

  console.log('[e2e/seed-test-db] Migrando BD de test...')
  const migrationClient = postgres(testUrl, { max: 1 })
  const migrationDb = drizzle(migrationClient)
  await migrate(migrationDb, { migrationsFolder: './src/db/migrations' })
  await migrationClient.end()

  console.log('[e2e/seed-test-db] Sembrando BD de test (catálogos + operación determinista)...')
  const { seedCatalogos } = await import('../src/db/seed/catalogos')
  const { seedOperacion } = await import('../src/db/seed/operacion')
  const { db } = await import('../src/db')

  await seedCatalogos(db)
  await seedOperacion({ now: '2026-03-15', seed: 42 })

  const client = (db as unknown as { $client?: { end: () => Promise<void> } }).$client
  await client?.end?.()

  console.log('[e2e/seed-test-db] BD de test lista.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seed E2E fallido:', err?.message ?? err)
    if (err?.cause) console.error('   Causa:', err.cause)
    process.exit(1)
  })
