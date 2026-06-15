import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CotizacionForm } from '@/components/cotizacion-form'
import { getCotizacion, updateCotizacion } from '@/lib/actions/cotizaciones'
import { getPacientes } from '@/lib/actions/pacientes'
import { getProcedimientos, getExamenes, getTalleres, getIsaprePrevisiones } from '@/lib/actions/catalogos'
import { getTiposRecargos } from '@/lib/actions/visitas'
import { getPreciosVisita } from '@/lib/actions/cotizaciones'

export default async function CotizacionEditarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params
  const id = Number(idStr)
  if (isNaN(id)) return notFound()

  const cotizacion = await getCotizacion(id)
  if (!cotizacion) return notFound()

  if (cotizacion.estado !== 'creada') {
    redirect(`/cotizaciones/${id}`)
  }

  const [pacientes, procedimientos, examenes, talleres, tiposRecargos, preciosVisita, isaprePrevisiones] =
    await Promise.all([
      getPacientes(),
      getProcedimientos(),
      getExamenes(),
      getTalleres(),
      getTiposRecargos(),
      getPreciosVisita(),
      getIsaprePrevisiones(),
    ])

  async function handleSubmit(fd: FormData): Promise<{ success: true; data: { id: number } } | { success: false; error: string }> {
    'use server'
    const result = await updateCotizacion(fd)
    if (result.success) {
      redirect(`/cotizaciones/${id}`)
    }
    return result
  }

  return (
    <div className="-m-8 flex flex-col">
      <div className="px-8 pt-6 pb-0">
        <Link
          href={`/cotizaciones/${id}`}
          className="inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-80"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a cotización
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
      />
    </div>
  )
}
