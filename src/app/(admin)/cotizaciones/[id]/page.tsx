import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CotizacionForm } from '@/components/cotizacion-form'
import { getCotizacion, updateCotizacion, convertirCotizacionAVisita } from '@/lib/actions/cotizaciones'
import { getPacientes } from '@/lib/actions/pacientes'
import { getProcedimientos, getExamenes } from '@/lib/actions/catalogos'
import { getTiposRecargos } from '@/lib/actions/visitas'

export default async function CotizacionDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (isNaN(id)) return notFound()

  let cotizacion: any = null
  let pacientes: any = []
  let procedimientos: any = []
  let examenes: any = []
  let tiposRecargos: any = []

  try {
    [cotizacion, pacientes, procedimientos, examenes, tiposRecargos] = await Promise.all([
      getCotizacion(id),
      getPacientes(),
      getProcedimientos(),
      getExamenes(),
      getTiposRecargos(),
    ])
  } catch (error) {
    console.error('Error fetching cotizacion:', error)
  }

  if (!cotizacion) return notFound()

  const handleSubmit = async (fd: FormData): Promise<{ success: true; id: number } | { success: false; error: string }> => {
    'use server'
    return await updateCotizacion(fd)
  }

  const handleConvertir = async () => {
    'use server'
    const result = await convertirCotizacionAVisita(id)
    if (result.success) {
      redirect(`/visitas/${result.idVisita}`)
    }
    return result
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header with back button */}
      <div className="flex items-center gap-2">
        <Link
          href="/cotizaciones"
          className="inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-80"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </div>

      <CotizacionForm
        cotizacion={cotizacion}
        pacientes={pacientes}
        procedimientos={procedimientos}
        examenes={examenes}
        tiposRecargos={tiposRecargos}
        onSubmit={handleSubmit}
        onConvertir={handleConvertir}
      />
    </div>
  )
}
