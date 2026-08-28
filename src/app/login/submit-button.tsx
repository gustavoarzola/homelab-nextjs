'use client'

import { useFormStatus } from 'react-dom'

export function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className="hl-btn hl-btn--primary" style={{ width: '100%', justifyContent: 'center' }}>
      {pending ? 'Iniciando sesión...' : 'Iniciar sesión'}
    </button>
  )
}
