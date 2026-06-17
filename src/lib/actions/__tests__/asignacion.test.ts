// @ts-nocheck
import { afterAll, describe, expect, it, vi } from 'vitest'
import { db } from '@/db'
import { addresses, patients, visits } from '@/db/schema'
import { inArray } from 'drizzle-orm'
import { P } from './helpers'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { getVisitasParaAsignacion } from '../asignacion'

const created = {
  addresses: [] as number[],
  patients: [] as number[],
  visits: [] as number[],
}
const TEST_FECHA = '2099-06-17'
const OTHER_FECHA = '2099-06-18'

afterAll(async () => {
  await Promise.all([
    created.visits.length ? db.delete(visits).where(inArray(visits.id, created.visits)) : null,
  ])
  await Promise.all([
    created.patients.length ? db.delete(patients).where(inArray(patients.id, created.patients)) : null,
  ])
  await Promise.all([
    created.addresses.length ? db.delete(addresses).where(inArray(addresses.id, created.addresses)) : null,
  ])
})

async function seedPatient(label: string) {
  const [address] = await db
    .insert(addresses)
    .values({
      direccion: `${P}${label} 123`,
      areaAdministrativa3: 'Santiago',
      latitud: '1.000000000000000000',
      longitud: '2.000000000000000000',
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

async function seedVisit(estado: string, fecha = TEST_FECHA) {
  const patient = await seedPatient(estado)
  const [visit] = await db
    .insert(visits)
    .values({
      fecha,
      hora: '09:00',
      estado,
      idPaciente: patient.id,
    })
    .returning()
  created.visits.push(visit!.id)
  return visit!
}

describe('getVisitasParaAsignacion', () => {
  it('incluye visitas programadas y confirmadas, y excluye estados no asignables', async () => {
    const asignables = await Promise.all([
      seedVisit('programada'),
      seedVisit('confirmada'),
    ])

    await Promise.all([
      seedVisit('creada'),
      seedVisit('realizada'),
      seedVisit('completada'),
      seedVisit('no_realizada'),
      seedVisit('cancelada'),
      seedVisit('programada', OTHER_FECHA),
    ])

    const result = await getVisitasParaAsignacion(TEST_FECHA)
    const ids = result.map((v) => v.id).sort((a, b) => a - b)

    expect(ids).toEqual(asignables.map((v) => v.id).sort((a, b) => a - b))
  })
})
