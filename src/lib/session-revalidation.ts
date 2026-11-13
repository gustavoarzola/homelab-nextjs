import { eq } from 'drizzle-orm'
import type { DbOrTx } from '@/db'
import { users } from '@/db/schema'

/** Cada cuánto se re-valida el usuario del JWT contra la tabla `usuarios`. */
export const REVALIDATE_INTERVAL_MS = 15 * 60 * 1000

type TokenLike = { sub?: string; role?: unknown; checkedAt?: unknown; [key: string]: unknown }

export type SessionUser = { rol: string; activo: boolean }

/** Lee rol y estado activo del usuario de la sesión. */
export async function loadSessionUser(conn: DbOrTx, id: number): Promise<SessionUser | undefined> {
  const [user] = await conn
    .select({ rol: users.rol, activo: users.activo })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
  return user
}

/**
 * Re-valida un JWT contra la BD como máximo cada `REVALIDATE_INTERVAL_MS` (token.checkedAt, ms).
 * - Usuario inexistente o inactivo → `null` (Auth.js invalida la sesión).
 * - Sigue activo → actualiza `token.role` con el rol actual.
 * - Dentro del intervalo → devuelve el token sin consultar la BD.
 * `loadUser` se inyecta para poder memoizarlo por request (ver `src/auth.ts`).
 */
export async function revalidateToken<T extends TokenLike>(
  token: T,
  loadUser: (id: number) => Promise<SessionUser | undefined>,
  now: number = Date.now()
): Promise<T | null> {
  const checkedAt = typeof token.checkedAt === 'number' ? token.checkedAt : 0
  if (now - checkedAt < REVALIDATE_INTERVAL_MS) return token

  const id = Number(token.sub)
  if (!Number.isInteger(id)) return null

  const user = await loadUser(id)
  if (!user || !user.activo) return null

  return { ...token, role: user.rol, checkedAt: now }
}
