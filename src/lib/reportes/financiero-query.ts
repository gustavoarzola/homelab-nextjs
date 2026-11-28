import { and, asc, eq, gte, inArray, lte, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import {
  addresses,
  contactOrigins,
  expenseCategories,
  expenseGroups,
  elderlyResidences,
  exams,
  healthInsurances,
  monthlyExpenses,
  nurses,
  patients,
  procedures,
  surchargeTypes,
  visitExams,
  visitIsapreExams,
  visitProcedures,
  visitSurcharges,
  visitWorkshops,
  visits,
  workshops,
} from '@/db/schema'
import type { SearchParams } from '@/components/data-table'
import { formatNombre } from '@/lib/paciente'
import { buildVisitasWhere } from '@/lib/visitas-where'
import {
  computeMontosFinancieros,
  type CategoriaResumen,
  type GastoMensualItem,
  type ReporteFinancieroRow,
} from './financiero'

// Lecturas del reporte financiero. No es un módulo 'use server': solo lo
// llama el route `/api/reportes/financiero/export`, que exige admin.

function groupBy<T>(rows: T[], key: (r: T) => number): Map<number, T[]> {
  const map = new Map<number, T[]>()
  for (const r of rows) {
    const k = key(r)
    const arr = map.get(k)
    if (arr) arr.push(r)
    else map.set(k, [r])
  }
  return map
}

const nombres = (rows: { nombre: string }[] | undefined) => (rows ?? []).map((r) => r.nombre).join('\n')

export async function listVisitasReporteFinanciero(
  filters: SearchParams['filters'],
): Promise<ReporteFinancieroRow[]> {
  const baseRows = await db
    .select({
      id: visits.id,
      fecha: visits.fecha,
      estado: visits.estado,
      costo: visits.costo,
      montoVisitaOriginal: visits.montoVisitaOriginal,
      montoDescuento: visits.montoDescuento,
      descuentoAfectaPagoEnfermera: visits.descuentoAfectaPagoEnfermera,
      descuentoProcedimientosAfectaPagoEnfermera: visits.descuentoProcedimientosAfectaPagoEnfermera,
      montoInsumos: visits.montoInsumos,
      costoTraslado: visits.costoTraslado,
      conceptoNoRealizada: visits.conceptoNoRealizada,
      tipoDocumento: visits.tipoDocumento,
      numeroBoleta: visits.numeroBoleta,
      pagado: visits.pagado,
      fechaPago: visits.fechaPago,
      metodoPago: visits.metodoPago,
      origenContacto: contactOrigins.nombre,
      pacienteNombres: patients.nombres,
      pacienteApellidoPaterno: patients.apellidoPaterno,
      pacienteApellidoMaterno: patients.apellidoMaterno,
      rut: patients.identificador,
      comuna: addresses.areaAdministrativa3,
      hogar: elderlyResidences.nombre,
      prevision: healthInsurances.nombre,
      idEnfermera: visits.idEnfermera,
      enfermeraNombres: nurses.nombres,
      enfermeraApellidoPaterno: nurses.apellidoPaterno,
      enfermeraApellidoMaterno: nurses.apellidoMaterno,
      porcentajePago: nurses.porcentajePago,
    })
    .from(visits)
    .leftJoin(patients, eq(visits.idPaciente, patients.id))
    .leftJoin(addresses, eq(patients.idDireccion, addresses.id))
    .leftJoin(elderlyResidences, eq(patients.idResidenciaAdulto, elderlyResidences.id))
    .leftJoin(healthInsurances, eq(patients.idCompaniaSeguro, healthInsurances.id))
    .leftJoin(nurses, eq(visits.idEnfermera, nurses.id))
    .leftJoin(contactOrigins, eq(visits.idOrigenContacto, contactOrigins.id))
    .where(buildVisitasWhere(filters))
    .orderBy(asc(visits.fecha), asc(visits.id))

  if (baseRows.length === 0) return []
  const ids = baseRows.map((r) => r.id)

  const [procRows, examRows, isapreRows, workshopRows, surchargeRows] = await Promise.all([
    db
      .select({
        idVisita: visitProcedures.idVisita,
        nombre: procedures.nombre,
        categoria: procedures.categoria,
        precio: visitProcedures.precio,
        descuento: visitProcedures.descuento,
      })
      .from(visitProcedures)
      .innerJoin(procedures, eq(visitProcedures.idProcedimiento, procedures.id))
      .where(inArray(visitProcedures.idVisita, ids))
      .orderBy(asc(visitProcedures.id)),
    db
      .select({ idVisita: visitExams.idVisita, nombre: exams.nombre, grupoExamen: exams.grupoExamen, precio: visitExams.precio })
      .from(visitExams)
      .innerJoin(exams, eq(visitExams.idExamen, exams.id))
      .where(inArray(visitExams.idVisita, ids))
      .orderBy(asc(visitExams.id)),
    db
      .select({
        idVisita: visitIsapreExams.idVisita,
        nombre: exams.nombre,
        valorPagar: visitIsapreExams.valorPagar,
        valorCompleto: visitIsapreExams.valorCompleto,
      })
      .from(visitIsapreExams)
      .innerJoin(exams, eq(visitIsapreExams.idExamen, exams.id))
      .where(inArray(visitIsapreExams.idVisita, ids))
      .orderBy(asc(visitIsapreExams.id)),
    db
      .select({ idVisita: visitWorkshops.idVisita, nombre: workshops.nombre, precio: visitWorkshops.precio })
      .from(visitWorkshops)
      .innerJoin(workshops, eq(visitWorkshops.idTaller, workshops.id))
      .where(inArray(visitWorkshops.idVisita, ids))
      .orderBy(asc(visitWorkshops.id)),
    db
      .select({ idVisita: visitSurcharges.idVisita, nombre: surchargeTypes.nombre, precio: visitSurcharges.precio })
      .from(visitSurcharges)
      .innerJoin(surchargeTypes, eq(visitSurcharges.idTipoRecargo, surchargeTypes.id))
      .where(inArray(visitSurcharges.idVisita, ids))
      .orderBy(asc(visitSurcharges.id)),
  ])

  const procs = groupBy(procRows, (r) => r.idVisita)
  const examsBy = groupBy(examRows, (r) => r.idVisita)
  const isapre = groupBy(isapreRows, (r) => r.idVisita)
  const talleres = groupBy(workshopRows, (r) => r.idVisita)
  const recargos = groupBy(surchargeRows, (r) => r.idVisita)

  return baseRows.map((r) => {
    const montos = computeMontosFinancieros({
      estado: r.estado,
      montoVisitaOriginal: r.montoVisitaOriginal,
      montoDescuento: r.montoDescuento,
      descuentoAfectaPagoEnfermera: r.descuentoAfectaPagoEnfermera,
      descuentoProcedimientosAfectaPagoEnfermera: r.descuentoProcedimientosAfectaPagoEnfermera,
      procedimientos: procs.get(r.id) ?? [],
      examenes: examsBy.get(r.id) ?? [],
      examenesIsapre: isapre.get(r.id) ?? [],
      talleres: (talleres.get(r.id) ?? []).map((t) => t.precio),
      recargos: (recargos.get(r.id) ?? []).map((s) => s.precio),
      montoInsumos: r.montoInsumos,
      costoTraslado: r.costoTraslado,
      costoRegistrado: r.costo,
      tieneEnfermera: r.idEnfermera !== null,
      porcentajePago: r.porcentajePago !== null ? Number(r.porcentajePago) : null,
    })

    // En no realizadas/canceladas los ítems no se hicieron: no se listan.
    const conItems = r.estado !== 'no_realizada' && r.estado !== 'cancelada'

    return {
      id: r.id,
      fecha: r.fecha,
      estado: r.estado,
      paciente: formatNombre({
        nombres: r.pacienteNombres,
        apellidoPaterno: r.pacienteApellidoPaterno,
        apellidoMaterno: r.pacienteApellidoMaterno,
      }) || null,
      rut: r.rut,
      comuna: r.comuna,
      idEnfermera: r.idEnfermera,
      enfermera: r.enfermeraNombres
        ? formatNombre({
            nombres: r.enfermeraNombres,
            apellidoPaterno: r.enfermeraApellidoPaterno,
            apellidoMaterno: r.enfermeraApellidoMaterno,
          }) || null
        : null,
      origenContacto: r.origenContacto,
      prevision: r.prevision,
      hogar: r.hogar,
      procedimientos: conItems ? nombres(procs.get(r.id)) : '',
      examenes: conItems ? [nombres(examsBy.get(r.id)), nombres(isapre.get(r.id))].filter(Boolean).join('\n') : '',
      talleres: conItems ? nombres(talleres.get(r.id)) : '',
      recargos: conItems ? nombres(recargos.get(r.id)) : '',
      conceptoNoRealizada: r.estado === 'no_realizada' ? r.conceptoNoRealizada : null,
      tipoDocumento: r.numeroBoleta ? (r.tipoDocumento || null) : null,
      numeroDocumento: r.numeroBoleta || null,
      pagado: r.pagado,
      fechaPago: r.fechaPago,
      metodoPago: r.metodoPago,
      montos,
    }
  })
}

/**
 * Gastos mensuales que caen en el período del reporte (por mes, no por fecha:
 * un período que empieza a mitad de mes incluye el gasto completo de ese mes).
 * Sin fechas → todos los registrados.
 */
export async function listGastosMensualesPeriodo(
  fechaInicio: string | undefined,
  fechaFin: string | undefined,
): Promise<(GastoMensualItem & { grupo: string; notas: string | null })[]> {
  const periodo = sql`(${monthlyExpenses.anio} * 100 + ${monthlyExpenses.mes})`
  const conditions: SQL[] = []
  if (fechaInicio) conditions.push(gte(periodo, Number(fechaInicio.slice(0, 4)) * 100 + Number(fechaInicio.slice(5, 7))))
  if (fechaFin) conditions.push(lte(periodo, Number(fechaFin.slice(0, 4)) * 100 + Number(fechaFin.slice(5, 7))))

  return db
    .select({
      anio: monthlyExpenses.anio,
      mes: monthlyExpenses.mes,
      categoria: expenseCategories.nombre,
      grupo: expenseGroups.nombre,
      monto: monthlyExpenses.monto,
      notas: monthlyExpenses.notas,
    })
    .from(monthlyExpenses)
    .innerJoin(expenseCategories, eq(monthlyExpenses.idCategoria, expenseCategories.id))
    .innerJoin(expenseGroups, eq(expenseCategories.idGrupo, expenseGroups.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      asc(monthlyExpenses.anio), asc(monthlyExpenses.mes),
      asc(expenseGroups.orden), asc(expenseGroups.nombre), asc(expenseCategories.orden), asc(expenseCategories.nombre),
    )
}

/**
 * Categorías activas (de grupos activos) + las que igual tienen monto en el período,
 * en el orden del Resumen: grupo.orden → categoría.orden → nombre.
 */
export async function listCategoriasGastoParaResumen(nombresConMonto: string[]): Promise<CategoriaResumen[]> {
  const activa = and(eq(expenseCategories.activo, true), eq(expenseGroups.activo, true))!
  return db
    .select({ categoria: expenseCategories.nombre, grupo: expenseGroups.nombre })
    .from(expenseCategories)
    .innerJoin(expenseGroups, eq(expenseCategories.idGrupo, expenseGroups.id))
    .where(nombresConMonto.length ? or(activa, inArray(expenseCategories.nombre, nombresConMonto)) : activa)
    .orderBy(asc(expenseGroups.orden), asc(expenseGroups.nombre), asc(expenseCategories.orden), asc(expenseCategories.nombre))
}
