// @ts-nocheck
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db'
import {
  addresses,
  elderlyResidences,
  exams,
  healthInsurances,
  nurses,
  patients,
  procedures,
  surchargeTypes,
  visitIsapreExams,
  visitProcedures,
  visitSurcharges,
  visitWorkshops,
  visits,
  workshops,
} from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { P } from './helpers'

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({ user: { id: 'test-user' } })),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  unstable_cache: (fn: any) => fn,
}))

import { createVisita, listVisitasForReport } from '../visitas'

const created = {
  addresses: [] as number[],
  patients: [] as number[],
  healthInsurances: [] as number[],
  elderlyResidences: [] as number[],
  procedures: [] as number[],
  exams: [] as number[],
  nurses: [] as number[],
  workshops: [] as number[],
  surchargeTypes: [] as number[],
  visits: [] as number[],
}

afterEach(async () => {
  await Promise.all([
    created.visits.length ? db.delete(visits).where(inArray(visits.id, created.visits)) : null,
  ])
  await Promise.all([
    created.exams.length ? db.delete(exams).where(inArray(exams.id, created.exams)) : null,
    created.procedures.length ? db.delete(procedures).where(inArray(procedures.id, created.procedures)) : null,
    created.nurses.length ? db.delete(nurses).where(inArray(nurses.id, created.nurses)) : null,
    created.workshops.length ? db.delete(workshops).where(inArray(workshops.id, created.workshops)) : null,
    created.surchargeTypes.length
      ? db.delete(surchargeTypes).where(inArray(surchargeTypes.id, created.surchargeTypes))
      : null,
  ])
  await Promise.all([
    created.patients.length ? db.delete(patients).where(inArray(patients.id, created.patients)) : null,
  ])
  await Promise.all([
    created.addresses.length ? db.delete(addresses).where(inArray(addresses.id, created.addresses)) : null,
    created.healthInsurances.length
      ? db.delete(healthInsurances).where(inArray(healthInsurances.id, created.healthInsurances))
      : null,
    created.elderlyResidences.length
      ? db.delete(elderlyResidences).where(inArray(elderlyResidences.id, created.elderlyResidences))
      : null,
  ])

  created.addresses = []
  created.patients = []
  created.healthInsurances = []
  created.elderlyResidences = []
  created.procedures = []
  created.exams = []
  created.nurses = []
  created.workshops = []
  created.surchargeTypes = []
  created.visits = []
})

function unique(label: string) {
  return `${P}${label}_${Math.random().toString(36).slice(2, 8)}`
}

function visitaForm(data: Record<string, string | number>, procedureIds: number[] = [], examIds: number[] = []) {
  const form = new FormData()
  Object.entries(data).forEach(([key, value]) => form.append(key, String(value)))
  procedureIds.forEach((id) => form.append('procedure_ids', String(id)))
  examIds.forEach((id) => form.append('exam_ids', String(id)))
  return form
}

