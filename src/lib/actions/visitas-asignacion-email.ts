'use server'

import { db } from '@/db'
import {
  visits, patients, addresses, laboratories, nurses,
  visitProcedures, visitExams, procedures, exams,
  healthInsurances, patientPhones,
  visitWorkshops, workshops, elderlyResidences, surchargeTypes,
} from '@/db/schema'
import { eq, and, inArray, asc } from 'drizzle-orm'
import { Resend } from 'resend'
import { formatDateFull, formatDateLong, formatDate, parseDateLocal } from '@/lib/format'
import { requireSession } from '@/lib/auth-guard'
import { formatNombre } from '@/lib/paciente'
import { getR2Object } from '@/lib/r2'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VisitaConDetalles = {
  id: number
  idEnfermera: number | null
  keyOrdenMedica: string | null
  fecha: string
  hora: string | null
  paciente: {
    nombres: string
    apellidoPaterno: string
    apellidoMaterno: string | null
    tipoIdentificador: string | null
    identificador: string | null
    fechaNacimiento: string | null
    correo: string | null
    informacionAdicional: string | null
    previsión: string | null
  }
  telefonos: string[]
  dirección: {
    dirección: string
    comuna: string | null
    areaAdministrativa1: string | null
    areaAdministrativa2: string | null
  }
  laboratorio: string | null
  procedimientos: string[]
  exámenes: string[]
  talleres: string[]
  residenciaAdultoMayor: string | null
  informacionAdicional: string | null
  costo: number
  costoTraslado: number
  montoRecargo: number
  tipoRecargo: string | null
}

export type EnfermeraConVisitas = {
  id: number
  nombres: string
  apellidoPaterno: string
  correo: string | null
  visitas: VisitaConDetalles[]
}

export type Result = { success: boolean; error?: string }

// ─── getVisitasAsignadasPorEnfermera ──────────────────────────────────────────

export async function getVisitasAsignadasPorEnfermera(
  fecha: string,
): Promise<EnfermeraConVisitas[]> {
  await requireSession()

  // Obtener todas las enfermeras con visitas en esa fecha
  const nursesWithVisits = await db
    .selectDistinct({ id: nurses.id })
    .from(nurses)
    .innerJoin(visits, eq(nurses.id, visits.idEnfermera))
    .where(eq(visits.fecha, fecha))

  if (!nursesWithVisits.length) return []

  const nurseIds = nursesWithVisits.map((n) => n.id)

  // Obtener datos de enfermeras y visitas detalladas en paralelo
  const [nursesData, visitasDetalladas] = await Promise.all([
    db
      .select({
        id: nurses.id,
        nombres: nurses.nombres,
        apellidoPaterno: nurses.apellidoPaterno,
        correo: nurses.correo,
      })
      .from(nurses)
      .where(inArray(nurses.id, nurseIds))
      .orderBy(asc(nurses.apellidoPaterno)),
    getVisitasConDetalles(fecha, nurseIds),
  ])

  // Agrupar visitas por idEnfermera directamente (sin query extra)
  const visitasPorEnfermera = new Map<number, VisitaConDetalles[]>()
  for (const v of visitasDetalladas) {
    const arr = visitasPorEnfermera.get(v.idEnfermera!) ?? []
    arr.push(v)
    visitasPorEnfermera.set(v.idEnfermera!, arr)
  }

  return nursesData.map((nurse) => ({
    id: nurse.id,
    nombres: nurse.nombres,
    apellidoPaterno: nurse.apellidoPaterno,
    correo: nurse.correo,
    visitas: visitasPorEnfermera.get(nurse.id) ?? [],
  }))
}

