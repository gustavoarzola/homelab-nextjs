import { redirect } from 'next/navigation'
import { CotizacionForm } from '@/components/cotizacion-form'
import { getPacientes } from '@/lib/actions/pacientes'
import { getProcedimientos, getExamenes } from '@/lib/actions/catalogos'
import { getTiposRecargos } from '@/lib/actions/visitas'
import { createCotizacion } from '@/lib/actions/cotizaciones'

export default async function NuevaCotizacionPage() {
  const [pacientes, procedimientos, examenes, tiposRecargos] = await Promise.all([
    getPacientes(),
    getProcedimientos(),
    getExamenes(),
    getTiposRecargos(),
  ]).catch(() => [[], [], [], []])

  const handleSubmit = async (fd: FormData) => {
    'use server'
    const result = await createCotizacion(fd)
    if (result.success) {
      redirect(`/cotizaciones/${result.id}`)
    }
    return result
  }

  return (
    <CotizacionForm
      pacientes={pacientes}
      procedimientos={procedimientos}
      examenes={examenes}
      tiposRecargos={tiposRecargos}
      onSubmit={handleSubmit}
    />
  )
}
