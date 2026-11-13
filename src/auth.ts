import NextAuth, { type DefaultSession } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { revalidateToken } from '@/lib/session-revalidation'

declare module 'next-auth' {
  interface Session {
    user: { role: string } & DefaultSession['user']
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
  providers: [
    Credentials({
      credentials: {
        correo: { label: 'Correo', type: 'email' },
        contrasena: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.correo || !credentials?.contrasena) return null

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.correo, credentials.correo as string))
          .limit(1)

        if (!user || !user.activo) return null

        const valid = await bcrypt.compare(
          credentials.contrasena as string,
          user.contrasena
        )

        if (!valid) return null

        return {
          id: String(user.id),
          name: user.nombre,
          email: user.correo,
          role: user.rol,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Login recién hecho: ya validado contra la BD en authorize().
        token.role = (user as { role: string }).role
        token.checkedAt = Date.now()
        return token
      }
      // Devolver null invalida la sesión (Auth.js limpia la cookie).
      // Un error de BD (p.ej. corte transitorio de Neon) no debe desloguear:
      // se mantiene el token y se reintenta en la próxima request.
      try {
        return await revalidateToken(token, db)
      } catch (err) {
        console.error('[auth] revalidación de sesión falló:', err)
        return token
      }
    },
    session({ session, token }) {
      session.user.role = token.role as string
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
