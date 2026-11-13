'use server'

import { db } from '@/db'
import {
  visits, patients, addresses, nurses,
  visitProcedures, visitExams, visitIsapreExams, procedures, exams,
  healthInsurances, patientPhones,
  visitWorkshops, workshops, visitSurcharges, elderlyResidences, surchargeTypes,
  visitFiles,
} from '@/db/schema'
import { eq, and, inArray, asc, isNull } from 'drizzle-orm'
import { Resend } from 'resend'
import { formatDate } from '@/lib/format'
import { requireSession } from '@/lib/auth-guard'
import type { EstadoVisita } from '@/lib/estados'
import { formatNombre } from '@/lib/paciente'
import { calcNursePaymentConcepts, type NursePaymentConcepts } from '@/lib/pricing/nurse-payment'
import { generateScheduledVisitsHTML } from '@/lib/emails/scheduled-visits-email-html'
import { buildVisitAttachments, type ArchivoCorreo, type EmailAttachment } from '@/lib/emails/attachments'
import { emailLogoAttachment } from '@/lib/email-logo'
import { resolveEmailEnvelope } from '@/lib/emails/recipients'
import { direccionMapsUrl, direccionParaMostrar } from '@/lib/direccion'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExamenCorreo = {
  nombre: string
  codigo: string
  precio: number
  isapre: boolean
  /** `examenes.grupo_examen` — el "laboratorio" al que se envía la muestra. */
  grupoExamen: string
}

export type VisitaConDetalles = {
  id: number
  idEnfermera: number | null
  archivos: ArchivoCorreo[]
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
    /** Texto del operador (o de Google si no hay). */
    dirección: string
    /** Link a Google Maps (coordenadas si existen). */
    mapsUrl: string | null
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
  /** Fecha consultada (YYYY-MM-DD); necesaria cuando no hay visitas de donde sacarla. */
  fecha: string
  visitas: VisitaConDetalles[]
}

export type VisitaSinAsignar = {
  id: number
  hora: string | null
  pacienteNombre: string
}

export type Result = { success: boolean; error?: string }

const ESTADO_VISITA_ENVIO_CORREO: EstadoVisita = 'confirmada'

// CC en todos los correos de salida (registro interno)
const CC_CORREOS_SALIDA = process.env.RESEND_CC_EMAIL ?? 'contacto@homelab.cl'

// ─── getVisitasAsignadasPorEnfermera ──────────────────────────────────────────

