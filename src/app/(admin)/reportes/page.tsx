import { getEnfermeras } from '@/lib/actions/visitas'
import { ReportesVisitas } from '@/components/reportes-visitas'

export default async function ReportesPage() {
  const enfermeras = await getEnfermeras()

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Reportes</h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Descarga los datos del sistema en Excel, con período y columnas a elección
        </p>
      </div>
      <ReportesVisitas enfermeras={enfermeras} />
    </>
  )
}
