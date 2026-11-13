// @ts-nocheck
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/db'
import { addresses, nurses, patients, quotations, visits } from '@/db/schema'
import { inArray } from 'drizzle-orm'

import { searchPacientes } from '../pacientes'
import { searchVisitas } from '../visitas'
import { searchCotizaciones } from '../cotizaciones'
import { searchEnfermeras } from '../enfermeras'

// Búsqueda por palabras en orden libre (src/lib/search-sql.ts). Cada test filtra además por un
// apellido único (`tag`) para no depender de otros datos de la base de test.
const tag = `Zq${Math.random().toString(36).slice(2, 8)}`
const rutDigits = String(10_000_000 + Math.floor(Math.random() * 89_999_999))
const created = { addresses: [] as number[], patients: [] as number[], visits: [] as number[], quotations: [] as number[], nurses: [] as number[] }
let maria: { id: number }
let pedro: { id: number }

async function seedPatient(nombres: string, apellidoPaterno: string, identificador: string | null) {
  const [address] = await db.insert(addresses).values({ direccion: `${tag} dirección` }).returning()
  created.addresses.push(address!.id)
  const [p] = await db
    .insert(patients)
    .values({ nombres, apellidoPaterno, apellidoMaterno: tag, identificador, idDireccion: address!.id })
    .returning()
  created.patients.push(p!.id)
  return p!
}

beforeAll(async () => {
  maria = await seedPatient('María José', 'González', `${rutDigits}K`)
  pedro = await seedPatient('Pedro', 'Muñoz', null)
  const vs = await db
    .insert(visits)
    .values([
      { fecha: '2026-01-10', idPaciente: maria.id },
      { fecha: '2026-01-11', idPaciente: pedro.id },
    ])
    .returning()
  created.visits.push(...vs.map((v) => v.id))
  const qs = await db
    .insert(quotations)
    .values([
      { idPaciente: maria.id },
      { nombreDestinatario: `Ana Lía Soto ${tag}`, emailDestinatario: `ana.${tag}@example.com` },
    ])
    .returning()
  created.quotations.push(...qs.map((q) => q.id))
  const [n] = await db.insert(nurses).values({ nombres: 'Ana María', apellidoPaterno: 'Fernández', apellidoMaterno: tag }).returning()
  created.nurses.push(n!.id)
})

afterAll(async () => {
  if (created.quotations.length) await db.delete(quotations).where(inArray(quotations.id, created.quotations))
  if (created.visits.length) await db.delete(visits).where(inArray(visits.id, created.visits))
  if (created.patients.length) await db.delete(patients).where(inArray(patients.id, created.patients))
  if (created.addresses.length) await db.delete(addresses).where(inArray(addresses.id, created.addresses))
  if (created.nurses.length) await db.delete(nurses).where(inArray(nurses.id, created.nurses))
})

const params = (buscar: string) => ({ filters: { buscar }, sort: null, page: 1, pageSize: 50 })

describe('searchPacientes — palabras en cualquier orden', () => {
  it.each([
    `maria gonzalez ${tag}`,
    `${tag} gonzalez maria`,
    `gonzález ${tag}, maría josé`,
    `GONZ ${tag} jose`,
  ])('"%s" encuentra a María José González', async (q) => {
    const { rows } = await searchPacientes(params(q))
    expect(rows.map((r) => r.id)).toEqual([maria.id])
  })

  it('palabras que no están todas en el mismo paciente no matchean', async () => {
    const { rows, total } = await searchPacientes(params(`maria munoz ${tag}`))
    expect(rows).toEqual([])
    expect(total).toBe(0)
  })

  it('sin acentos encuentra nombres con acento', async () => {
    const { rows } = await searchPacientes(params(`munoz ${tag}`))
    expect(rows.map((r) => r.id)).toEqual([pedro.id])
  })

  it('busca por RUT con o sin formato', async () => {
    const formatted = `${rutDigits.slice(0, -6)}.${rutDigits.slice(-6, -3)}.${rutDigits.slice(-3)}-k`
    for (const q of [formatted, `${rutDigits}K`, rutDigits.split('').join(' ')]) {
      const { rows } = await searchPacientes(params(q))
      expect(rows.map((r) => r.id)).toContain(maria.id)
    }
  })

  it('los comodines de LIKE se tratan como texto', async () => {
    const { total } = await searchPacientes(params(`${tag} %`))
    expect(total).toBe(0)
  })
})

describe('searchVisitas — palabras en cualquier orden', () => {
  it('encuentra las visitas del paciente con nombre desordenado', async () => {
    const { rows } = await searchVisitas(params(`${tag} maria gonzalez`))
    expect(rows.map((r) => r.id)).toEqual([created.visits[0]])
  })
})

describe('searchCotizaciones — paciente o destinatario en cualquier orden', () => {
  it('encuentra por paciente', async () => {
    const { rows } = await searchCotizaciones(params(`gonzalez ${tag} maria`))
    expect(rows.map((r) => r.id)).toEqual([created.quotations[0]])
  })
  it('encuentra por destinatario sin paciente', async () => {
    const { rows } = await searchCotizaciones(params(`soto ${tag} lia`))
    expect(rows.map((r) => r.id)).toEqual([created.quotations[1]])
  })
})

describe('searchEnfermeras — palabras en cualquier orden', () => {
  it('encuentra con nombre y apellido desordenados y sin acentos', async () => {
    const { rows } = await searchEnfermeras({ filters: { nombre: `fernandez ${tag} maria` }, sort: null, page: 1, pageSize: 50 })
    expect(rows.map((r) => r.id)).toEqual([created.nurses[0]])
  })
})
