import * as schema from './schema'
import { Pool } from '@neondatabase/serverless'
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless'
import postgres from 'postgres'
import { drizzle as pgDrizzle } from 'drizzle-orm/postgres-js'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core'

const connectionString = process.env.HOMELAB_DATABASE_URL

if (!connectionString) {
  throw new Error('HOMELAB_DATABASE_URL is not set')
}

/**
 * Supertipo común de ambos drivers (Neon serverless y postgres.js). Se tipa `db` con él para que
 * sus métodos sean invocables sin lidiar con la unión de clases de cada driver.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

/**
 * Conexión o transacción (lo que recibe el callback de `db.transaction`): tipo para helpers que
 * pueden correr dentro o fuera de una transacción.
 */
export type DbOrTx =
  | Db
  | PgTransaction<PgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>

// VERCEL=1 is injected automatically by Vercel in all deployments.
// Pool (WebSocket) is used on Vercel to support db.transaction().
// Locally it is absent, so postgres.js (TCP) is used with Docker.
export const db: Db = process.env.VERCEL
  ? neonDrizzle(new Pool({ connectionString }), { schema })
  : pgDrizzle(postgres(connectionString), { schema })
