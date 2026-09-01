// @ts-nocheck
import { afterAll, describe, expect, it, vi } from 'vitest'
import { db } from '@/db'
import { addresses, exams, nurses, patients, visitExams, visitIsapreExams, visits } from '@/db/schema'
import { asc, inArray } from 'drizzle-orm'
import { P } from './helpers'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { getVisitasAsignadasPorEnfermera } from '../visitas-asignacion-email'

const created = {
  addresses: [] as number[],
  nurses: [] as number[],
  patients: [] as number[],
  visits: [] as number[],
}
const TEST_FECHA = '2099-07-17'
const OTHER_FECHA = '2099-07-18'

afterAll(async () => {
  await Promise.all([
    created.visits.length ? db.delete(visits).where(inArray(visits.id, created.visits)) : null,
  ])
  await Promise.all([
    created.patients.length ? db.delete(patients).where(inArray(patients.id, created.patients)) : null,
  ])
  await Promise.all([
    created.nurses.length ? db.delete(nurses).where(inArray(nurses.id, created.nurses)) : null,
  ])
  await Promise.all([
    created.addresses.length ? db.delete(addresses).where(inArray(addresses.id, created.addresses)) : null,
  ])
})

async function seedNurse(label: string) {
  const [nurse] = await db
    .insert(nurses)
    .values({
      nombres: `${P}${label}`,
      apellidoPaterno: 'Enfermera',
      correo: `${P}${label}@example.com`,
    })
    .returning()
  created.nurses.push(nurse!.id)
  return nurse!
}

async function seedPatient(label: string) {
  const [address] = await db
    .insert(addresses)
    .values({
      direccion: `${P}${label} 123`,
      direccionFormateada: `${P}${label} 123`,
      areaAdministrativa3: 'Santiago',
    })
    .returning()
  created.addresses.push(address!.id)

  const [patient] = await db
    .insert(patients)
    .values({
      nombres: `${P}${label}`,
      apellidoPaterno: 'Paciente',
      idDireccion: address!.id,
    })
    .returning()
  created.patients.push(patient!.id)

  return patient!
}

async function seedVisit(params: {
  estado: string
  idEnfermera: number
  fecha?: string
}) {
  const patient = await seedPatient(params.estado)
  const [visit] = await db
    .insert(visits)
    .values({
      fecha: params.fecha ?? TEST_FECHA,
      hora: '09:00',
      estado: params.estado,
      idPaciente: patient.id,
      idEnfermera: params.idEnfermera,
    })
    .returning()
  created.visits.push(visit!.id)
  return visit!
}

describe('getVisitasAsignadasPorEnfermera', () => {
  it('agrupa solo visitas confirmadas de la fecha seleccionada', async () => {
    const nurse = await seedNurse('ConConfirmada')
    const nurseOnlyProgramada = await seedNurse('SoloProgramada')

    const confirmedVisit = await seedVisit({ estado: 'confirmada', idEnfermera: nurse.id })
    await Promise.all([
      seedVisit({ estado: 'programada', idEnfermera: nurse.id }),
      seedVisit({ estado: 'realizada', idEnfermera: nurse.id }),
      seedVisit({ estado: 'completada', idEnfermera: nurse.id }),
      seedVisit({ estado: 'no_realizada', idEnfermera: nurse.id }),
      seedVisit({ estado: 'cancelada', idEnfermera: nurse.id }),
      seedVisit({ estado: 'confirmada', idEnfermera: nurse.id, fecha: OTHER_FECHA }),
      seedVisit({ estado: 'programada', idEnfermera: nurseOnlyProgramada.id }),
    ])

    const result = await getVisitasAsignadasPorEnfermera(TEST_FECHA)

    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe(nurse.id)
    expect(result[0]!.visitas.map((v) => v.id)).toEqual([confirmedVisit.id])
  })

  it('incluye exámenes regulares e isapre con código y precio, con los isapre al final', async () => {
    const nurse = await seedNurse('ConExamenes')
    const visit = await seedVisit({ estado: 'confirmada', idEnfermera: nurse.id })

    const [examRegular, examIsapre] = await db
      .select({ id: exams.id, codigo: exams.codigo, nombre: exams.nombre })
      .from(exams)
      .orderBy(asc(exams.id))
      .limit(2)

    await db.insert(visitExams).values({ idVisita: visit.id, idExamen: examRegular!.id, precio: 12500 })
    await db.insert(visitIsapreExams).values({
      idVisita: visit.id,
      idExamen: examIsapre!.id,
      valorCompleto: 20000,
      valorPagar: 9400,
    })

    const result = await getVisitasAsignadasPorEnfermera(TEST_FECHA)
    const examenes = result.find((e) => e.id === nurse.id)!.visitas[0]!.exámenes

    expect(examenes).toEqual([
      { nombre: examRegular!.nombre, codigo: examRegular!.codigo, precio: 12500, isapre: false },
      { nombre: examIsapre!.nombre, codigo: examIsapre!.codigo, precio: 9400, isapre: true },
    ])
  })
})