// Obtener visitas con todos los detalles para una fecha
async function getVisitasConDetalles(
  fecha: string,
  nurseIds: number[],
): Promise<VisitaConDetalles[]> {
  const rawVisitas = await db
    .select({
      visitaId: visits.id,
      fecha: visits.fecha,
      hora: visits.hora,
      costo: visits.costo,
      costoTraslado: visits.costoTraslado,
      montoRecargo: visits.montoRecargo,
      informacionAdicional: visits.informacionAdicional,
      idEnfermera: visits.idEnfermera,
      keyOrdenMedica: visits.keyOrdenMedica,
      pacienteNombres: patients.nombres,
      pacienteApellidos: patients.apellidoPaterno,
      pacienteApellidoM: patients.apellidoMaterno,
      tipoIdentificador: patients.tipoIdentificador,
      identificador: patients.identificador,
      fechaNacimiento: patients.fechaNacimiento,
      correoPaciente: patients.correo,
      infoAdicionalPaciente: patients.informacionAdicional,
      idCompaniaSeguro: patients.idCompaniaSeguro,
      idResidenciaAdulto: patients.idResidenciaAdulto,
      direccion: addresses.direccionFormateada,
      comuna: addresses.areaAdministrativa3,
      areaAdministrativa1: addresses.areaAdministrativa1,
      areaAdministrativa2: addresses.areaAdministrativa2,
      laboratorio: laboratories.nombre,
      previsión: healthInsurances.nombre,
      tipoRecargo: surchargeTypes.nombre,
      residenciaAdultoMayor: elderlyResidences.nombre,
      idPaciente: patients.id,
    })
    .from(visits)
    .leftJoin(patients, eq(visits.idPaciente, patients.id))
    .leftJoin(addresses, eq(patients.idDireccion, addresses.id))
    .leftJoin(laboratories, eq(visits.idLaboratorio, laboratories.id))
    .leftJoin(healthInsurances, eq(patients.idCompaniaSeguro, healthInsurances.id))
    .leftJoin(surchargeTypes, eq(visits.idTipoRecargo, surchargeTypes.id))
    .leftJoin(elderlyResidences, eq(patients.idResidenciaAdulto, elderlyResidences.id))
    .where(and(eq(visits.fecha, fecha), inArray(visits.idEnfermera, nurseIds)))

  if (!rawVisitas.length) return []

  const visitaIds = rawVisitas.map((v) => v.visitaId)
  const pacienteIds = rawVisitas.map((v) => v.idPaciente).filter((id): id is number => id !== null)

  // Obtener teléfonos de pacientes
  const phonesData = pacienteIds.length > 0
    ? await db
        .select({
          idPaciente: patientPhones.idPaciente,
          telefono: patientPhones.telefono,
        })
        .from(patientPhones)
        .where(inArray(patientPhones.idPaciente, pacienteIds))
    : []

  // Obtener procedimientos, exámenes y talleres
  const [procRows, examRows, workshopRows] = await Promise.all([
    db
      .select({ idVisita: visitProcedures.idVisita, nombre: procedures.nombre })
      .from(visitProcedures)
      .innerJoin(procedures, eq(visitProcedures.idProcedimiento, procedures.id))
      .where(inArray(visitProcedures.idVisita, visitaIds)),
    db
      .select({ idVisita: visitExams.idVisita, nombre: exams.nombre })
      .from(visitExams)
      .innerJoin(exams, eq(visitExams.idExamen, exams.id))
      .where(inArray(visitExams.idVisita, visitaIds)),
    db
      .select({ idVisita: visitWorkshops.idVisita, nombre: workshops.nombre })
      .from(visitWorkshops)
      .innerJoin(workshops, eq(visitWorkshops.idTaller, workshops.id))
      .where(inArray(visitWorkshops.idVisita, visitaIds)),
  ])

  const procsByVisita = new Map<number, string[]>()
  const examsByVisita = new Map<number, string[]>()
  const workshopsByVisita = new Map<number, string[]>()
  const phonesByPaciente = new Map<number, string[]>()

  for (const p of procRows) {
    const arr = procsByVisita.get(p.idVisita) ?? []
    arr.push(p.nombre)
    procsByVisita.set(p.idVisita, arr)
  }

  for (const e of examRows) {
    const arr = examsByVisita.get(e.idVisita) ?? []
    arr.push(e.nombre)
    examsByVisita.set(e.idVisita, arr)
  }

  for (const w of workshopRows) {
    const arr = workshopsByVisita.get(w.idVisita) ?? []
    arr.push(w.nombre)
    workshopsByVisita.set(w.idVisita, arr)
  }

  for (const phone of phonesData) {
    const arr = phonesByPaciente.get(phone.idPaciente) ?? []
    arr.push(phone.telefono)
    phonesByPaciente.set(phone.idPaciente, arr)
  }

  // Mapear datos a tipos de respuesta
  return rawVisitas.map((v) => ({
    id: v.visitaId,
    idEnfermera: v.idEnfermera ?? null,
    keyOrdenMedica: v.keyOrdenMedica ?? null,
    fecha: v.fecha || '',
    hora: v.hora,
    paciente: {
      nombres: v.pacienteNombres || '',
      apellidoPaterno: v.pacienteApellidos || '',
      apellidoMaterno: v.pacienteApellidoM || null,
      tipoIdentificador: v.tipoIdentificador || null,
      identificador: v.identificador || null,
      fechaNacimiento: v.fechaNacimiento ?? null,
      correo: v.correoPaciente || null,
      informacionAdicional: v.infoAdicionalPaciente || null,
      previsión: v.previsión || null,
    },
    telefonos: v.idPaciente ? (phonesByPaciente.get(v.idPaciente) ?? []) : [],
    dirección: {
      dirección: v.direccion || '',
      comuna: v.comuna || null,
      areaAdministrativa1: v.areaAdministrativa1 || null,
      areaAdministrativa2: v.areaAdministrativa2 || null,
    },
    laboratorio: v.laboratorio || null,
    procedimientos: procsByVisita.get(v.visitaId) ?? [],
    exámenes: examsByVisita.get(v.visitaId) ?? [],
    talleres: workshopsByVisita.get(v.visitaId) ?? [],
    residenciaAdultoMayor: v.residenciaAdultoMayor || null,
    informacionAdicional: v.informacionAdicional || null,
    costo: v.costo,
    costoTraslado: v.costoTraslado ?? 0,
    montoRecargo: v.montoRecargo ?? 0,
    tipoRecargo: v.tipoRecargo || null,
  }))
}

