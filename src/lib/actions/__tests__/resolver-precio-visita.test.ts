// @ts-nocheck
import { afterEach, describe, expect, it } from 'vitest'
import { db } from '@/db'
import { comunas, nursingVisitPrices } from '@/db/schema'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { P } from './helpers'
import { resolverPrecioVisitaEnfermeria, getPrecioVisitaPorIdComuna } from '@/lib/pricing/visitas'

const created = {
  comunas: [] as number[],
  nursingVisitPrices: [] as number[],
}

afterEach(async () => {
  if (created.nursingVisitPrices.length) {
    await db.delete(nursingVisitPrices).where(inArray(nursingVisitPrices.id, created.nursingVisitPrices))
  }
  // Depende de que nursingVisitPrices (FK restrict) ya se haya borrado arriba.
  if (created.comunas.length) {
    await db.delete(comunas).where(inArray(comunas.id, created.comunas))
  }
  created.comunas = []
  created.nursingVisitPrices = []
})

function unique(label: string) {
  return `${P}${label}_${Math.random().toString(36).slice(2, 8)}`
}

async function seedComuna(nombre: string, activo = true) {
  const [row] = await db.insert(comunas).values({ nombre, activo }).returning()
  created.comunas.push(row!.id)
  return row!
}

async function seedPrecio(idComuna: number, precio: number) {
  const [row] = await db.insert(nursingVisitPrices).values({ idComuna, precio }).returning()
  created.nursingVisitPrices.push(row!.id)
  return row!
}

// El seed global (`seedCatalogos`) ya deja UNA fila base activa (id_comuna IS
// NULL) — un uniqueIndex normal no deduplica múltiples NULL, así que insertar
// otra rompería el supuesto de "una sola fila base" que asume la app. Se
// reutiliza la existente en vez de sembrar una nueva (mismo patrón que
// `seedOrUsePrecioBase` en visitas-pricing.test.ts).
async function getPrecioBaseActivo() {
  const [row] = await db
    .select()
    .from(nursingVisitPrices)
    .where(and(isNull(nursingVisitPrices.idComuna), eq(nursingVisitPrices.activo, true)))
    .limit(1)
  if (!row) throw new Error('No hay precio base activo sembrado — revisar global-setup')
  return row
}

describe('resolverPrecioVisitaEnfermeria', () => {
  it('match exacto por nombre', async () => {
    const comuna = await seedComuna(unique('ComunaExacta'))
    await seedPrecio(comuna.id, 33000)

    const resultado = await resolverPrecioVisitaEnfermeria(db, comuna.nombre)
    expect(resultado).toEqual({
      precio: 33000,
      idComuna: comuna.id,
      comunaEncontrada: true,
      usoPrecioBase: false,
    })
  })

  it('match case/acento-insensible', async () => {
    const nombre = unique('ComunaÑandú')
    const comuna = await seedComuna(nombre)
    await seedPrecio(comuna.id, 28000)

    const resultado = await resolverPrecioVisitaEnfermeria(db, nombre.toUpperCase().replace('Ñ', 'N'))
    expect(resultado.comunaEncontrada).toBe(true)
    expect(resultado.idComuna).toBe(comuna.id)
    expect(resultado.precio).toBe(28000)
    expect(resultado.usoPrecioBase).toBe(false)
  })

  it('comuna inactiva se comporta como no encontrada (cae a precio base)', async () => {
    const comuna = await seedComuna(unique('ComunaInactiva'), false)
    await seedPrecio(comuna.id, 50000)
    const base = await getPrecioBaseActivo()

    const resultado = await resolverPrecioVisitaEnfermeria(db, comuna.nombre)
    expect(resultado.comunaEncontrada).toBe(false)
    expect(resultado.idComuna).toBeNull()
    expect(resultado.usoPrecioBase).toBe(true)
    expect(resultado.precio).toBe(base.precio)
  })

  it('comuna inexistente cae a precio base con comunaEncontrada=false', async () => {
    const base = await getPrecioBaseActivo()

    const resultado = await resolverPrecioVisitaEnfermeria(db, unique('ComunaQueNoExiste'))
    expect(resultado).toEqual({
      precio: base.precio,
      idComuna: null,
      comunaEncontrada: false,
      usoPrecioBase: true,
    })
  })

  it('comuna sin precio propio cae a precio base pero comunaEncontrada sigue true', async () => {
    const comuna = await seedComuna(unique('ComunaSinPrecioPropio'))
    const base = await getPrecioBaseActivo()

    const resultado = await resolverPrecioVisitaEnfermeria(db, comuna.nombre)
    expect(resultado.comunaEncontrada).toBe(true)
    expect(resultado.idComuna).toBe(comuna.id)
    expect(resultado.usoPrecioBase).toBe(true)
    expect(resultado.precio).toBe(base.precio)
  })

  it('sin comuna (null) cae directo a precio base', async () => {
    const base = await getPrecioBaseActivo()
    const resultado = await resolverPrecioVisitaEnfermeria(db, null)
    expect(resultado).toEqual({
      precio: base.precio,
      idComuna: null,
      comunaEncontrada: false,
      usoPrecioBase: true,
    })
  })
})

describe('getPrecioVisitaPorIdComuna', () => {
  it('usa el precio de la comuna cuando existe', async () => {
    const comuna = await seedComuna(unique('ComunaPorId'))
    await seedPrecio(comuna.id, 45000)
    const precio = await getPrecioVisitaPorIdComuna(db, comuna.id)
    expect(precio).toBe(45000)
  })

  it('cae a precio base si la comuna no tiene precio propio', async () => {
    const comuna = await seedComuna(unique('ComunaPorIdSinPrecio'))
    const base = await getPrecioBaseActivo()
    const precio = await getPrecioVisitaPorIdComuna(db, comuna.id)
    expect(precio).toBe(base.precio)
  })

  it('idComuna null devuelve directamente el precio base', async () => {
    const base = await getPrecioBaseActivo()
    const precio = await getPrecioVisitaPorIdComuna(db, null)
    expect(precio).toBe(base.precio)
  })
})
