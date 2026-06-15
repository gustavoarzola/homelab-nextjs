import { db } from '@/db'
import {
  quotations,
  quotationExams,
  quotationProcedures,
  quotationWorkshops,
  quotationSurcharges,
  patients,
  surchargeTypes,
} from '@/db/schema'
import { eq } from 'drizzle-orm'
import { formatDateLong, todaySantiago } from '@/lib/format'
import { formatNombre } from '@/lib/paciente'
import { getPrecioVisitaEnfermeria } from '@/lib/pricing/visitas'
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

  const [quotation] = await db.select().from(quotations).where(eq(quotations.id, cotizacionId))
  if (!quotation) {
    return new Response('Cotización no encontrada', { status: 404 })
  }

  const [examItems, procItems, tallerItems, patientRow, surchargesRows] = await Promise.all([
    db
      .select({ descripcion: quotationExams.descripcion, codigo: quotationExams.codigo, precio: quotationExams.precio })
      .from(quotationExams)
      .where(eq(quotationExams.idCotizacion, cotizacionId)),
    db
      .select({ descripcion: quotationProcedures.descripcion, codigo: quotationProcedures.codigo, precio: quotationProcedures.precio })
      .from(quotationProcedures)
      .where(eq(quotationProcedures.idCotizacion, cotizacionId)),
    db
      .select({ descripcion: quotationWorkshops.descripcion, codigo: quotationWorkshops.codigo, precio: quotationWorkshops.precio })
      .from(quotationWorkshops)
      .where(eq(quotationWorkshops.idCotizacion, cotizacionId)),
    quotation.idPaciente
      ? db.select().from(patients).where(eq(patients.id, quotation.idPaciente)).then((r) => r[0] ?? null)
      : Promise.resolve(null),
    db
      .select({ label: surchargeTypes.nombre, precio: quotationSurcharges.precio })
      .from(quotationSurcharges)
      .innerJoin(surchargeTypes, eq(quotationSurcharges.idTipoRecargo, surchargeTypes.id))
      .where(eq(quotationSurcharges.idCotizacion, cotizacionId)),
  ])

  const precioVisita = quotation.cobraVisita && quotation.comuna
    ? (await getPrecioVisitaEnfermeria(db, quotation.comuna)) ?? 0
    : 0

  const html = buildCotizacionHTML(mapToHTMLData({
    quotation, examItems, procItems, tallerItems, patient: patientRow, surcharges: surchargesRows, precioVisita,
  }))

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// ─── Map → CotizacionHTMLData ─────────────────────────────────────────────────

type Item = { descripcion: string; codigo: string | null; precio: number }

function mapToHTMLData({
  quotation, examItems, procItems, tallerItems, patient, surcharges, precioVisita,
}: {
  quotation: {
    id: number
    idPaciente: number | null
    nombreDestinatario: string | null
    emailDestinatario: string | null
    telefonoDestinatario: string | null
    identificacionDestinatario: string | null
    comuna: string | null
    cobraVisita: boolean
    total: number | null
    notas: string | null
    createdAt: Date
  }
  examItems: Item[]
  procItems: Item[]
  tallerItems: Item[]
  patient: { nombres: string; apellidoPaterno: string | null; apellidoMaterno: string | null; identificador: string | null; tipoIdentificador: string | null } | null
  surcharges: { label: string; precio: number }[]
  precioVisita: number
}): CotizacionHTMLData {
  const today = todaySantiago()
  const numeroDoc = formatCotizacionId(quotation.id)
  const emisionDate = quotation.createdAt.toISOString().split('T')[0] || today

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
    { label: 'N° de cotización', value: `<span style="font-family:monospace;font-size:12px;">${esc(numeroDoc)}</span>` },
  ]

  const grupos: CotizacionHTMLData['grupos'] = []
  if (examItems.length > 0) grupos.push({ label: 'Exámenes de laboratorio', items: examItems })
  if (procItems.length > 0) grupos.push({ label: 'Procedimientos de enfermería', items: procItems })
  if (tallerItems.length > 0) grupos.push({ label: 'Talleres', items: tallerItems })

  const subtotales: CotizacionHTMLData['subtotales'] = []
  const subtotalExamenes = examItems.reduce((s, e) => s + e.precio, 0)
  const subtotalProcedimientos = procItems.reduce((s, p) => s + p.precio, 0)
  const subtotalTalleres = tallerItems.reduce((s, t) => s + t.precio, 0)

  if (subtotalExamenes > 0) subtotales.push({ label: 'Subtotal exámenes', amount: subtotalExamenes })
  if (subtotalProcedimientos > 0) subtotales.push({ label: 'Subtotal procedimientos', amount: subtotalProcedimientos })
  if (subtotalTalleres > 0) subtotales.push({ label: 'Subtotal talleres', amount: subtotalTalleres })
  if (quotation.cobraVisita && precioVisita > 0)
    subtotales.push({ label: `Visita de enfermería${quotation.comuna ? ` (${quotation.comuna})` : ''}`, amount: precioVisita })
  for (const r of surcharges) {
    if (r.precio > 0) subtotales.push({ label: r.label, amount: r.precio })
  }

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
