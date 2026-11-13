import { eq } from 'drizzle-orm'
import type { Db } from '@/db'
import { users } from '@/db/schema'

/** Cada cuánto se re-valida el usuario del JWT contra la tabla `usuarios`. */
export const REVALIDATE_INTERVAL_MS = 15 * 60 * 1000

type TokenLike = { sub?: string; role?: unknown; checkedAt?: unknown; [key: string]: unknown }

/**
 * Re-valida un JWT contra la BD como máximo cada `REVALIDATE_INTERVAL_MS` (token.checkedAt, ms).
 * - Usuario inexistente o inactivo → `null` (Auth.js invalida la sesión).
 * - Sigue activo → actualiza `token.role` con el rol actual.
 * - Dentro del intervalo → devuelve el token sin consultar la BD.
 */
export async function revalidateToken<T extends TokenLike>(
  token: T,
  conn: Pick<Db, 'select'>,
  now: number = Date.now()
): Promise<T | null> {
  const checkedAt = typeof token.checkedAt === 'number' ? token.checkedAt : 0
  if (now - checkedAt < REVALIDATE_INTERVAL_MS) return token

  const id = Number(token.sub)
  if (!Number.isInteger(id)) return null

  const [user] = await conn
    .select({ rol: users.rol, activo: users.activo })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)

  if (!user || !user.activo) return null

  return { ...token, role: user.rol, checkedAt: now }
}
