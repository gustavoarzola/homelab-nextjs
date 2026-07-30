// ─── CLI de seed ─────────────────────────────────────────────────────────────
//
// Punto de entrada único:
//   pnpm db:seed             → seedCatalogos() + seedOperacion({ now: hoy, seed: 42 })
//   pnpm db:seed:catalogos   → solo seedCatalogos() (prod-safe, idempotente)
//
// `seedOperacion` acepta `(now, seed)` explícitos para permitir corridas
// deterministas reproducibles (usado por la BD de test, Paso 3), pero el CLI
// de dev siempre ancla `now` a "hoy" en zona Santiago.
//
// El bloque `require.main === module` evita que el seed se dispare solo por
// importar `seedCatalogos`/`seedOperacion` desde otro módulo (p. ej. el
// globalSetup de tests del Paso 3).

import { db } from '../index'
import { seedCatalogos } from './catalogos'
import { seedOperacion } from './operacion'
import { todaySantiago } from '@/lib/format'

export { seedCatalogos } from './catalogos'
export { seedOperacion } from './operacion'

async function main() {
  const catalogosOnly = process.argv.includes('--catalogos-only')

  console.log('🌱 Seeding database...')
  await seedCatalogos(db)

  if (!catalogosOnly) {
    await seedOperacion({ now: todaySantiago(), seed: 42 })
  }

  console.log('✅ Seed completado.')
  if (!catalogosOnly) {
    console.log('   admin@homelab.cl   / admin123  (rol: admin)')
    console.log('   usuario@homelab.cl / user123   (rol: usuario)')
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seed fallido:', err?.message ?? err)
      if (err?.cause) console.error('   Causa:', err.cause)
      process.exit(1)
    })
}