export async function getVisitasAsignadasPorEnfermera(
  fecha: string,
): Promise<EnfermeraConVisitas[]> {
  await requireSession()

  // Todas las enfermeras activas: las que no tienen visitas también reciben correo
  const nursesData = await db
    .select({
      id: nurses.id,
      nombres: nurses.nombres,
      apellidoPaterno: nurses.apellidoPaterno,
      correo: nurses.correo,
    })
    .from(nurses)
    .where(eq(nurses.activo, true))
    .orderBy(asc(nurses.apellidoPaterno))

  if (!nursesData.length) return []

  const visitasDetalladas = await getVisitasConDetalles(fecha, nursesData.map((n) => n.id))

  // Agrupar visitas por idEnfermera directamente (sin query extra)
  const visitasPorEnfermera = new Map<number, VisitaConDetalles[]>()
  for (const v of visitasDetalladas) {
    const arr = visitasPorEnfermera.get(v.idEnfermera!) ?? []
    arr.push(v)
    visitasPorEnfermera.set(v.idEnfermera!, arr)
  }

  const result = nursesData.map((nurse) => ({
    id: nurse.id,
    nombres: nurse.nombres,
    apellidoPaterno: nurse.apellidoPaterno,
    correo: nurse.correo,
    fecha,
    visitas: visitasPorEnfermera.get(nurse.id) ?? [],
  }))

  // Primero las con visitas, luego las sin visitas (sort estable: conserva el orden por apellido)
  return result.sort((a, b) => Number(b.visitas.length > 0) - Number(a.visitas.length > 0))
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
      direccion: addresses.direccion,
      direccionFormateada: addresses.direccionFormateada,
      latitud: addresses.latitud,
      longitud: addresses.longitud,
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

  // Obtener procedimientos, exámenes, talleres, recargos y adjuntos
  const [procRows, examRows, isapreExamRows, workshopRows, surchargeRows, fileRows] = await Promise.all([
    db
      .select({ idVisita: visitProcedures.idVisita, nombre: procedures.nombre, precio: visitProcedures.precio })
      .from(visitProcedures)
      .innerJoin(procedures, eq(visitProcedures.idProcedimiento, procedures.id))
      .where(inArray(visitProcedures.idVisita, visitaIds)),
    db
      .select({ idVisita: visitExams.idVisita, nombre: exams.nombre, codigo: exams.codigo, precio: visitExams.precio, grupoExamen: exams.grupoExamen })
      .from(visitExams)
      .innerJoin(exams, eq(visitExams.idExamen, exams.id))
      .where(inArray(visitExams.idVisita, visitaIds))
      .orderBy(asc(exams.nombre)),
    db
      .select({ idVisita: visitIsapreExams.idVisita, nombre: exams.nombre, codigo: exams.codigo, precio: visitIsapreExams.valorPagar, grupoExamen: exams.grupoExamen })
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
    db
      .select({ idVisita: visitFiles.idVisita, key: visitFiles.key, contentType: visitFiles.contentType })
      .from(visitFiles)
      .where(inArray(visitFiles.idVisita, visitaIds))
      .orderBy(asc(visitFiles.orden), asc(visitFiles.id)),
  ])

  const procsByVisita = new Map<number, string[]>()
  const examsByVisita = new Map<number, ExamenCorreo[]>()
  const workshopsByVisita = new Map<number, string[]>()
  const surchargesByVisita = new Map<number, { nombre: string; precio: number }[]>()
  const phonesByPaciente = new Map<number, string[]>()
  const filesByVisita = new Map<number, ArchivoCorreo[]>()

  for (const f of fileRows) {
    const arr = filesByVisita.get(f.idVisita) ?? []
    arr.push({ key: f.key, contentType: f.contentType })
    filesByVisita.set(f.idVisita, arr)
  }

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
    arr.push({ nombre: e.nombre, codigo: e.codigo, precio: e.precio, isapre: false, grupoExamen: e.grupoExamen })
    examsByVisita.set(e.idVisita, arr)
  }

  // Los exámenes isapre van al final de la lista de cada visita
  for (const e of isapreExamRows) {
    const arr = examsByVisita.get(e.idVisita) ?? []
    arr.push({ nombre: e.nombre, codigo: e.codigo, precio: e.precio, isapre: true, grupoExamen: e.grupoExamen })
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
    archivos: filesByVisita.get(v.visitaId) ?? [],
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
      dirección: direccionParaMostrar(v),
      mapsUrl: direccionMapsUrl(v),
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

type ResendClient = InstanceType<typeof Resend>

/**
 * Envía el correo de programación; sin visitas, envía el correo "sin asignaciones".
 * Devuelve el mensaje de error (o `null` si se envió).
 */
async function sendProgramacionEmail(
  resend: ResendClient,
  enfermera: EnfermeraConVisitas & { correo: string },
): Promise<string | null> {
  const nombreEnfermera = formatNombre(enfermera)
  const fechaFmt = formatDate(enfermera.fecha)
  const sinVisitas = enfermera.visitas.length === 0
  const subject = sinVisitas
    ? `Programación del ${fechaFmt}: sin visitas asignadas para ${nombreEnfermera}`
    : `Programación del ${fechaFmt} para ${nombreEnfermera}`

  // Logo inline (CID) + adjuntos de cada visita (fotos de órdenes médicas)
  const attachments: EmailAttachment[] = [
    emailLogoAttachment(),
    ...(await buildVisitAttachments(enfermera.visitas)),
  ]

  const resolved = resolveEmailEnvelope({ to: enfermera.correo, cc: CC_CORREOS_SALIDA, subject })
  if (!resolved.ok) return resolved.error

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'contacto@homelab.cl',
    ...resolved.envelope,
    html: generateScheduledVisitsHTML(enfermera.visitas, enfermera.fecha),
    attachments,
  })
  if (error) {
    console.error(`Resend error for ${enfermera.correo}:`, error)
    return `Resend: ${error.message}`
  }
  return null
}

export async function sendScheduledVisitsEmail(
  enfermera: EnfermeraConVisitas,
): Promise<Result> {
  await requireSession()

  if (!enfermera.correo) {
    return { success: false, error: 'La enfermera no tiene correo registrado' }
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const error = await sendProgramacionEmail(resend, { ...enfermera, correo: enfermera.correo })
    if (error) return { success: false, error }
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

    try {
      const sendError = await sendProgramacionEmail(resend, { ...enfermera, correo: enfermera.correo })
      if (sendError) {
        errors.push(`${nombreEnfermera}: ${sendError}`)
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
