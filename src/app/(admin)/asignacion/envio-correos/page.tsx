import { getVisitasAsignadasPorEnfermera } from '@/lib/actions/visitas-asignacion-email'
import { AsignacionEnvioCorreos } from '@/components/asignacion-envio-correos'
import { todaySantiago } from '@/lib/format'

export default async function EnvioCorreosPage() {
  const today = todaySantiago()
  const enfermeras = await getVisitasAsignadasPorEnfermera(today)

  return <AsignacionEnvioCorreos initialFecha={today} initialEnfermeras={enfermeras} />
}
