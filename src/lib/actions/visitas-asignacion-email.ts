'use server'

import { db } from '@/db'
import {
  visits, patients, addresses, nurses,
  visitProcedures, visitExams, visitIsapreExams, procedures, exams,
  healthInsurances, patientPhones,
  visitWorkshops, workshops, visitSurcharges, elderlyResidences, surchargeTypes,
} from '@/db/schema'
import { eq, and, inArray, asc, isNull } from 'drizzle-orm'
import { Resend } from 'resend'
import { formatDate } from '@/lib/format'
import { requireSession } from '@/lib/auth-guard'
import { formatNombre } from '@/lib/paciente'
import { calcNursePaymentConcepts, type NursePaymentConcepts } from '@/lib/pricing/nurse-payment'
import { generateScheduledVisitsHTML } from '@/lib/emails/scheduled-visits-email-html'
import { getR2Object } from '@/lib/r2'
import { emailLogoAttachment } from '@/lib/email-logo'

// ─── Types ────────────────────────────────────────────────────────────────────

type EmailAttachment = { filename: string; content: Buffer; contentId?: string }

export type ExamenCorreo = {
  nombre: string
  codigo: string
  precio: number
  isapre: boolean
}

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
  procedimientos: string[]
  exámenes: ExamenCorreo[]
  talleres: string[]
  residenciaAdultoMayor: string | null
  informacionAdicional: string | null
  costo: number
  recargos: { nombre: string; precio: number }[]
  /** Conceptos que componen el pago a la enfermera para esta visita (sin monto final). */
  pago: NursePaymentConcepts
}

export type EnfermeraConVisitas = {
  id: number
  nombres: string
  apellidoPaterno: string
  correo: string | null
  visitas: VisitaConDetalles[]
}

export type VisitaSinAsignar = {
  id: number
  hora: string | null
  pacienteNombre: string
}

export type Result = { success: boolean; error?: string }

const ESTADO_VISITA_ENVIO_CORREO = 'confirmada'

// CC en todos los correos de salida (registro interno)
const CC_CORREOS_SALIDA = process.env.RESEND_CC_EMAIL ?? 'contacto@homelab.cl'

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
    .where(and(eq(visits.fecha, fecha), eq(visits.estado, ESTADO_VISITA_ENVIO_CORREO)))

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

// ─── getVisitasSinAsignarPorFecha ─────────────────────────────────────────────

