'use server'

import { and, count, countDistinct, eq, gte, isNotNull, lte, sql, sum } from 'drizzle-orm'
import { union } from 'drizzle-orm/pg-core'

import { db } from '@/db'
import {
  contactOrigins,
  exams,
  feeRetentionRates,
  monthlyExpenses,
  procedures,
  visitExams,
  visitIsapreExams,
  visitProcedures,
  visits,
  visitSurcharges,
  visitWorkshops,
} from '@/db/schema'
import { requireSession } from '@/lib/auth-guard'
import {
  buildEstadoResultados,
  buildIndicadores,
  type EerrRow,
  type EerrTotales,
  type Indicador,
} from '@/lib/finanzas/estado-resultados'
import { monthRange } from '@/lib/finanzas/periodo'

import { searchPagosEnfermerasMensual } from './pagos-enfermeras'

// Mismo universo que `/pagos-enfermeras`: solo visitas completadas (cobradas y cerradas).
const ESTADO_VISITA_EERR = 'completada'
const ORIGEN_SITIO_WEB = 'Sitio Web'

export type EstadoResultadosData = {
  month: number
  year: number
  rows: EerrRow[]
  totales: EerrTotales
  indicadores: Indicador[]
  /** Pago bruto por enfermera (mismo cálculo que `/pagos-enfermeras`), ordenado por nombre. */
  honorariosPorEnfermera: { enfermera: string; visitas: number; pago: number }[]
  tasaRetencion: number
  avisos: {
    /** Visitas `realizada` del mes que aún no se completan: no están en el EERR. */
    realizadasPendientes: { cantidad: number; monto: number }
    /** Visitas completadas sin enfermera: tienen ingreso pero ningún honorario asociado. */
    completadasSinEnfermera: number
    sinTasaRetencion: boolean
  }
}

const num = (v: unknown) => Number(v ?? 0)

