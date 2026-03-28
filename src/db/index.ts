import * as schema from './schema'
import { neon } from '@neondatabase/serverless'
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-http'
import postgres from 'postgres'
import { drizzle as pgDrizzle } from 'drizzle-orm/postgres-js'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

// VERCEL=1 is injected automatically by Vercel in all deployments.
// Locally it is absent, so postgres.js (TCP) is used with Docker.
export const db = process.env.VERCEL
  ? neonDrizzle(neon(connectionString), { schema })
  : pgDrizzle(postgres(connectionString), { schema })
