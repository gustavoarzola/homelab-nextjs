import { describe, expect, it } from 'vitest'
import { checkDbTarget, dbHostFromUrl, normalizeDbHost } from '@/lib/db-guard'

const PROD = 'ep-prod-123.us-east-1.aws.neon.tech'
const prodUrl = `postgresql://u:p@${PROD}/db?sslmode=require`
const prodPoolerUrl = 'postgresql://u:p@ep-prod-123-pooler.us-east-1.aws.neon.tech/db'
const branchUrl = 'postgresql://u:p@ep-branch-999.us-east-1.aws.neon.tech/db'

describe('normalizeDbHost / dbHostFromUrl', () => {
  it('quita el sufijo -pooler y normaliza mayúsculas', () => {
    expect(normalizeDbHost('EP-PROD-123-POOLER.us-east-1.aws.neon.tech')).toBe(PROD)
    expect(dbHostFromUrl(prodPoolerUrl)).toBe(PROD)
  })
  it('devuelve null con una URL inválida', () => {
    expect(dbHostFromUrl('no-es-url')).toBeNull()
  })
})

describe('checkDbTarget', () => {
  it('preview con rama de Neon distinta: ok', () => {
    const r = checkDbTarget({ vercelEnv: 'preview', databaseUrl: branchUrl, productionHost: PROD })
    expect(r.ok).toBe(true)
    expect(r.host).toBe('ep-branch-999.us-east-1.aws.neon.tech')
  })

  it('preview apuntando a producción: falla (también vía pooler)', () => {
    expect(checkDbTarget({ vercelEnv: 'preview', databaseUrl: prodUrl, productionHost: PROD }).ok).toBe(false)
    expect(checkDbTarget({ vercelEnv: 'preview', databaseUrl: prodPoolerUrl, productionHost: PROD }).ok).toBe(false)
  })

  it('preview sin HOMELAB_PRODUCTION_DB_HOST: falla (fail-closed)', () => {
    expect(checkDbTarget({ vercelEnv: 'preview', databaseUrl: branchUrl, productionHost: undefined }).ok).toBe(false)
  })

  it('production con el host esperado: ok; con otro host: falla', () => {
    expect(checkDbTarget({ vercelEnv: 'production', databaseUrl: prodPoolerUrl, productionHost: PROD }).ok).toBe(true)
    expect(checkDbTarget({ vercelEnv: 'production', databaseUrl: branchUrl, productionHost: PROD }).ok).toBe(false)
  })

  it('production sin variable configurada: no bloquea', () => {
    expect(checkDbTarget({ vercelEnv: 'production', databaseUrl: prodUrl, productionHost: undefined }).ok).toBe(true)
  })

  it('sin URL de base: falla', () => {
    expect(checkDbTarget({ vercelEnv: 'preview', databaseUrl: undefined, productionHost: PROD }).ok).toBe(false)
  })
})
