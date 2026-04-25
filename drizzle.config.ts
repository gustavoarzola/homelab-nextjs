import type { Config } from 'drizzle-kit'


const url = process.env.HOMELAB_DATABASE_URL_UNPOOLED 
  ?? process.env.HOMELAB_DATABASE_URL

if (!url) {
  throw new Error(
    'Database URL not set. Define HOMELAB_DATABASE_URL_UNPOOLED or HOMELAB_DATABASE_URL in your environment.'
  )
}

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
} satisfies Config
