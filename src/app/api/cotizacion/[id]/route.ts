import { getCotizacionVisita } from '@/lib/actions/precios'
import { formatDate } from '@/lib/format'
import { formatRut } from '@/lib/rut'
import { esc, formatCotizacionId, buildCotizacionHTML, type CotizacionHTMLData } from '@/lib/cotizacion-html'
import type { CotizacionVisita } from '@/lib/actions/precios'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const data = await getCotizacionVisita(Number(id))

  if (!data) {
    return new Response('Visita no encontrada', { status: 404 })
  }

  const html = buildCotizacionHTML(mapToHTMLData(data))

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// ─── Map CotizacionVisita → CotizacionHTMLData ────────────────────────────────

const PREVISION_LABELS: Record<string, string> = {
  fonasa: 'Fonasa',
  isapre: 'Isapre',
  particular: 'Particular',
}

function formatId(tipo: string | null, valor: string | null): string {
  if (!valor) return ''
  if (tipo === 'rut') return esc(formatRut(valor))
  if (tipo === 'pasaporte') return `Pasaporte ${esc(valor)}`
  return esc(valor)
}

function mapToHTMLData(data: CotizacionVisita): CotizacionHTMLData {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
  const numeroDoc = formatCotizacionId(data.id)
  const visitaRef = `VIS-${String(data.id).padStart(5, '0')}`

  const examenes = data.items.filter((i) => i.tipo === 'examen')
  const procedimientos = data.items.filter((i) => i.tipo === 'procedimiento')
  const talleres = data.items.filter((i) => i.tipo === 'taller')
  const visitaItem = data.items.find((i) => i.tipo === 'visita')

  const leftFields = [
    { label: 'Nombre completo', value: esc(data.paciente.nombreCompleto) },
    data.paciente.identificador
      ? {
          label: data.paciente.tipoIdentificador === 'rut' ? 'RUT'
            : data.paciente.tipoIdentificador === 'pasaporte' ? 'Pasaporte' : 'Identificador',
          value: formatId(data.paciente.tipoIdentificador, data.paciente.identificador),
        }
      : null,
    data.paciente.fechaNacimiento
      ? { label: 'Fecha de nacimiento', value: esc(formatDate(data.paciente.fechaNacimiento)) }
      : null,
    data.paciente.prevision
      ? { label: 'Previsión', value: `${esc(data.paciente.prevision)} <span style="font-size:11px;color:#94a3b8;">(${PREVISION_LABELS[data.tipoPrevision] ?? ''})</span>` }
      : null,
    data.paciente.direccion
      ? { label: 'Dirección', value: esc(data.paciente.direccion), small: true as const }
      : null,
  ].filter(Boolean) as CotizacionHTMLData['leftCard']['fields']

  const rightFields = [
    { label: 'Fecha', value: esc(data.fecha) },
    data.hora ? { label: 'Hora', value: esc(data.hora.slice(0, 5)) } : null,
    data.enfermera ? { label: 'Enfermera', value: esc(data.enfermera) } : null,
    { label: 'N° de referencia', value: `<span style="font-family:monospace;font-size:12px;">${esc(visitaRef)}</span>` },
  ].filter(Boolean) as CotizacionHTMLData['rightCard']['fields']

  const grupos: CotizacionHTMLData['grupos'] = []
  if (examenes.length > 0) grupos.push({ label: 'Exámenes de laboratorio', items: examenes })
  if (procedimientos.length > 0) grupos.push({ label: 'Procedimientos de enfermería', items: procedimientos })
  if (talleres.length > 0) grupos.push({ label: 'Talleres', items: talleres })
  if (visitaItem) grupos.push({ label: 'Traslado y atención', items: [visitaItem] })

  const subtotales: CotizacionHTMLData['subtotales'] = []
  if (examenes.length > 0 && data.subtotalExamenes > 0)
    subtotales.push({ label: 'Subtotal exámenes', amount: data.subtotalExamenes })
  const subtotalProc = procedimientos.reduce((s, p) => s + (p.precio ?? 0), 0)
  if (subtotalProc > 0)
    subtotales.push({ label: 'Subtotal procedimientos', amount: subtotalProc })
  if (data.subtotalTalleres > 0)
    subtotales.push({ label: 'Subtotal talleres', amount: data.subtotalTalleres })
  if (data.costoVisitaEnfermeria > 0)
    subtotales.push({ label: 'Visita de enfermería', amount: data.costoVisitaEnfermeria })
  for (const r of data.recargos) {
    if (r.precio > 0) subtotales.push({ label: r.nombre, amount: r.precio })
  }

  return {
    numeroDoc,
    emisionDate: today,
    recipientLabel: data.paciente.nombreCompleto ?? '',
    leftCard: { title: 'Paciente', fields: leftFields },
    rightCard: { title: 'Datos de la visita', fields: rightFields },
    grupos,
    subtotales,
    total: data.total,
    disclaimer: 'Esta cotización es referencial y tiene una validez de 30 días desde su emisión. Los precios pueden variar según disponibilidad. Para confirmar su visita, contáctenos al número indicado.',
  }
}