export async function getVisitasSinAsignarPorFecha(fecha: string): Promise<VisitaSinAsignar[]> {
  await requireSession()

  const rows = await db
    .select({
      id: visits.id,
      hora: visits.hora,
      pacienteNombres: patients.nombres,
      pacienteApellidoPaterno: patients.apellidoPaterno,
      pacienteApellidoMaterno: patients.apellidoMaterno,
    })
    .from(visits)
    .leftJoin(patients, eq(visits.idPaciente, patients.id))
    .where(and(
      eq(visits.fecha, fecha),
      eq(visits.estado, ESTADO_VISITA_ENVIO_CORREO),
      isNull(visits.idEnfermera),
    ))
    .orderBy(asc(visits.hora))

  return rows.map((v) => ({
    id: v.id,
    hora: v.hora,
    pacienteNombre: formatNombre({
      nombres: v.pacienteNombres,
      apellidoPaterno: v.pacienteApellidoPaterno,
      apellidoMaterno: v.pacienteApellidoMaterno,
    }),
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
      montoDescuento: visits.montoDescuento,
      montoVisitaOriginal: visits.montoVisitaOriginal,
      descuentoAfectaPagoEnfermera: visits.descuentoAfectaPagoEnfermera,
      montoDescuentoProcedimientos: visits.montoDescuentoProcedimientos,
      descuentoProcedimientosAfectaPagoEnfermera: visits.descuentoProcedimientosAfectaPagoEnfermera,
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
      previsión: healthInsurances.nombre,
      residenciaAdultoMayor: elderlyResidences.nombre,
      idPaciente: patients.id,
    })
    .from(visits)
    .leftJoin(patients, eq(visits.idPaciente, patients.id))
    .leftJoin(addresses, eq(patients.idDireccion, addresses.id))
    .leftJoin(healthInsurances, eq(patients.idCompaniaSeguro, healthInsurances.id))
    .leftJoin(elderlyResidences, eq(patients.idResidenciaAdulto, elderlyResidences.id))
    .where(and(
      eq(visits.fecha, fecha),
      eq(visits.estado, ESTADO_VISITA_ENVIO_CORREO),
      inArray(visits.idEnfermera, nurseIds),
    ))

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

  // Obtener procedimientos, exámenes, talleres y recargos
  const [procRows, examRows, isapreExamRows, workshopRows, surchargeRows] = await Promise.all([
    db
      .select({ idVisita: visitProcedures.idVisita, nombre: procedures.nombre, precio: visitProcedures.precio })
      .from(visitProcedures)
      .innerJoin(procedures, eq(visitProcedures.idProcedimiento, procedures.id))
      .where(inArray(visitProcedures.idVisita, visitaIds)),
    db
      .select({ idVisita: visitExams.idVisita, nombre: exams.nombre, codigo: exams.codigo, precio: visitExams.precio })
      .from(visitExams)
      .innerJoin(exams, eq(visitExams.idExamen, exams.id))
      .where(inArray(visitExams.idVisita, visitaIds))
      .orderBy(asc(exams.nombre)),
    db
      .select({ idVisita: visitIsapreExams.idVisita, nombre: exams.nombre, codigo: exams.codigo, precio: visitIsapreExams.valorPagar })
      .from(visitIsapreExams)
      .innerJoin(exams, eq(visitIsapreExams.idExamen, exams.id))
      .where(inArray(visitIsapreExams.idVisita, visitaIds))
      .orderBy(asc(exams.nombre)),
    db
      .select({ idVisita: visitWorkshops.idVisita, nombre: workshops.nombre })
      .from(visitWorkshops)
      .innerJoin(workshops, eq(visitWorkshops.idTaller, workshops.id))
      .where(inArray(visitWorkshops.idVisita, visitaIds)),
    db
      .select({ idVisita: visitSurcharges.idVisita, nombre: surchargeTypes.nombre, precio: visitSurcharges.precio })
      .from(visitSurcharges)
      .innerJoin(surchargeTypes, eq(visitSurcharges.idTipoRecargo, surchargeTypes.id))
      .where(inArray(visitSurcharges.idVisita, visitaIds)),
  ])

  const procsByVisita = new Map<number, string[]>()
  const examsByVisita = new Map<number, ExamenCorreo[]>()
  const workshopsByVisita = new Map<number, string[]>()
  const surchargesByVisita = new Map<number, { nombre: string; precio: number }[]>()
  const phonesByPaciente = new Map<number, string[]>()

  // Subtotales para el desglose del pago a la enfermera
  const procPrecioByVisita = new Map<number, number>()
  const surchargePrecioByVisita = new Map<number, number>()
  const add = (m: Map<number, number>, k: number, n: number) => m.set(k, (m.get(k) ?? 0) + n)

  for (const p of procRows) {
    const arr = procsByVisita.get(p.idVisita) ?? []
    arr.push(p.nombre)
    procsByVisita.set(p.idVisita, arr)
    add(procPrecioByVisita, p.idVisita, p.precio)
  }

  for (const e of examRows) {
    const arr = examsByVisita.get(e.idVisita) ?? []
    arr.push({ nombre: e.nombre, codigo: e.codigo, precio: e.precio, isapre: false })
    examsByVisita.set(e.idVisita, arr)
  }

  // Los exámenes isapre van al final de la lista de cada visita
  for (const e of isapreExamRows) {
    const arr = examsByVisita.get(e.idVisita) ?? []
    arr.push({ nombre: e.nombre, codigo: e.codigo, precio: e.precio, isapre: true })
    examsByVisita.set(e.idVisita, arr)
  }

  for (const w of workshopRows) {
    const arr = workshopsByVisita.get(w.idVisita) ?? []
    arr.push(w.nombre)
    workshopsByVisita.set(w.idVisita, arr)
  }

  for (const s of surchargeRows) {
    const arr = surchargesByVisita.get(s.idVisita) ?? []
    arr.push({ nombre: s.nombre, precio: s.precio })
    surchargesByVisita.set(s.idVisita, arr)
    add(surchargePrecioByVisita, s.idVisita, s.precio)
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
    procedimientos: procsByVisita.get(v.visitaId) ?? [],
    exámenes: examsByVisita.get(v.visitaId) ?? [],
    talleres: workshopsByVisita.get(v.visitaId) ?? [],
    residenciaAdultoMayor: v.residenciaAdultoMayor || null,
    informacionAdicional: v.informacionAdicional || null,
    costo: v.costo,
    recargos: surchargesByVisita.get(v.visitaId) ?? [],
    pago: calcNursePaymentConcepts({
      procSum: procPrecioByVisita.get(v.visitaId) ?? 0,
      surchargeSum: surchargePrecioByVisita.get(v.visitaId) ?? 0,
      montoVisitaOriginal: v.montoVisitaOriginal,
      montoDescuento: v.montoDescuento,
      descuentoAfectaPagoEnfermera: v.descuentoAfectaPagoEnfermera,
      montoDescuentoProcedimientos: v.montoDescuentoProcedimientos,
      descuentoProcedimientosAfectaPagoEnfermera: v.descuentoProcedimientosAfectaPagoEnfermera,
    }),
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

    // Logo inline (CID) + órdenes médicas si existen
    const attachments: EmailAttachment[] = [emailLogoAttachment()]
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
      from: process.env.RESEND_FROM_EMAIL ?? 'contacto@homelab.cl',
      to: enfermera.correo,
      cc: CC_CORREOS_SALIDA,
      subject,
      html: htmlContent,
      attachments,
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
  await requireSession()

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

      const attachments: EmailAttachment[] = [emailLogoAttachment()]
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
        from: process.env.RESEND_FROM_EMAIL ?? 'contacto@homelab.cl',
        to: enfermera.correo,
        cc: CC_CORREOS_SALIDA,
        subject,
        html: htmlContent,
        attachments,
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
