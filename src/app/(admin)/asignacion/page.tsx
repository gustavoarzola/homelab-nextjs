import { getVisitasParaAsignacion, getEnfermerasActivas } from '@/lib/actions/asignacion'
import { AsignacionBoard } from '@/components/asignacion-board'
import { todaySantiago } from '@/lib/format'

export default async function AsignacionPage() {
  const today = todaySantiago()
  const [visitas, enfermeras] = await Promise.all([
    getVisitasParaAsignacion(today),
    getEnfermerasActivas(),
  ])

  return (
    <div className="flex h-full flex-col">
      <AsignacionBoard
        initialFecha={today}
        initialVisitas={visitas}
        enfermeras={enfermeras}
      />
    </div>
  )
}
