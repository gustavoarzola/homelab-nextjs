// Se ejecuta en `vercel-build` antes de `drizzle-kit migrate`. Ver src/lib/db-guard.ts.
import { checkDbTarget } from '../src/lib/db-guard'

const result = checkDbTarget({
  vercelEnv: process.env.VERCEL_ENV,
  // Misma resolución que drizzle.config.ts
  databaseUrl: process.env.HOMELAB_DATABASE_URL_UNPOOLED ?? process.env.HOMELAB_DATABASE_URL,
  productionHost: process.env.HOMELAB_PRODUCTION_DB_HOST,
})

if (result.ok) {
  console.log(result.message)
} else {
  console.error(result.message)
  process.exit(1)
}
