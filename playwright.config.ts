import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { defineConfig, devices } from '@playwright/test'

// ─── .env.local ──────────────────────────────────────────────────────────────
//
// Playwright no carga `.env.local` automáticamente (a diferencia de
// `next dev`/`next start`, que sí lo hacen). Lo cargamos acá para poder leer
// `HOMELAB_TEST_DATABASE_URL` en este archivo (validación de seguridad +
// `webServer.env`) y en `e2e/global-setup.ts`.
function loadEnvLocal() {
  const envPath = path.join(__dirname, '.env.local')
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
loadEnvLocal()

// ─── Salvaguarda anti-dev ────────────────────────────────────────────────────
//
// El `webServer` de abajo SIEMPRE debe apuntar a `homelab_test`, nunca a la
// BD de desarrollo. Si `HOMELAB_TEST_DATABASE_URL` no está definida o no
// "parece" de test, abortamos ANTES de levantar nada.
const testDbUrl = process.env.HOMELAB_TEST_DATABASE_URL
if (!testDbUrl) {
  throw new Error(
    'HOMELAB_TEST_DATABASE_URL no está definida — requerida para correr la suite E2E (ver playwright.config.ts).'
  )
}
if (!/test/i.test(testDbUrl)) {
  throw new Error(
    'HOMELAB_TEST_DATABASE_URL no parece apuntar a una base de datos de test — abortando por seguridad.'
  )
}

const PORT = 3100
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  globalSetup: require.resolve('./e2e/global-setup.ts'),

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  // La app bajo test SIEMPRE corre contra `HOMELAB_TEST_DATABASE_URL`
  // (homelab_test), nunca contra `HOMELAB_DATABASE_URL` de desarrollo. El
  // override de `env` de abajo garantiza esto sin importar qué haya en el
  // `.env.local` del proceso que lanza Playwright.
  //
  // Se usa `next build && next start` (no `next dev`) por dos motivos:
  //   1. Next 16 rechaza levantar un segundo `next dev` sobre el mismo
  //      directorio de proyecto si ya hay uno corriendo (error "Another next
  //      dev server is already running"), y no queremos depender de que no
  //      haya un dev server local activo.
  //   2. `NEXT_DIST_DIR=.next-e2e` aísla el output del build de este
  //      `.next` normal, para no interferir con un `next dev` (ni con un
  //      build previo) que ya esté usando `.next/`.
  webServer: {
    command: `pnpm exec next build && pnpm exec next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      HOMELAB_DATABASE_URL: testDbUrl,
      NEXT_DIST_DIR: '.next-e2e',
      // Hay un `.env.production.local` en el repo (con su propio
      // HOMELAB_DATABASE_URL y VERCEL=1) que Next carga automáticamente en
      // `next start` para cualquier variable NO explícitamente presente ya
      // en el env del proceso. Si no fijamos `VERCEL` acá, Next lo toma de
      // ese archivo y `src/db/index.ts` cambia al driver serverless de Neon
      // (WebSocket) en vez de `postgres.js` — rompe la conexión contra el
      // Postgres local de Docker. `HOMELAB_DATABASE_URL` ya está cubierta
      // arriba (explícita), pero `VERCEL` no lo estaba.
      VERCEL: '',
      // NextAuth v5 solo confía automáticamente en el host de la request
      // cuando NODE_ENV !== 'production' o cuando detecta una plataforma
      // conocida (Vercel, etc.). `next start` corre con NODE_ENV=production
      // y no estamos en Vercel (VERCEL='' arriba), así que sin esto todas
      // las requests a /api/auth/* fallan con "UntrustedHost".
      AUTH_TRUST_HOST: 'true',
    } as Record<string, string>,
  },
})