// ─── sendScheduledVisitsEmail ─────────────────────────────────────────────────

export async function sendScheduledVisitsEmail(
  enfermera: EnfermeraConVisitas,
): Promise<Result> {
  await requireSession()

  if (!enfermera.correo) {
    return { success: false, error: 'La enfermera no tiene correo registrado' }
  }

  if (!enfermera.visitas.length) {
    return { success: false, error: 'Sin visitas asignadas para esta fecha' }
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)

    const htmlContent = generateScheduledVisitsHTML(enfermera.visitas)
    const firstFecha = enfermera.visitas[0]?.fecha ?? ''
    const nombreEnfermera = formatNombre(enfermera)
    const subject = `Programación del ${formatDate(firstFecha)} para ${nombreEnfermera}`

    // Adjuntar órdenes médicas si existen
    const attachments: { filename: string; content: Buffer }[] = []
    for (const visita of enfermera.visitas) {
      if (visita.keyOrdenMedica) {
        try {
          const { buffer, contentType } = await getR2Object(visita.keyOrdenMedica)
          const ext = visita.keyOrdenMedica.split('.').pop() ?? contentType.split('/')[1] ?? 'jpg'
          attachments.push({ filename: `visita-${visita.id}.${ext}`, content: buffer })
        } catch (err) {
          console.error(`Error descargando orden médica para visita ${visita.id}:`, err)
        }
      }
    }

    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
      to: enfermera.correo,
      subject,
      html: htmlContent,
      ...(attachments.length > 0 && { attachments }),
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error: `Resend: ${error.message}` }
    }

    return { success: true }
  } catch (error) {
    console.error('Error sending email:', error)
    return { success: false, error: 'Error al enviar correo' }
  }
}

// ─── sendAllScheduledVisitsEmails ────────────────────────────────────────────

