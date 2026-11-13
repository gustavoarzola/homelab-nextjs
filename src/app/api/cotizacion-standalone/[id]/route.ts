import { getCotizacionImprimible, type CotizacionImprimible } from '@/lib/actions/cotizaciones'
import { formatDateLong, dateToSantiagoYMD } from '@/lib/format'
import { formatNombre } from '@/lib/paciente'
import { esc, formatCotizacionId, buildCotizacionHTML, type CotizacionHTMLData } from '@/lib/cotizacion-html'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const cotizacionId = Number(id)
  if (isNaN(cotizacionId)) {
    return new Response('ID inválido', { status: 400 })
  }

  const data = await getCotizacionImprimible(cotizacionId)
  if (!data) {
    return new Response('Cotización no encontrada', { status: 404 })
  }

  const html = buildCotizacionHTML(mapToHTMLData(data))

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// ─── Map → CotizacionHTMLData ─────────────────────────────────────────────────

function mapToHTMLData({
  quotation, examItems, isapreExamItems, procItems, tallerItems, patient, surcharges,
}: CotizacionImprimible): CotizacionHTMLData {
  const numeroDoc = formatCotizacionId(quotation.id)
  const emisionDate = dateToSantiagoYMD(quotation.createdAt)

  let recipientName: string
  const leftFields: CotizacionHTMLData['leftCard']['fields'] = []

  if (patient) {
    recipientName = formatNombre({ nombres: patient.nombres, apellidoPaterno: patient.apellidoPaterno ?? '' })
    leftFields.push({ label: 'Nombre', value: esc(recipientName) })
    if (patient.identificador) {
      const tipoLabel = patient.tipoIdentificador === 'rut' ? 'RUT'
        : patient.tipoIdentificador === 'pasaporte' ? 'Pasaporte' : 'Identificación'
      leftFields.push({ label: tipoLabel, value: esc(patient.identificador) })
    }
  } else {
    recipientName = quotation.nombreDestinatario ?? 'Sin nombre'
    leftFields.push({ label: 'Nombre', value: esc(recipientName) })
    if (quotation.identificacionDestinatario) leftFields.push({ label: 'Identificación', value: esc(quotation.identificacionDestinatario) })
    if (quotation.emailDestinatario) leftFields.push({ label: 'Correo', value: esc(quotation.emailDestinatario) })
    if (quotation.telefonoDestinatario) leftFields.push({ label: 'Teléfono', value: esc(quotation.telefonoDestinatario) })
  }
  if (quotation.comuna) leftFields.push({ label: 'Comuna', value: esc(quotation.comuna) })

  const rightFields: CotizacionHTMLData['rightCard']['fields'] = [
    { label: 'Fecha de emisión', value: esc(formatDateLong(emisionDate)) },
    { label: 'N° de cotización', value: `<span style="font-family:var(--font-mono);font-size:var(--text-sm);">${esc(numeroDoc)}</span>` },
  ]

  const grupos: CotizacionHTMLData['grupos'] = []
  if (examItems.length > 0) grupos.push({ label: 'Exámenes de laboratorio', items: examItems })
  if (isapreExamItems.length > 0) grupos.push({ label: 'Exámenes Isapre', items: isapreExamItems })
  if (procItems.length > 0) grupos.push({ label: 'Procedimientos de enfermería', items: procItems })
  if (tallerItems.length > 0) grupos.push({ label: 'Talleres', items: tallerItems })

  const subtotales: CotizacionHTMLData['subtotales'] = []
  const subtotalExamenes = examItems.reduce((s, e) => s + e.precio, 0) + isapreExamItems.reduce((s, e) => s + e.precio, 0)
  const subtotalProcedimientos = procItems.reduce((s, p) => s + p.precio, 0)
  const subtotalTalleres = tallerItems.reduce((s, t) => s + t.precio, 0)

  if (subtotalExamenes > 0) subtotales.push({ label: 'Subtotal exámenes', amount: subtotalExamenes })
  if (subtotalProcedimientos > 0) subtotales.push({ label: 'Subtotal procedimientos', amount: subtotalProcedimientos })
  if (quotation.montoDescuentoProcedimientos > 0)
    subtotales.push({ label: 'Descuento procedimientos', amount: -quotation.montoDescuentoProcedimientos })
  if (subtotalTalleres > 0) subtotales.push({ label: 'Subtotal talleres', amount: subtotalTalleres })
  if (quotation.cobraVisita && quotation.montoVisitaOriginal > 0)
    subtotales.push({ label: `Visita de enfermería${quotation.comuna ? ` (${quotation.comuna})` : ''}`, amount: quotation.montoVisitaOriginal })
  if (quotation.montoDescuento > 0)
    subtotales.push({ label: 'Descuento visita', amount: -quotation.montoDescuento })
  for (const r of surcharges) {
    if (r.precio > 0) subtotales.push({ label: r.label, amount: r.precio })
  }
  if (quotation.montoInsumos > 0) subtotales.push({ label: 'Insumos', amount: quotation.montoInsumos })

  return {
    numeroDoc,
    emisionDate,
    recipientLabel: recipientName,
    leftCard: { title: 'Destinatario', fields: leftFields },
    rightCard: { title: 'Datos de la cotización', fields: rightFields },
    grupos,
    subtotales,
    total: quotation.total ?? 0,
    notas: quotation.notas,
    disclaimer: 'Esta cotización es referencial y tiene una validez de 30 días desde su emisión. Los precios pueden variar según disponibilidad. Para confirmar su atención, contáctenos al número indicado.',
    autoPrint: true,
  }
}