export async function getEstadoResultados(month: number, year: number): Promise<EstadoResultadosData> {
  await requireSession()

  const { start, end } = monthRange(year, month)
  const enMes = and(gte(visits.fecha, start), lte(visits.fecha, end))
  const completadas = and(eq(visits.estado, ESTADO_VISITA_EERR), enMes)

  // Exámenes de la visita: unión deduplicada (visita, examen) de regulares + isapre,
  // mismo criterio que el dashboard, para contar cada examen una sola vez.
  const examenesDeVisita = union(
    db.select({ idVisita: visitExams.idVisita, idExamen: visitExams.idExamen }).from(visitExams),
    db.select({ idVisita: visitIsapreExams.idVisita, idExamen: visitIsapreExams.idExamen }).from(visitIsapreExams),
  ).as('examenes_de_visita')

  // Primera visita completada de cada paciente → "paciente nuevo" si cae en el mes.
  const primerasVisitas = db
    .select({ idPaciente: visits.idPaciente, primera: sql<string>`min(${visits.fecha})`.as('primera') })
    .from(visits)
    .where(and(eq(visits.estado, ESTADO_VISITA_EERR), isNotNull(visits.idPaciente)))
    .groupBy(visits.idPaciente)
    .as('primeras_visitas')

  const [
    [totalesVisitas],
    procRows,
    examRows,
    isapreRows,
    [talleresRow],
    [recargosRow],
    [examenesRow],
    [nuevosRow],
    [webRow],
    [pendientesRow],
    [trasladosRow],
    gastos,
    [tasaRow],
    pagos,
  ] = await Promise.all([
    db
      .select({
        visitas: count(),
        totalCobrado: sum(visits.costo),
        fee: sum(visits.montoVisitaOriginal),
        descuentoVisita: sum(visits.montoDescuento),
        descuentoProcedimientos: sum(visits.montoDescuentoProcedimientos),
        insumos: sum(visits.montoInsumos),
        pacientes: countDistinct(visits.idPaciente),
        facturado: sql<string>`coalesce(sum(case when coalesce(${visits.numeroBoleta}, '') <> '' then ${visits.costo} else 0 end), 0)`,
        sinEnfermera: sql<string>`count(*) filter (where ${visits.idEnfermera} is null)`,
      })
      .from(visits)
      .where(completadas),

    db
      .select({ categoria: procedures.categoria, monto: sum(visitProcedures.precio), cantidad: count() })
      .from(visitProcedures)
      .innerJoin(visits, eq(visitProcedures.idVisita, visits.id))
      .innerJoin(procedures, eq(visitProcedures.idProcedimiento, procedures.id))
      .where(completadas)
      .groupBy(procedures.categoria),

    db
      .select({ grupo: exams.grupoExamen, monto: sum(visitExams.precio) })
      .from(visitExams)
      .innerJoin(visits, eq(visitExams.idVisita, visits.id))
      .innerJoin(exams, eq(visitExams.idExamen, exams.id))
      .where(completadas)
      .groupBy(exams.grupoExamen),

    // Isapre: HomeLab cobra `valor_pagar` (el copago); el resto del `valor_completo` no es ingreso suyo.
    db
      .select({ grupo: exams.grupoExamen, monto: sum(visitIsapreExams.valorPagar) })
      .from(visitIsapreExams)
      .innerJoin(visits, eq(visitIsapreExams.idVisita, visits.id))
      .innerJoin(exams, eq(visitIsapreExams.idExamen, exams.id))
      .where(completadas)
      .groupBy(exams.grupoExamen),

    db
      .select({ monto: sum(visitWorkshops.precio), cantidad: count() })
      .from(visitWorkshops)
      .innerJoin(visits, eq(visitWorkshops.idVisita, visits.id))
      .where(completadas),

    db
      .select({ monto: sum(visitSurcharges.precio) })
      .from(visitSurcharges)
      .innerJoin(visits, eq(visitSurcharges.idVisita, visits.id))
      .where(completadas),

    db
      .select({ examenes: count(), visitas: countDistinct(examenesDeVisita.idVisita) })
      .from(examenesDeVisita)
      .innerJoin(visits, eq(examenesDeVisita.idVisita, visits.id))
      .where(completadas),

    db
      .select({ total: count() })
      .from(primerasVisitas)
      .where(and(gte(primerasVisitas.primera, start), lte(primerasVisitas.primera, end))),

    db
      .select({ total: countDistinct(visits.idPaciente) })
      .from(visits)
      .innerJoin(contactOrigins, eq(visits.idOrigenContacto, contactOrigins.id))
      .where(and(completadas, eq(contactOrigins.nombre, ORIGEN_SITIO_WEB))),

    db
      .select({ cantidad: count(), monto: sum(visits.costo) })
      .from(visits)
      .where(and(eq(visits.estado, 'realizada'), enMes)),

    db
      .select({ monto: sum(visits.costoTraslado) })
      .from(visits)
      .where(and(eq(visits.estado, 'no_realizada'), enMes)),

    db
      .select()
      .from(monthlyExpenses)
      .where(and(eq(monthlyExpenses.anio, year), eq(monthlyExpenses.mes, month)))
      .orderBy(monthlyExpenses.categoria, monthlyExpenses.id),

    db
      .select({ porcentaje: feeRetentionRates.porcentaje })
      .from(feeRetentionRates)
      .where(lte(feeRetentionRates.vigenteDesde, end))
      .orderBy(sql`${feeRetentionRates.vigenteDesde} desc`)
      .limit(1),

    // Fuente única de los honorarios: es el mismo cálculo que muestra `/pagos-enfermeras`.
    searchPagosEnfermerasMensual({ month, year }),
  ])

  const procPorCategoria = procRows.map((r) => ({ categoria: r.categoria, monto: num(r.monto), cantidad: num(r.cantidad) }))
  const cantidadCategoria = (...cats: string[]) =>
    procPorCategoria.filter((p) => cats.includes(p.categoria)).reduce((a, p) => a + p.cantidad, 0)
  const cantidadProcedimientos = procPorCategoria.reduce((a, p) => a + p.cantidad, 0)

  // Regulares + isapre, sumados por laboratorio.
  const porLab = new Map<string, number>()
  for (const r of [...examRows, ...isapreRows]) {
    porLab.set(r.grupo, (porLab.get(r.grupo) ?? 0) + num(r.monto))
  }

  const tasaRetencion = tasaRow ? Number(tasaRow.porcentaje) : 0

  const { rows, totales } = buildEstadoResultados({
    ingresos: {
      feeVisita: num(totalesVisitas?.fee),
      procedimientos: procPorCategoria.map(({ categoria, monto }) => ({ categoria, monto })),
      recargos: num(recargosRow?.monto),
      examenesPorLab: [...porLab].map(([grupo, monto]) => ({ grupo, monto })),
      talleres: num(talleresRow?.monto),
      insumos: num(totalesVisitas?.insumos),
      descuentoVisita: num(totalesVisitas?.descuentoVisita),
      descuentoProcedimientos: num(totalesVisitas?.descuentoProcedimientos),
      totalCobrado: num(totalesVisitas?.totalCobrado),
    },
    honorarios: pagos.rows.map((p) => ({ enfermera: p.enfermera, pago: p.pagoEstimado })),
    tasaRetencion,
    gastos: gastos.map((g) => ({
      categoria: g.categoria,
      descripcion: g.descripcion,
      monto: g.monto,
      grupoExamen: g.grupoExamen,
    })),
  })

  const indicadores = buildIndicadores(
    {
      visitas: num(totalesVisitas?.visitas),
      pacientes: num(totalesVisitas?.pacientes),
      pacientesNuevos: num(nuevosRow?.total),
      pacientesWeb: num(webRow?.total),
      visitasConExamenes: num(examenesRow?.visitas),
      examenes: num(examenesRow?.examenes),
      vacunas: cantidadCategoria('vacunas'),
      curaciones: cantidadCategoria('curaciones'),
      ecg: cantidadCategoria('ecg'),
      otrosProcedimientos:
        cantidadProcedimientos - cantidadCategoria('vacunas') - cantidadCategoria('curaciones') - cantidadCategoria('ecg'),
      talleres: num(talleresRow?.cantidad),
      facturadoConBoleta: num(totalesVisitas?.facturado),
      traslados: num(trasladosRow?.monto),
    },
    totales,
  )

  return {
    month,
    year,
    rows,
    totales,
    indicadores,
    honorariosPorEnfermera: pagos.rows.map((p) => ({ enfermera: p.enfermera, visitas: p.cantidadVisitas, pago: p.pagoEstimado })),
    tasaRetencion,
    avisos: {
      realizadasPendientes: { cantidad: num(pendientesRow?.cantidad), monto: num(pendientesRow?.monto) },
      completadasSinEnfermera: num(totalesVisitas?.sinEnfermera),
      sinTasaRetencion: !tasaRow,
    },
  }
}