describe('listVisitasForReport', () => {
  it('agrega procedimientos y exámenes en una celda separados por salto de línea, y calcula subtotales/hogar/isapre', async () => {
    const comuna = unique('ComunaReporte')

    const [residencia] = await db
      .insert(elderlyResidences)
      .values({ nombre: unique('Hogar') })
      .returning()
    created.elderlyResidences.push(residencia!.id)

    const [prevision] = await db
      .insert(healthInsurances)
      .values({ nombre: unique('Isapre'), categoria: 'isapre' })
      .returning()
    created.healthInsurances.push(prevision!.id)

    const [address] = await db
      .insert(addresses)
      .values({ direccion: unique('direccion'), areaAdministrativa3: comuna })
      .returning()
    created.addresses.push(address!.id)

    const [patient] = await db
      .insert(patients)
      .values({
        nombres: unique('Paciente'),
        apellidoPaterno: 'Reporte',
        identificador: unique('RUT'),
        idDireccion: address!.id,
        idCompaniaSeguro: prevision!.id,
        idResidenciaAdulto: residencia!.id,
      })
      .returning()
    created.patients.push(patient!.id)

    const [procA] = await db.insert(procedures).values({ nombre: 'ZZZ Curación', codigo: unique('PROC'), precio: 5000 }).returning()
    const [procB] = await db.insert(procedures).values({ nombre: 'AAA Inyección', codigo: unique('PROC'), precio: 3000 }).returning()
    created.procedures.push(procA!.id, procB!.id)

    // grupoExamen por defecto ('imalab') → cuenta para IMED Fonasa
    const [exam] = await db.insert(exams).values({ nombre: 'Hemograma', codigo: unique('EX'), precio: 4400 }).returning()
    created.exams.push(exam!.id)

    // grupoExamen 'integramédica' → cuenta para el subtotal general pero NO para IMED Fonasa
    const [examIntegramedica] = await db
      .insert(exams)
      .values({ nombre: 'Perfil hepático', codigo: unique('EX'), precio: 2000, grupoExamen: 'integramédica' })
      .returning()
    created.exams.push(examIntegramedica!.id)

    const [isapreExam] = await db.insert(exams).values({ nombre: 'Perfil bioquímico', codigo: unique('EX'), precio: 8000 }).returning()
    created.exams.push(isapreExam!.id)

    const fecha = '2026-04-05'
    const result = await createVisita(
      visitaForm(
        {
          idPaciente: patient!.id,
          fecha,
          cobraVisita: 'false',
          montoInsumos: 1500,
        },
        [procA!.id, procB!.id],
        [exam!.id, examIntegramedica!.id],
      ),
    )
    expect(result.success).toBe(true)
    const id = (result as { success: true; data: { id: number } }).data.id
    created.visits.push(id)

    await db.insert(visitIsapreExams).values({
      idVisita: id,
      idExamen: isapreExam!.id,
      valorCompleto: 8000,
      valorPagar: 6000,
      idPrevision: prevision!.id,
    })

    // Estado/metodoPago/origen se setean vía acciones de ciclo de vida en producción;
    // para este test se actualizan directo, ya que solo se está verificando la query del reporte.
    await db
      .update(visits)
      .set({ estado: 'realizada', metodoPago: 'Efectivo', origenContacto: 'web' })
      .where(eq(visits.id, id))

    const [row] = await listVisitasForReport({
      fechaInicio: fecha,
      fechaFin: fecha,
      estado: 'realizada',
    })

    expect(row).toBeDefined()
    expect(row!.id).toBe(id)
    expect(row!.comuna).toBe(comuna)
    expect(row!.hogar).toBe(residencia!.nombre)
    expect(row!.isapre).toBe(prevision!.nombre)
    expect(row!.metodoPago).toBe('Efectivo')
    expect(row!.origenContacto).toBe('web')
    expect(row!.montoInsumos).toBe(1500)

    // Dos procedimientos, uno por línea (orden alfabético por nombre desde la query)
    expect(row!.procedimientos.split('\n').sort()).toEqual(['AAA Inyección', 'ZZZ Curación'])

    // Exámenes regulares + examen isapre, uno por línea
    expect(row!.examenes.split('\n').sort()).toEqual(['Hemograma', 'Perfil bioquímico', 'Perfil hepático'])

    // Subtotal exámenes = suma de exámenes regulares (todos los grupos), sin el bono isapre
    expect(row!.subtotalExamenes).toBe(4400 + 2000)

    // IMED Fonasa = solo exámenes regulares con grupoExamen 'imalab'/'imalab fonasa 3' (excluye integramédica)
    expect(row!.imedFonasa).toBe(4400)

    // IMED Isapre Total = valorCompleto (referencia); IMED isapre Bono a pagar = valorPagar (lo que se cobra)
    expect(row!.imedIsapreTotal).toBe(8000)
    expect(row!.imedIsapreBono).toBe(6000)

    // Total boleta = costo persistido de la visita (sin cobrar visita de enfermería)
    const [visitRow] = await db.select({ costo: visits.costo }).from(visits).where(eq(visits.id, id))
    expect(row!.totalBoleta).toBe(visitRow!.costo)
  })

  it('respeta el filtro de período — no incluye visitas fuera del rango', async () => {
    const comuna = unique('ComunaFueraRango')
    const [address] = await db
      .insert(addresses)
      .values({ direccion: unique('direccion'), areaAdministrativa3: comuna })
      .returning()
    created.addresses.push(address!.id)

    const [patient] = await db
      .insert(patients)
      .values({ nombres: unique('Paciente'), apellidoPaterno: 'FueraRango', idDireccion: address!.id })
      .returning()
    created.patients.push(patient!.id)

    const result = await createVisita(
      visitaForm({ idPaciente: patient!.id, fecha: '2020-01-01', cobraVisita: 'false' }),
    )
    expect(result.success).toBe(true)
    const id = (result as { success: true; data: { id: number } }).data.id
    created.visits.push(id)

    const rows = await listVisitasForReport({ fechaInicio: '2026-01-01', fechaFin: '2026-12-31' })
    expect(rows.find((r) => r.id === id)).toBeUndefined()
  })

  it('acepta múltiples estados separados por coma (selector multi-select)', async () => {
    const comuna = unique('ComunaMultiEstado')
    const [address] = await db
      .insert(addresses)
      .values({ direccion: unique('direccion'), areaAdministrativa3: comuna })
      .returning()
    created.addresses.push(address!.id)

    const [patient] = await db
      .insert(patients)
      .values({ nombres: unique('Paciente'), apellidoPaterno: 'MultiEstado', idDireccion: address!.id })
      .returning()
    created.patients.push(patient!.id)

    const fecha = '2026-05-05'
    const [realizada, completada, cancelada] = await Promise.all(
      ['realizada', 'completada', 'cancelada'].map(async (estado) => {
        const result = await createVisita(
          visitaForm({ idPaciente: patient!.id, fecha, cobraVisita: 'false' }),
        )
        expect(result.success).toBe(true)
        const id = (result as { success: true; data: { id: number } }).data.id
        created.visits.push(id)
        await db.update(visits).set({ estado }).where(eq(visits.id, id))
        return id
      }),
    )

    const rows = await listVisitasForReport({
      fechaInicio: fecha,
      fechaFin: fecha,
      estado: 'realizada,completada',
    })
    const ids = rows.map((r) => r.id)

    expect(ids).toContain(realizada)
    expect(ids).toContain(completada)
    expect(ids).not.toContain(cancelada)
  })

  it('acepta múltiples enfermeras separadas por coma (selector multi-select)', async () => {
    const comuna = unique('ComunaMultiEnfermera')
    const [address] = await db
      .insert(addresses)
      .values({ direccion: unique('direccion'), areaAdministrativa3: comuna })
      .returning()
    created.addresses.push(address!.id)

    const [patient] = await db
      .insert(patients)
      .values({ nombres: unique('Paciente'), apellidoPaterno: 'MultiEnfermera', idDireccion: address!.id })
      .returning()
    created.patients.push(patient!.id)

    const [nurseA, nurseB, nurseC] = await Promise.all(
      ['A', 'B', 'C'].map(async (label) => {
        const [row] = await db
          .insert(nurses)
          .values({ nombres: unique(`Enfermera${label}`), apellidoPaterno: 'Test' })
          .returning()
        created.nurses.push(row!.id)
        return row!
      }),
    )

    const fecha = '2026-06-06'
    const [visitaA, visitaB, visitaC] = await Promise.all(
      [nurseA, nurseB, nurseC].map(async (nurse) => {
        const result = await createVisita(
          visitaForm({ idPaciente: patient!.id, fecha, cobraVisita: 'false', idEnfermera: nurse.id }),
        )
        expect(result.success).toBe(true)
        const id = (result as { success: true; data: { id: number } }).data.id
        created.visits.push(id)
        return id
      }),
    )

    const rows = await listVisitasForReport({
      fechaInicio: fecha,
      fechaFin: fecha,
      estado: '',
      enfermera: `${nurseA!.id},${nurseB!.id}`,
    })
    const ids = rows.map((r) => r.id)

    expect(ids).toContain(visitaA)
    expect(ids).toContain(visitaB)
    expect(ids).not.toContain(visitaC)
  })

  it('agrega enfermera, estado, talleres, recargos, facturación y calcula el pago a enfermera', async () => {
    const comuna = unique('ComunaCompleta')

    const [address] = await db
      .insert(addresses)
      .values({ direccion: unique('direccion'), areaAdministrativa3: comuna })
      .returning()
    created.addresses.push(address!.id)

    const [patient] = await db
      .insert(patients)
      .values({ nombres: unique('Paciente'), apellidoPaterno: 'Completo', idDireccion: address!.id })
      .returning()
    created.patients.push(patient!.id)

    const [nurse] = await db
      .insert(nurses)
      .values({ nombres: unique('Enf'), apellidoPaterno: 'Reporte', porcentajePago: '70' })
      .returning()
    created.nurses.push(nurse!.id)

    const [proc] = await db.insert(procedures).values({ nombre: 'Curación', codigo: unique('PROC'), precio: 10000 }).returning()
    created.procedures.push(proc!.id)

    const [workshop] = await db.insert(workshops).values({ nombre: 'Taller Movilidad', codigo: unique('TALL') }).returning()
    created.workshops.push(workshop!.id)

    const [surchargeType] = await db
      .insert(surchargeTypes)
      .values({ nombre: unique('Nocturno'), precio: 1500 })
      .returning()
    created.surchargeTypes.push(surchargeType!.id)

    const fecha = '2026-07-07'
    // Costo persistido neto: (10000 procedimiento - 1000 descuento) + 2000 taller + 1500 recargo + 500 insumos = 13000
    const [visit] = await db
      .insert(visits)
      .values({
        fecha,
        idPaciente: patient!.id,
        idEnfermera: nurse!.id,
        estado: 'realizada',
        cobraVisita: false,
        montoInsumos: 500,
        costo: 13000,
        montoDescuentoProcedimientos: 1000,
        descuentoProcedimientosAfectaPagoEnfermera: false,
        pagado: true,
        fechaPago: '2026-07-10',
        metodoPago: 'Transferencia',
      })
      .returning()
    created.visits.push(visit!.id)

    await db.insert(visitProcedures).values({ idVisita: visit!.id, idProcedimiento: proc!.id, precio: 10000, descuento: 1000 })
    await db.insert(visitWorkshops).values({ idVisita: visit!.id, idTaller: workshop!.id, precio: 2000 })
    await db.insert(visitSurcharges).values({ idVisita: visit!.id, idTipoRecargo: surchargeType!.id, precio: 1500 })

    const [row] = await listVisitasForReport({ fechaInicio: fecha, fechaFin: fecha, estado: 'realizada' })

    expect(row).toBeDefined()
    expect(row!.estado).toBe('realizada')
    expect(row!.enfermera).toContain('Reporte')
    expect(row!.talleres).toBe('Taller Movilidad')
    expect(row!.subtotalTalleres).toBe(2000)
    expect(row!.recargos).toBe(surchargeType!.nombre)
    expect(row!.subtotalRecargos).toBe(1500)
    expect(row!.subtotalProcedimientos).toBe(10000)
    expect(row!.montoDescuentoProcedimientos).toBe(1000)
    expect(row!.descuentoProcedimientosAfectaPagoEnfermera).toBe(false)
    expect(row!.pagado).toBe(true)
    expect(row!.fechaPago).toBe('2026-07-10')
    expect(row!.totalBoleta).toBe(13000)

    // Mismo cálculo que getPagoEnfermeraDetalle (pagos-enfermeras.ts):
    // base = costo - examSum(0) - workshopSum(2000) - insumosSum(500) + descuentoProcedimientos revertido (1000, no afecta)
    // base = 13000 - 0 - 2000 - 500 + 1000 = 11500 → pago = round(11500 * 70 / 100) = 8050
    expect(row!.pagoEnfermera).toBe(8050)
  })

  it('sin enfermera asignada, el pago a enfermera es 0', async () => {
    const comuna = unique('ComunaSinEnfermera')
    const [address] = await db
      .insert(addresses)
      .values({ direccion: unique('direccion'), areaAdministrativa3: comuna })
      .returning()
    created.addresses.push(address!.id)

    const [patient] = await db
      .insert(patients)
      .values({ nombres: unique('Paciente'), apellidoPaterno: 'SinEnfermera', idDireccion: address!.id })
      .returning()
    created.patients.push(patient!.id)

    const fecha = '2026-08-08'
    const result = await createVisita(
      visitaForm({ idPaciente: patient!.id, fecha, cobraVisita: 'false' }),
    )
    expect(result.success).toBe(true)
    const id = (result as { success: true; data: { id: number } }).data.id
    created.visits.push(id)

    const [row] = await listVisitasForReport({ fechaInicio: fecha, fechaFin: fecha })
    expect(row).toBeDefined()
    expect(row!.enfermera).toBeNull()
    expect(row!.pagoEnfermera).toBe(0)
  })
})
