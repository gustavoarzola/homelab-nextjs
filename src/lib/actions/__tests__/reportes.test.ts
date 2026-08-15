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
  visitIsapreExams,
  visits,
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
})
