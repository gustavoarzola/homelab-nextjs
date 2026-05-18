import { redirect } from 'next/navigation'
import { CotizacionForm } from '@/components/cotizacion-form'
import { getPacientes } from '@/lib/actions/pacientes'
import { getProcedimientos, getExamenes } from '@/lib/actions/catalogos'
import { getTiposRecargos } from '@/lib/actions/visitas'
import { createCotizacion, getPreciosVisita } from '@/lib/actions/cotizaciones'

export default async function NuevaCotizacionPage() {
  const [pacientes, procedimientos, examenes, tiposRecargos, preciosVisita] = await Promise.all([
    getPacientes(),
    getProcedimientos(),
    getExamenes(),
    getTiposRecargos(),
    getPreciosVisita(),
  ])

  async function handleSubmit(fd: FormData) {
    'use server'
    return await createCotizacion(fd)
  }

  return (
    <CotizacionForm
      pacientes={pacientes}
      procedimientos={procedimientos}
      examenes={examenes}
      tiposRecargos={tiposRecargos}
      preciosVisita={preciosVisita}
      onSubmit={handleSubmit}
    />
  )
}
