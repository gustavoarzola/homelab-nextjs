import { getEnfermeras } from '@/lib/actions/visitas'
import { ReportesVisitas } from '@/components/reportes-visitas'
import { PageHeader } from '@/components/page-header'

export default async function ReportesPage() {
  const enfermeras = await getEnfermeras()

  return (
    <>
      <PageHeader title="Reportes" meta="Descarga los datos del sistema en Excel, con período y columnas a elección" />
      <ReportesVisitas enfermeras={enfermeras} />
    </>
  )
}
