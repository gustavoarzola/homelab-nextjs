'use server'

import { db } from '@/db'
import {
  visits, patients, addresses, branches, nurses,
  visitProcedures, visitExams, procedures, exams,
  healthInsurances, patientPhones,
} from '@/db/schema'
import { eq, and, inArray, asc } from 'drizzle-orm'
import { Resend } from 'resend'
import { formatDateFull, formatDateLong, formatDate, parseDateLocal } from '@/lib/format'
import { requireSession } from '@/lib/auth-guard'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VisitaConDetalles = {
  id: number
  idEnfermera: number | null
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
  sucursal: string | null
  procedimientos: string[]
  exámenes: string[]
  informacionAdicional: string | null
  costo: number
}

export type EnfermeraConVisitas = {
  id: number
  nombre: string
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
    nombre: nurse.nombres,
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
      informacionAdicional: visits.informacionAdicional,
      idEnfermera: visits.idEnfermera,
      pacienteNombres: patients.nombres,
      pacienteApellidos: patients.apellidoPaterno,
      pacienteApellidoM: patients.apellidoMaterno,
      tipoIdentificador: patients.tipoIdentificador,
      identificador: patients.identificador,
      fechaNacimiento: patients.fechaNacimiento,
      correoPaciente: patients.correo,
      infoAdicionalPaciente: patients.informacionAdicional,
      idCompaniaSeguro: patients.idCompaniaSeguro,
      direccion: addresses.direccionFormateada,
      comuna: addresses.areaAdministrativa3,
      areaAdministrativa1: addresses.areaAdministrativa1,
      areaAdministrativa2: addresses.areaAdministrativa2,
      sucursal: branches.nombre,
      previsión: healthInsurances.nombre,
      idPaciente: patients.id,
    })
    .from(visits)
    .leftJoin(patients, eq(visits.idPaciente, patients.id))
    .leftJoin(addresses, eq(patients.idDireccion, addresses.id))
    .leftJoin(branches, eq(visits.idSucursal, branches.id))
    .leftJoin(healthInsurances, eq(patients.idCompaniaSeguro, healthInsurances.id))
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

  // Obtener procedimientos y exámenes
  const [procRows, examRows] = await Promise.all([
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
  ])

  const procsByVisita = new Map<number, string[]>()
  const examsByVisita = new Map<number, string[]>()
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

  for (const phone of phonesData) {
    const arr = phonesByPaciente.get(phone.idPaciente) ?? []
    arr.push(phone.telefono)
    phonesByPaciente.set(phone.idPaciente, arr)
  }

  // Mapear datos a tipos de respuesta
  return rawVisitas.map((v) => ({
    id: v.visitaId,
    idEnfermera: v.idEnfermera ?? null,
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
    sucursal: v.sucursal || null,
    procedimientos: procsByVisita.get(v.visitaId) ?? [],
    exámenes: examsByVisita.get(v.visitaId) ?? [],
    informacionAdicional: v.informacionAdicional || null,
    costo: v.costo,
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
    const subject = `Programación del ${formatDate(firstFecha)} para ${enfermera.apellidoPaterno}, ${enfermera.nombre}`

    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
      to: enfermera.correo,
      subject,
      html: htmlContent,
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
    if (!enfermera.correo) {
      errors.push(`${enfermera.apellidoPaterno}, ${enfermera.nombre}: sin correo registrado`)
      continue
    }

    if (!enfermera.visitas.length) {
      errors.push(`${enfermera.apellidoPaterno}, ${enfermera.nombre}: sin visitas asignadas`)
      continue
    }

    try {
      const htmlContent = generateScheduledVisitsHTML(enfermera.visitas)
      const firstFecha = enfermera.visitas[0]?.fecha ?? ''
      const subject = `Programación del ${formatDate(firstFecha)} para ${enfermera.apellidoPaterno}, ${enfermera.nombre}`

      const { error: sendError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
        to: enfermera.correo,
        subject,
        html: htmlContent,
      })

      if (sendError) {
        console.error(`Resend error for ${enfermera.correo}:`, sendError)
        errors.push(`${enfermera.apellidoPaterno}, ${enfermera.nombre}: ${sendError.message}`)
        continue
      }

      successCount++
    } catch (error) {
      console.error(`Error sending email to ${enfermera.correo}:`, error)
      errors.push(`${enfermera.apellidoPaterno}, ${enfermera.nombre}: error al enviar`)
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

  const labelStyle =
    'font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;display:block;margin-bottom:3px;font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;'
  const valueStyle =
    'font-size:13px;color:#1e2835;margin:0;font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;'
  const cellStyle = 'padding:10px 16px;vertical-align:top;'
  const sectionLabelStyle =
    'font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e8ecf0;padding:10px 16px 6px;font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;'

  let visitCards = ''

  for (let i = 0; i < visitas.length; i++) {
    const visita = visitas[i]!
    const fechaFormato = formatDate(visita.fecha)

    // Build 2-col rows for patient info
    const nombreCell = `<td width="50%" style="${cellStyle}"><span style="${labelStyle}">Nombre</span><p style="${valueStyle}">${visita.paciente.apellidoPaterno}${visita.paciente.apellidoMaterno ? ` ${visita.paciente.apellidoMaterno}` : ''}, ${visita.paciente.nombres}</p></td>`

    const identificadorCell = visita.paciente.identificador
      ? `<td width="50%" style="${cellStyle}"><span style="${labelStyle}">${visita.paciente.tipoIdentificador ? visita.paciente.tipoIdentificador.toUpperCase() : 'Identificador'}</span><p style="${valueStyle}">${visita.paciente.identificador}</p></td>`
      : `<td width="50%" style="${cellStyle}"></td>`

    const nacimientoCell = visita.paciente.fechaNacimiento
      ? `<td width="50%" style="${cellStyle}"><span style="${labelStyle}">Fecha de Nacimiento</span><p style="${valueStyle}">${formatDate(visita.paciente.fechaNacimiento)}</p></td>`
      : ''

    const previsionCell = visita.paciente.previsión
      ? `<td width="50%" style="${cellStyle}"><span style="${labelStyle}">Prevision</span><p style="${valueStyle}">${visita.paciente.previsión}</p></td>`
      : ''

    const nacimientoPrevisionRow =
      nacimientoCell || previsionCell
        ? `<tr>${nacimientoCell}${previsionCell}</tr>`
        : ''

    // Contacto rows
    const telefonosCell =
      visita.telefonos.length > 0
        ? `<td width="50%" style="${cellStyle}"><span style="${labelStyle}">Telefono(s)</span>${visita.telefonos.map((t) => `<p style="${valueStyle};margin-bottom:2px;">${t}</p>`).join('')}</td>`
        : ''

    const correoCell = visita.paciente.correo
      ? `<td width="50%" style="${cellStyle}"><span style="${labelStyle}">Correo</span><p style="${valueStyle}"><a href="mailto:${visita.paciente.correo}" style="color:#2a5fad;text-decoration:none;">${visita.paciente.correo}</a></p></td>`
      : ''

    const contactoSection =
      telefonosCell || correoCell
        ? `<tr><td colspan="2" style="${sectionLabelStyle}">Contacto</td></tr><tr>${telefonosCell}${correoCell}</tr>`
        : ''

    // Dirección
    const direccionLines = [
      visita.dirección.dirección,
      visita.dirección.comuna ? `Comuna: ${visita.dirección.comuna}` : null,
      visita.dirección.areaAdministrativa2
        ? `Provincia: ${visita.dirección.areaAdministrativa2}`
        : null,
    ]
      .filter(Boolean)
      .map((line) => `<p style="${valueStyle};margin-bottom:2px;">${line}</p>`)
      .join('')

    const sucursalRow = visita.sucursal
      ? `<tr><td colspan="2" style="${cellStyle}"><span style="${labelStyle}">Laboratorio / Sucursal</span><p style="${valueStyle}">${visita.sucursal}</p></td></tr>`
      : ''

    // Procedimientos y Exámenes
    const procsCell =
      visita.procedimientos.length > 0
        ? `<td width="50%" style="${cellStyle}"><span style="${labelStyle}">Procedimientos</span>${visita.procedimientos.map((p) => `<p style="${valueStyle};margin-bottom:2px;">${p}</p>`).join('')}</td>`
        : ''

    const examsCell =
      visita.exámenes.length > 0
        ? `<td width="50%" style="${cellStyle}"><span style="${labelStyle}">Examenes</span>${visita.exámenes.map((e) => `<p style="${valueStyle};margin-bottom:2px;">${e}</p>`).join('')}</td>`
        : ''

    const procsExamsSection =
      procsCell || examsCell
        ? `<tr><td colspan="2" style="${sectionLabelStyle}">Procedimientos y Examenes</td></tr><tr>${procsCell}${examsCell}</tr>`
        : ''

    // Info adicional
    const infoAdicionalSection = visita.informacionAdicional
      ? `<tr><td colspan="2" style="${sectionLabelStyle}">Informacion Adicional</td></tr><tr><td colspan="2" style="${cellStyle}"><p style="${valueStyle}">${visita.informacionAdicional}</p></td></tr>`
      : ''

    visitCards += `
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8ecf0;margin-bottom:16px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;">
        <tr style="background-color:#f1f5f9;">
          <td colspan="2" style="padding:10px 16px;font-weight:600;font-size:13px;color:#1e2835;border-bottom:1px solid #e8ecf0;">
            Visita ${i + 1} de ${visitas.length}&nbsp;&mdash;&nbsp;${fechaFormato}${visita.hora ? `, ${visita.hora}` : ''}
          </td>
        </tr>
        <tr><td colspan="2" style="${sectionLabelStyle}">Paciente</td></tr>
        <tr>${nombreCell}${identificadorCell}</tr>
        ${nacimientoPrevisionRow}
        ${contactoSection}
        <tr><td colspan="2" style="${sectionLabelStyle}">Direccion</td></tr>
        <tr><td colspan="2" style="${cellStyle}">${direccionLines}</td></tr>
        ${sucursalRow}
        ${procsExamsSection}
        ${infoAdicionalSection}
        <tr style="background-color:#f8fafc;border-top:1px solid #e8ecf0;">
          <td style="${cellStyle}font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;">Arancel</td>
          <td style="${cellStyle}text-align:right;font-weight:700;font-size:14px;color:#1e2835;">$${visita.costo.toLocaleString('es-CL')}</td>
        </tr>
      </table>
    `
  }

  return `
    <div style="max-width:600px;margin:0 auto;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#1e2835;margin-bottom:16px;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 4px 0;font-size:18px;font-weight:700;color:#ffffff;font-family:Georgia,serif;">Programacion de Visitas</p>
            <p style="margin:0;font-size:12px;color:#94a3b8;letter-spacing:0.5px;">${formatDateFull(visitas[0]?.fecha ?? '')}</p>
          </td>
        </tr>
      </table>

      ${visitCards}

      <table width="600" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e8ecf0;">
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
