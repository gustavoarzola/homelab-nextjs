import { signIn } from '@/auth'
import { AuthError } from 'next-auth'
import Image from 'next/image'
import { redirect } from 'next/navigation'

import { SubmitButton } from './submit-button'

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
    <div className="hl-root min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
      <div className="hl-card w-full max-w-sm">
        {/* Logo / título */}
        <div className="mb-8 text-center">
          <Image src="/homelab-logo.png" alt="HomeLab" height={64} width={124} style={{ margin: '0 auto 16px' }} priority />
          <p style={{ marginTop: 4, fontSize: 'var(--text-base)', color: 'var(--color-fg-muted)' }}>
            Gestión de visitas de enfermería
          </p>
        </div>

        {/* Error */}
        {error === 'credentials' && (
          <div className="hl-callout hl-callout--bad mb-4">
            Correo o contraseña incorrectos
          </div>
        )}

        {/* Formulario */}
        <form action={login} className="grid gap-4">
          <div className="hl-fieldgroup">
            <label htmlFor="correo">Correo electrónico</label>
            <div className="hl-input">
              <input
                id="correo"
                name="correo"
                type="email"
                required
                autoComplete="email"
                placeholder="admin@homelab.cl"
              />
            </div>
          </div>

          <div className="hl-fieldgroup">
            <label htmlFor="contrasena">Contraseña</label>
            <div className="hl-input">
              <input
                id="contrasena"
                name="contrasena"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>
          </div>

          <SubmitButton />
        </form>
      </div>
    </div>
  )
}
