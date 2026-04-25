import * as schema from './schema'
import { Pool } from '@neondatabase/serverless'
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless'
import postgres from 'postgres'
import { drizzle as pgDrizzle } from 'drizzle-orm/postgres-js'

const connectionString = process.env.HOMELAB_DATABASE_URL

if (!connectionString) {
  throw new Error('HOMELAB_DATABASE_URL is not set')
}

// VERCEL=1 is injected automatically by Vercel in all deployments.
// Pool (WebSocket) is used on Vercel to support db.transaction().
// Locally it is absent, so postgres.js (TCP) is used with Docker.
export const db = process.env.VERCEL
  ? neonDrizzle(new Pool({ connectionString }), { schema })
  : pgDrizzle(postgres(connectionString), { schema })