export async function sendAllScheduledVisitsEmails(
  enfermeras: EnfermeraConVisitas[],
): Promise<Result> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  let successCount = 0
  const errors: string[] = []

  for (const enfermera of enfermeras) {
    const nombreEnfermera = formatNombre(enfermera)
    if (!enfermera.correo) {
      errors.push(`${nombreEnfermera}: sin correo registrado`)
      continue
    }

    if (!enfermera.visitas.length) {
      errors.push(`${nombreEnfermera}: sin visitas asignadas`)
      continue
    }

    try {
      const htmlContent = generateScheduledVisitsHTML(enfermera.visitas)
      const firstFecha = enfermera.visitas[0]?.fecha ?? ''
      const subject = `Programación del ${formatDate(firstFecha)} para ${nombreEnfermera}`

      const attachments: { filename: string; content: Buffer }[] = []
      for (const visita of enfermera.visitas) {
        if (visita.keyOrdenMedica) {
          try {
            const { buffer, contentType } = await getR2Object(visita.keyOrdenMedica)
            const ext = visita.keyOrdenMedica.split('.').pop() ?? contentType.split('/')[1] ?? 'jpg'
            attachments.push({ filename: `visita-${visita.id}.${ext}`, content: buffer })
          } catch (err) {
            console.error(`Error descargando orden médica para visita ${visita.id}:`, err)
          }
        }
      }

      const { error: sendError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
        to: enfermera.correo,
        subject,
        html: htmlContent,
        ...(attachments.length > 0 && { attachments }),
      })

      if (sendError) {
        console.error(`Resend error for ${enfermera.correo}:`, sendError)
        errors.push(`${nombreEnfermera}: ${sendError.message}`)
        continue
      }

      successCount++
    } catch (error) {
      console.error(`Error sending email to ${enfermera.correo}:`, error)
      errors.push(`${nombreEnfermera}: error al enviar`)
    }
  }

  if (successCount === 0) {
    return {
      success: false,
      error: `No se pudo enviar ningún correo. Errores: ${errors.join(', ')}`,
    }
  }

  return {
    success: true,
    error:
      errors.length > 0
        ? `Se enviaron ${successCount} correos. Errores: ${errors.join(', ')}`
        : undefined,
  }
}

// ─── generateScheduledVisitsHTML ──────────────────────────────────────────────

