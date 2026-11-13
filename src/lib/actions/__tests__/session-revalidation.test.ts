import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { REVALIDATE_INTERVAL_MS, loadSessionUser, revalidateToken } from '@/lib/session-revalidation'

const loadUser = (id: number) => loadSessionUser(db, id)

describe('revalidateToken', () => {
  let userId: number
  const now = 1_800_000_000_000

  beforeAll(async () => {
    const [u] = await db
      .insert(users)
      .values({
        nombre: 'Test Sesion',
        correo: `sesion-${Date.now()}@test.local`,
        contrasena: 'x',
        rol: 'ejecutivo',
        activo: true,
      })
      .returning({ id: users.id })
    userId = u!.id
  })

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, userId))
  })

  it('no consulta la BD dentro del intervalo', async () => {
    const token = { sub: '999999999', role: 'admin', checkedAt: now - 1000 }
    expect(await revalidateToken(token, loadUser, now)).toBe(token)
  })

  it('usuario activo: actualiza rol y checkedAt', async () => {
    const token = { sub: String(userId), role: 'admin', checkedAt: now - REVALIDATE_INTERVAL_MS }
    const res = await revalidateToken(token, loadUser, now)
    expect(res).toMatchObject({ role: 'ejecutivo', checkedAt: now })
  })

  it('usuario inactivo → null', async () => {
    await db.update(users).set({ activo: false }).where(eq(users.id, userId))
    const res = await revalidateToken({ sub: String(userId), checkedAt: 0 }, loadUser, now)
    expect(res).toBeNull()
    await db.update(users).set({ activo: true }).where(eq(users.id, userId))
  })

  it('usuario inexistente o sub inválido → null', async () => {
    expect(await revalidateToken({ sub: '999999999', checkedAt: 0 }, loadUser, now)).toBeNull()
    expect(await revalidateToken({ checkedAt: 0 }, loadUser, now)).toBeNull()
  })
})
