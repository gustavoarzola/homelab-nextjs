import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CotizacionForm } from '@/components/cotizacion-form'
import { getCotizacion, updateCotizacion, convertirCotizacionAVisita, getPreciosVisita } from '@/lib/actions/cotizaciones'
import { getPacientes } from '@/lib/actions/pacientes'
import { getProcedimientos, getExamenes, getTalleres, getIsaprePrevisiones } from '@/lib/actions/catalogos'
import { getTiposRecargos } from '@/lib/actions/visitas'

export default async function CotizacionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params
  const id = Number(idStr)
  if (isNaN(id)) return notFound()

  const [cotizacion, pacientes, procedimientos, examenes, talleres, tiposRecargos, preciosVisita, isaprePrevisiones] = await Promise.all([
    getCotizacion(id),
    getPacientes(),
    getProcedimientos(),
    getExamenes(),
    getTalleres(),
    getTiposRecargos(),
    getPreciosVisita(),
    getIsaprePrevisiones(),
  ])

  if (!cotizacion) return notFound()

  async function handleSubmit(fd: FormData): Promise<{ success: true; id: number } | { success: false; error: string }> {
    'use server'
    return await updateCotizacion(fd)
  }

  async function handleConvertir() {
    'use server'
    const result = await convertirCotizacionAVisita(id)
    if (result.success) {
      redirect(`/visitas/${result.idVisita}`)
    }
    return result
  }

  return (
    <div className="flex flex-col">
      <div className="px-8 pt-6 pb-0">
        <Link
          href="/cotizaciones"
          className="inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-80"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a cotizaciones
        </Link>
      </div>
      <CotizacionForm
        cotizacion={cotizacion}
        pacientes={pacientes}
        procedimientos={procedimientos}
        examenes={examenes}
        talleres={talleres}
        tiposRecargos={tiposRecargos}
        preciosVisita={preciosVisita}
        isaprePrevisiones={isaprePrevisiones}
        onSubmit={handleSubmit}
        onConvertir={handleConvertir}
      />
    </div>
  )
}
