import { notFound } from 'next/navigation'
import {
  getVisitaLifecycle,
  confirmarVisita,
  marcarRealizada,
  marcarNoRealizada,
  cancelarVisita,
  completarVisita,
} from '@/lib/actions/visitas'
import { VisitaLifecycleView } from '@/components/visita-lifecycle-view'
import type { CompletarVisitaData } from '@/lib/actions/visitas'

export const dynamic = 'force-dynamic'

export default async function VisitaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const idVisita = Number(id)
  if (!idVisita) notFound()

  const visita = await getVisitaLifecycle(idVisita)
  if (!visita) notFound()

  async function handleConfirmar() {
    'use server'
    return confirmarVisita(idVisita)
  }

  async function handleMarcarRealizada() {
    'use server'
    return marcarRealizada(idVisita)
  }

  async function handleMarcarNoRealizada(costo: number, concepto: string) {
    'use server'
    return marcarNoRealizada(idVisita, costo, concepto)
  }

  async function handleCancelar(motivo: string) {
    'use server'
    return cancelarVisita(idVisita, motivo)
  }

  async function handleCompletar(data: CompletarVisitaData) {
    'use server'
    return completarVisita(idVisita, data)
  }

  return (
    <VisitaLifecycleView
      visita={visita}
      onConfirmar={handleConfirmar}
      onMarcarRealizada={handleMarcarRealizada}
      onMarcarNoRealizada={handleMarcarNoRealizada}
      onCancelar={handleCancelar}
      onCompletar={handleCompletar}
    />
  )
}