function generateScheduledVisitsHTML(visitas: VisitaConDetalles[]): string {
  if (!visitas.length) {
    return '<p>Sin visitas asignadas.</p>'
  }

  const font = '-apple-system,BlinkMacSystemFont,Arial,sans-serif'
  const labelColStyle = `width:150px;min-width:150px;padding:8px 12px;background:#f1f5f9;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;vertical-align:middle;border:1px solid #e8ecf0;font-family:${font};`
  const dataColStyle = `min-width:180px;padding:8px 12px;font-size:13px;color:#1e2835;vertical-align:middle;border:1px solid #e8ecf0;font-family:${font};`
  const headerColStyle = `min-width:180px;padding:10px 12px;background:#1e2835;font-size:12px;font-weight:700;color:#ffffff;text-align:center;border:1px solid #1e2835;font-family:${font};`
  const costoLabelStyle = `width:150px;min-width:150px;padding:8px 12px;background:#f1f5f9;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;vertical-align:middle;border:1px solid #e8ecf0;font-weight:700;font-family:${font};`
  const costoDataStyle = `min-width:180px;padding:8px 12px;font-size:13px;color:#1e2835;font-weight:700;vertical-align:middle;border:1px solid #e8ecf0;font-family:${font};`

  // Helper to get cell value for each row
  const getValue = (v: VisitaConDetalles, rowIndex: number): string => {
    switch (rowIndex) {
      case 0: return v.hora ?? '—'
      case 1: return formatNombre(v.paciente)
      case 2: return v.paciente.identificador ?? '—'
      case 3: return v.paciente.fechaNacimiento ? formatDate(v.paciente.fechaNacimiento) : '—'
      case 4: return v.telefonos.join(' / ') || '—'
      case 5: return v.paciente.correo
          ? `<a href="mailto:${v.paciente.correo}" style="color:#2a5fad;text-decoration:none;">${v.paciente.correo}</a>`
          : '—'
      case 6: {
          const query = encodeURIComponent(
            [v.dirección.dirección, v.dirección.comuna].filter(Boolean).join(', '),
          )
          const mapsUrl = `https://maps.google.com/?q=${query}`
          return `${v.dirección.dirección} <a href="${mapsUrl}" style="color:#2a5fad;text-decoration:none;font-size:14px;" title="Abrir en Maps">📍</a>`
        }
      case 7: return v.dirección.comuna ?? '—'
      case 8: return v.paciente.previsión ?? '—'
      case 9: return v.residenciaAdultoMayor ?? '—'
      case 10: return v.procedimientos.join(', ') || '—'
      case 11: return v.exámenes.join(', ') || '—'
      case 12: return v.talleres.join(', ') || '—'
      case 13: return v.laboratorio ?? '—'
      case 14: return v.paciente.informacionAdicional || '—'
      case 15: return v.informacionAdicional || '—'
      default: return '—'
    }
  }

  const rowLabels = [
    'Hora de atencion',
    'Nombre Completo',
    'RUT / Identificador',
    'Fecha de Nacimiento',
    'Telefono(s)',
    'Correo electronico',
    'Direccion',
    'Comuna',
    'Prevision de Salud',
    'Residencia',
    'Procedimiento(s)',
    'Examen(es)',
    'Taller(es)',
    'Laboratorio',
    'Notas paciente',
    'Informacion adicional',
  ]

  // Header row: "Visita #ID", one per visit
  const headerCells = visitas
    .map((v) => `<td style="${headerColStyle}">Visita #${v.id}</td>`)
    .join('')

  // Data rows
  const dataRows = rowLabels
    .map((label, rowIndex) => {
      const dataCells = visitas
        .map((v) => `<td style="${dataColStyle}">${getValue(v, rowIndex)}</td>`)
        .join('')
      return `<tr><td style="${labelColStyle}">${label}</td>${dataCells}</tr>`
    })
    .join('')

  // Filas de costos (bold, distinct style)
  const costoCells = visitas
    .map((v) => `<td style="${costoDataStyle}">$${v.costo.toLocaleString('es-CL')}</td>`)
    .join('')
  const costoRow = `<tr><td style="${costoLabelStyle}">Costo</td>${costoCells}</tr>`

  const trasladoCells = visitas
    .map((v) => `<td style="${costoDataStyle}">${v.costoTraslado > 0 ? `$${v.costoTraslado.toLocaleString('es-CL')}` : '—'}</td>`)
    .join('')
  const trasladoRow = `<tr><td style="${costoLabelStyle}">Traslado</td>${trasladoCells}</tr>`

  const recargoCells = visitas
    .map((v) => {
      if (!v.montoRecargo) return `<td style="${costoDataStyle}">—</td>`
      const label = v.tipoRecargo ? ` (${v.tipoRecargo})` : ''
      return `<td style="${costoDataStyle}">$${v.montoRecargo.toLocaleString('es-CL')}${label}</td>`
    })
    .join('')
  const recargoRow = `<tr><td style="${costoLabelStyle}">Recargo</td>${recargoCells}</tr>`

  const table = `
    <div style="overflow-x:auto;">
      <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:${font};">
        <tr>
          <td style="width:150px;min-width:150px;padding:10px 12px;background:#1e2835;border:1px solid #1e2835;"></td>
          ${headerCells}
        </tr>
        ${dataRows}
        ${costoRow}
        ${trasladoRow}
        ${recargoRow}
      </table>
    </div>
  `

  return `
    <div style="max-width:100%;margin:0 auto;background:#ffffff;font-family:${font};">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1e2835;margin-bottom:16px;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 4px 0;font-size:18px;font-weight:700;color:#ffffff;font-family:Georgia,serif;">Programacion de Visitas</p>
            <p style="margin:0;font-size:12px;color:#94a3b8;letter-spacing:0.5px;">${formatDateFull(visitas[0]?.fecha ?? '')}</p>
          </td>
        </tr>
      </table>

      ${table}

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e8ecf0;margin-top:16px;">
        <tr>
          <td style="padding:16px;font-size:11px;color:#94a3b8;text-align:center;">
            <p style="margin:0 0 4px 0;">Este es un correo automatico de programacion de visitas.</p>
            <p style="margin:0;">Por favor, no responda a este correo.</p>
          </td>
        </tr>
      </table>
    </div>
  `
}
