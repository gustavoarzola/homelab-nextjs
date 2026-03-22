import NextAuth, { type DefaultSession } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

declare module 'next-auth' {
  interface Session {
    user: { role: string } & DefaultSession['user']
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
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
    jwt({ token, user }) {
      if (user) token.role = (user as { role: string }).role
      return token
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
