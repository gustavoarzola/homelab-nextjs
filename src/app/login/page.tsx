import { signIn } from '@/auth'
import { AuthError } from 'next-auth'
import { redirect } from 'next/navigation'

async function login(formData: FormData) {
  'use server'
  try {
    await signIn('credentials', {
      correo: formData.get('correo'),
      contrasena: formData.get('contrasena'),
      redirectTo: '/dashboard',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=credentials`)
    }
    throw error
  }
}

type Props = {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
      <div
        className="w-full max-w-sm rounded-xl border p-8 shadow-sm"
        style={{
          backgroundColor: 'var(--card)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Logo / título */}
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            H
          </div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Homelab
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Gestión de visitas de enfermería
          </p>
        </div>

        {/* Error */}
        {error === 'credentials' && (
          <div
            className="mb-4 rounded-lg px-4 py-3 text-sm"
            style={{
              backgroundColor: 'oklch(0.577 0.245 27.325 / 10%)',
              color: 'var(--destructive)',
              border: '1px solid oklch(0.577 0.245 27.325 / 30%)',
            }}
          >
            Correo o contraseña incorrectos
          </div>
        )}

        {/* Formulario */}
        <form action={login} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="correo"
              className="block text-sm font-medium"
              style={{ color: 'var(--foreground)' }}
            >
              Correo electrónico
            </label>
            <input
              id="correo"
              name="correo"
              type="email"
              required
              autoComplete="email"
              placeholder="admin@homelab.cl"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
              style={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--input)',
                color: 'var(--foreground)',
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="contrasena"
              className="block text-sm font-medium"
              style={{ color: 'var(--foreground)' }}
            >
              Contraseña
            </label>
            <input
              id="contrasena"
              name="contrasena"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
              style={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--input)',
                color: 'var(--foreground)',
              }}
            />
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 active:opacity-80"
            style={{
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-foreground)',
            }}
          >
            Iniciar sesión
          </button>
        </form>

        {/* Hint credenciales */}
        <div
          className="mt-6 rounded-lg p-3 text-xs space-y-1"
          style={{
            backgroundColor: 'var(--muted)',
            color: 'var(--muted-foreground)',
          }}
        >
          <p className="font-medium">Usuarios de prueba:</p>
          <p>admin@homelab.cl · admin123</p>
          <p>usuario@homelab.cl · user123</p>
        </div>
      </div>
    </div>
  )
}
