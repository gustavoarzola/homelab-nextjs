import { auth } from '@/auth'
import { isAdmin } from '@/lib/permissions'

export async function requireSession() {
  const session = await auth()

  if (!session?.user) {
    throw new Error('UNAUTHORIZED')
  }

  return session
}

// Para mutaciones solo-admin. El error se llama 'ActionError' para que
// withAction/withFormAction lo devuelvan como mensaje al usuario (no se importa
// la clase desde with-action para evitar un import circular).
export async function requireAdmin() {
  const session = await requireSession()

  if (!isAdmin(session.user.role)) {
    const err = new Error('No tienes permisos para realizar esta acción')
    err.name = 'ActionError'
    throw err
  }

  return session
}
