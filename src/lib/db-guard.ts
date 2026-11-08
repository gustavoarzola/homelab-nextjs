// Protección del build en Vercel: evita que un deployment de Preview corra
// migraciones contra la base de producción.
//
// Cada Preview tiene su propia rama de Neon (`preview/<rama-git>`), con un
// host distinto al de producción. `HOMELAB_PRODUCTION_DB_HOST` guarda el host
// de producción; si un Preview resuelve a ese host (la integración falló, se
// desactivó, etc.) el build se corta antes de `drizzle-kit migrate`.

export type DbGuardInput = {
  vercelEnv: string | undefined
  databaseUrl: string | undefined
  productionHost: string | undefined
}

export type DbGuardResult = { ok: boolean; host: string | null; message: string }

/** Host normalizado: minúsculas y sin el sufijo `-pooler` de Neon. */
export function normalizeDbHost(host: string): string {
  return host.trim().toLowerCase().replace('-pooler.', '.')
}

export function dbHostFromUrl(url: string): string | null {
  try {
    return normalizeDbHost(new URL(url).hostname)
  } catch {
    return null
  }
}

export function checkDbTarget({ vercelEnv, databaseUrl, productionHost }: DbGuardInput): DbGuardResult {
  const env = vercelEnv ?? 'local'
  const host = databaseUrl ? dbHostFromUrl(databaseUrl) : null
  const prodHost = productionHost?.trim() ? normalizeDbHost(productionHost) : null

  if (!host) {
    return { ok: false, host: null, message: `[db-guard] ${env}: no se pudo leer el host de la base de datos` }
  }

  if (env === 'preview') {
    if (!prodHost) {
      return {
        ok: false,
        host,
        message: '[db-guard] preview: falta HOMELAB_PRODUCTION_DB_HOST, no se puede verificar que la base no sea la de producción',
      }
    }
    if (host === prodHost) {
      return {
        ok: false,
        host,
        message: `[db-guard] preview: la base (${host}) es la de PRODUCCIÓN — revisa la integración de Neon (rama por preview)`,
      }
    }
    return { ok: true, host, message: `[db-guard] preview: base ${host} (rama de Neon, distinta de producción)` }
  }

  if (env === 'production' && prodHost && host !== prodHost) {
    return {
      ok: false,
      host,
      message: `[db-guard] production: la base (${host}) no coincide con HOMELAB_PRODUCTION_DB_HOST (${prodHost})`,
    }
  }

  return { ok: true, host, message: `[db-guard] ${env}: base ${host}` }
}
