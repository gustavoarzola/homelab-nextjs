import { redirect } from 'next/navigation'

// Ruta legacy: el envío de exámenes ahora se gestiona junto con facturación y pago
// en el panel de cierre de /visitas/[id] (estado "realizada").
export default async function ResultadosVisitaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/visitas/${id}`)
}
