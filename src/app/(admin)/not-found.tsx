import Link from 'next/link'
import { SearchX } from 'lucide-react'

import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export default function AdminNotFound() {
  return (
    <>
      <PageHeader title="Página no encontrada" />
      <EmptyState
        icon={<SearchX />}
        title="No encontramos lo que buscabas"
        description="El registro no existe o fue eliminado."
      />
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-4)' }}>
        <Button asChild>
          <Link href="/dashboard">Ir al dashboard</Link>
        </Button>
      </div>
    </>
  )
}
