import { redirect } from 'next/navigation'
import { CotizacionForm } from '@/components/cotizacion-form'
import { getPacientes } from '@/lib/actions/pacientes'
import { getProcedimientos, getExamenes, getTalleres, getIsaprePrevisiones, getComunasForSelect, getTiposRecargosForSelect } from '@/lib/actions/catalogos'
import { createCotizacion, getPreciosVisita } from '@/lib/actions/cotizaciones'

export default async function NuevaCotizacionPage() {
  const [pacientes, procedimientos, examenes, talleres, tiposRecargos, preciosVisita, isaprePrevisiones, comunas] = await Promise.all([
    getPacientes(),
    getProcedimientos(),
    getExamenes(),
    getTalleres(),
    getTiposRecargosForSelect(),
    getPreciosVisita(),
    getIsaprePrevisiones(),
    getComunasForSelect(),
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
      talleres={talleres}
      tiposRecargos={tiposRecargos}
      preciosVisita={preciosVisita}
      isaprePrevisiones={isaprePrevisiones}
      comunas={comunas}
      onSubmit={handleSubmit}
    />
  )
}
