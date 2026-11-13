'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { EmptyState } from '@/components/ui/empty-state'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <>
      <PageHeader title="Algo salió mal" />
      <EmptyState
        icon={<AlertCircle />}
        title="Ocurrió un error al cargar esta página"
        description="Puedes reintentar o volver al dashboard. Si el problema persiste, avísanos."
      />
      {process.env.NODE_ENV !== 'production' && error.message && (
        <Callout tone="bad">{error.message}</Callout>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
        <Button onClick={() => reset()}>Reintentar</Button>
        <Button asChild variant="secondary">
          <Link href="/dashboard">Ir al dashboard</Link>
        </Button>
      </div>
      {error.digest && (
        <p style={{ textAlign: 'center', marginTop: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>
          Código de error: {error.digest}
        </p>
      )}
    </>
  )
}
