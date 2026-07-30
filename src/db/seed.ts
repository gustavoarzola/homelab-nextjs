import { db } from './index'
import {
  nurses, patients, addresses, patientPhones,
  visits, visitExams, visitProcedures, visitWorkshops, visitSurcharges, visitExamResults,
  quotations,
  healthInsurances, elderlyResidences,
  procedures, exams,
  surchargeTypes,
  workshops,
} from './schema'
import { eq, sql } from 'drizzle-orm'
import { seedCatalogos } from './seed/catalogos'

// ─── RUT helpers ──────────────────────────────────────────────────────────────

function calcDV(n: number): string {
  let sum = 0, m = 2
  while (n > 0) {
    sum += (n % 10) * m
    n = Math.floor(n / 10)
    m = m === 7 ? 2 : m + 1
  }
  const r = 11 - (sum % 11)
  if (r === 11) return '0'
  if (r === 10) return 'K'
  return String(r)
}

function formatRut(n: number): string {
  return String(n) + calcDV(n)
}

// ─── Deterministic pseudo-random pick ────────────────────────────────────────

function pick<T>(arr: T[], i: number, salt = 0): T {
  const idx = ((i * 31 + salt * 997) % arr.length + arr.length) % arr.length
  return arr[idx]!
}

// Precio sesgado hacia valores bajos (10.000–50.000, en centenas)
// Usa raw^2 para concentrar la distribución cerca de 10.000
// ─── Name & address pools ─────────────────────────────────────────────────────

const NOMBRES_M = [
  'Carlos', 'Juan', 'Luis', 'Pedro', 'Miguel', 'José', 'Roberto', 'Diego',
  'Andrés', 'Felipe', 'Rodrigo', 'Sebastián', 'Cristian', 'Francisco', 'Manuel',
  'Ricardo', 'Alejandro', 'Eduardo', 'Raúl', 'Héctor', 'Mario', 'Sergio',
  'Gonzalo', 'Pablo', 'Fernando', 'Ignacio', 'Tomás', 'Nicolás', 'Matías',
  'Marcelo', 'Armando', 'Enrique', 'Hugo', 'Jorge', 'Víctor', 'Jaime', 'Óscar',
  'Ramón', 'Arturo', 'Gerardo', 'Alberto', 'Ernesto', 'Alfredo', 'Rubén',
]

const NOMBRES_F = [
  'María', 'Ana', 'Carmen', 'Rosa', 'Claudia', 'Patricia', 'Daniela', 'Valentina',
  'Carolina', 'Andrea', 'Pamela', 'Javiera', 'Camila', 'Francisca', 'Natalia',
  'Alejandra', 'Constanza', 'Marcela', 'Lorena', 'Paola', 'Bárbara', 'Gabriela',
  'Verónica', 'Susana', 'Macarena', 'Roxana', 'Isabel', 'Mónica', 'Karina',
  'Sandra', 'Ingrid', 'Cecilia', 'Rosana', 'Elena', 'Jacqueline', 'Fabiola',
  'Ximena', 'Viviana', 'Pilar', 'Laura', 'Tamara', 'Norma', 'Gloria', 'Miriam',
]

const APELLIDOS = [
  'González', 'Muñoz', 'Rojas', 'Díaz', 'Pérez', 'Soto', 'Contreras', 'Silva',
  'Martínez', 'Sepúlveda', 'Morales', 'Rodríguez', 'López', 'Fuentes', 'Hernández',
  'Torres', 'Araya', 'Flores', 'Espinoza', 'Valenzuela', 'Castillo', 'Ramírez',
  'Reyes', 'Gutiérrez', 'Castro', 'Vargas', 'Álvarez', 'Vásquez', 'Navarrete',
  'Carrasco', 'Ibáñez', 'Farías', 'Vega', 'Herrera', 'Núñez', 'Ortiz', 'Medina',
  'Riquelme', 'Bravo', 'Pizarro', 'Navarro', 'Cáceres', 'Poblete', 'Figueroa',
  'Cortés', 'Acevedo', 'Vera', 'Meza', 'Leiva', 'Saavedra', 'Salinas', 'Tapia',
  'Orellana', 'Alvarado', 'Benavides', 'Céspedes', 'Donoso', 'Arriagada', 'Molina',
  'Palma', 'Lagos', 'Ríos', 'Uribe', 'Garrido', 'Villalobos', 'Pino', 'Gatica',
  'Henríquez', 'Moya', 'Paredes', 'Yáñez', 'Zamora', 'Bustos', 'Aguilera', 'Ruiz',
]

const CALLES = [
  'Av. Providencia', 'Calle Las Rosas', 'Av. Las Condes', 'Pasaje Los Pinos',
  'Calle O\'Higgins', 'Av. Irarrázaval', 'Calle Lota', 'Av. Apoquindo',
  'Calle Suecia', 'Av. Vicuña Mackenna', 'Calle Teatinos', 'Av. Libertador',
  'Calle Moneda', 'Av. Grecia', 'Calle Huérfanos', 'Av. Santa Rosa',
  'Calle Estado', 'Av. España', 'Calle Serrano', 'Av. Tobalaba',
  'Calle Compañía', 'Av. Matta', 'Calle Agustinas', 'Av. República',
  'Pasaje Atacama', 'Calle Catedral', 'Av. Bulnes', 'Calle Morandé',
  'Av. Alameda', 'Calle Bandera', 'Pasaje Los Aromos', 'Calle San Martín',
  'Av. Kennedy', 'Calle Ebro', 'Av. Cristóbal Colón', 'Calle El Bosque',
  'Av. Ossa', 'Calle Príncipe de Gales', 'Av. Américo Vespucio', 'Calle Pocuro',
  'Av. Pedro de Valdivia', 'Calle Los Leones', 'Av. Quilín', 'Calle Manuel Montt',
]

const COMUNAS = [
  { nombre: 'Santiago',      region: 'Región Metropolitana',         provincia: 'Santiago',        lat: -33.4489, lng: -70.6693 },
  { nombre: 'Providencia',   region: 'Región Metropolitana',         provincia: 'Santiago',        lat: -33.4237, lng: -70.6058 },
  { nombre: 'Las Condes',    region: 'Región Metropolitana',         provincia: 'Santiago',        lat: -33.3902, lng: -70.5737 },
  { nombre: 'Ñuñoa',         region: 'Región Metropolitana',         provincia: 'Santiago',        lat: -33.4268, lng: -70.6048 },
  { nombre: 'La Florida',    region: 'Región Metropolitana',         provincia: 'Santiago',        lat: -33.5306, lng: -70.5598 },
  { nombre: 'Maipú',         region: 'Región Metropolitana',         provincia: 'Santiago',        lat: -33.5024, lng: -70.7507 },
  { nombre: 'Puente Alto',   region: 'Región Metropolitana',         provincia: 'Cordillera',      lat: -33.6115, lng: -70.5722 },
  { nombre: 'Vitacura',      region: 'Región Metropolitana',         provincia: 'Santiago',        lat: -33.3880, lng: -70.6164 },
  { nombre: 'Lo Barnechea',  region: 'Región Metropolitana',         provincia: 'Santiago',        lat: -33.3661, lng: -70.5169 },
  { nombre: 'San Miguel',    region: 'Región Metropolitana',         provincia: 'Santiago',        lat: -33.4780, lng: -70.6466 },
  { nombre: 'Macul',         region: 'Región Metropolitana',         provincia: 'Santiago',        lat: -33.4897, lng: -70.5782 },
  { nombre: 'La Reina',      region: 'Región Metropolitana',         provincia: 'Santiago',        lat: -33.4147, lng: -70.5479 },
  { nombre: 'Peñalolén',     region: 'Región Metropolitana',         provincia: 'Santiago',        lat: -33.4566, lng: -70.5361 },
  { nombre: 'Huechuraba',    region: 'Región Metropolitana',         provincia: 'Santiago',        lat: -33.3764, lng: -70.6389 },
  { nombre: 'Recoleta',      region: 'Región Metropolitana',         provincia: 'Santiago',        lat: -33.4076, lng: -70.6463 },
  { nombre: 'Independencia', region: 'Región Metropolitana',         provincia: 'Santiago',        lat: -33.3888, lng: -70.6739 },
  { nombre: 'Conchalí',      region: 'Región Metropolitana',         provincia: 'Santiago',        lat: -33.3981, lng: -70.6856 },
  { nombre: 'Lo Prado',      region: 'Región Metropolitana',         provincia: 'Santiago',        lat: -33.4438, lng: -70.7243 },
  { nombre: 'Cerro Navia',   region: 'Región Metropolitana',         provincia: 'Santiago',        lat: -33.4656, lng: -70.7355 },
  { nombre: 'Valparaíso',    region: 'Región de Valparaíso',         provincia: 'Valparaíso',      lat: -33.0458, lng: -71.6130 },
  { nombre: 'Viña del Mar',  region: 'Región de Valparaíso',         provincia: 'Valparaíso',      lat: -32.9814, lng: -71.5527 },
  { nombre: 'Quilpué',       region: 'Región de Valparaíso',         provincia: 'Marga Marga',     lat: -32.9882, lng: -71.4475 },
  { nombre: 'Villa Alemana', region: 'Región de Valparaíso',         provincia: 'Marga Marga',     lat: -32.7656, lng: -71.3380 },
  { nombre: 'Concepción',    region: 'Región del Biobío',            provincia: 'Concepción',     lat: -36.8201, lng: -73.0447 },
  { nombre: 'Talcahuano',    region: 'Región del Biobío',            provincia: 'Concepción',     lat: -36.7169, lng: -73.1062 },
  { nombre: 'Chiguayante',   region: 'Región del Biobío',            provincia: 'Concepción',     lat: -36.6369, lng: -72.9930 },
  { nombre: 'Temuco',        region: 'Región de La Araucanía',       provincia: 'Cautín',         lat: -38.7359, lng: -72.5904 },
  { nombre: 'Antofagasta',   region: 'Región de Antofagasta',        provincia: 'Antofagasta',    lat: -23.6345, lng: -70.3997 },
  { nombre: 'La Serena',     region: 'Región de Coquimbo',           provincia: 'Elqui',          lat: -29.9017, lng: -71.2515 },
  { nombre: 'Coquimbo',      region: 'Región de Coquimbo',           provincia: 'Elqui',          lat: -29.9533, lng: -71.3433 },
  { nombre: 'Rancagua',      region: 'Región del Libertador',        provincia: 'Cachapoal',      lat: -34.1701, lng: -70.7341 },
  { nombre: 'Talca',         region: 'Región del Maule',             provincia: 'Talca',          lat: -35.4437, lng: -71.6677 },
  { nombre: 'Chillán',       region: 'Región de Ñuble',              provincia: 'Diguillín',      lat: -36.6053, lng: -72.1032 },
  { nombre: 'Puerto Montt',  region: 'Región de Los Lagos',          provincia: 'Llanquihue',     lat: -41.3144, lng: -72.4886 },
  { nombre: 'Osorno',        region: 'Región de Los Lagos',          provincia: 'Osorno',         lat: -40.5748, lng: -72.5328 },
]

const PASSPORT_PREFIXES = [
  'US', 'AR', 'PE', 'BO', 'VE', 'CO', 'EC', 'PY', 'UY', 'BR',
  'MX', 'ES', 'IT', 'DE', 'FR', 'CN', 'HT', 'DO', 'CU', 'GT',
]

// ─── Patient generators ───────────────────────────────────────────────────────

const TOTAL_PATIENTS = 2000
const RUT_COUNT = 1250  // rest get passport

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function buildBirthDate(i: number): string {
  const h = ((i + 1) * 2654435761) >>> 0
  const pct = h % 100
  let year: number
  if (pct < 10) year = 1995 + (h % 29)   // jóvenes: 1995–2023
  else if (pct < 30) year = 1964 + (h % 31)  // adultos: 1964–1994
  else year = 1926 + (h % 38)              // adultos mayores: 1926–1963
  const month = ((h >>> 4) % 12) + 1
  const day = ((h >>> 8) % 28) + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function buildAddress(i: number) {
  const calle = pick(CALLES, i, 0)
  const numero = String(100 + (((i + 1) * 37) % 9900))
  const comuna = pick(COMUNAS, i, 4) as typeof COMUNAS[0]
  // Add slight random variation to coordinates within the commune (±0.02 degrees ≈ ±2km)
  const latVariation = (Math.random() - 0.5) * 0.04
  const lngVariation = (Math.random() - 0.5) * 0.04
  return {
    direccion: `${calle} ${numero}, ${comuna.nombre}`,
    direccionFormateada: `${calle} ${numero}, ${comuna.nombre}, ${comuna.region}`,
    numero,
    calle,
    localidad: comuna.nombre,
    areaAdministrativa1: comuna.region,
    areaAdministrativa2: comuna.provincia,
    areaAdministrativa3: comuna.nombre,
    pais: 'Chile',
    latitud: String((comuna.lat + latVariation).toFixed(8)),
    longitud: String((comuna.lng + lngVariation).toFixed(8)),
  }
}

function buildPatient(
  i: number,
  addressId: number,
  previsionIds: number[],
  residenciaIds: number[],
) {
  const isMale = i % 2 === 0
  const nombre = isMale ? pick(NOMBRES_M, i, 0) : pick(NOMBRES_F, i, 0)
  const apellidoPaterno = pick(APELLIDOS, i, 1)
  const apellidoMaterno = pick(APELLIDOS, i, 2)

  let identificador: string | null
  let tipoIdentificador: string | null
  if (i < RUT_COUNT) {
    // Generate RUT without dots/hyphens (normalized format)
    const rutNumber = 5_000_001 + i * 19
    function calcRutDV(n: number): string {
      let sum = 0, m = 2
      while (n > 0) {
        sum += (n % 10) * m
        n = Math.floor(n / 10)
        m = m === 7 ? 2 : m + 1
      }
      const r = 11 - (sum % 11)
      if (r === 11) return '0'
      if (r === 10) return 'K'
      return String(r)
    }
    identificador = String(rutNumber) + calcRutDV(rutNumber)
    tipoIdentificador = 'rut'
  } else {
    const prefix = pick(PASSPORT_PREFIXES, i, 5)
    const digits = String(1000000 + (((i - RUT_COUNT) * 7919 + 54321) % 9000000)).slice(0, 7)
    identificador = `${prefix}${digits}`.toUpperCase()
    tipoIdentificador = 'pasaporte'
  }

  const hasEmail = i % 10 < 7
  const correo = hasEmail
    ? `${normalize(nombre).replace(/\s/g, '.')}.${normalize(apellidoPaterno)}${i}@mail.cl`
    : null

  // Previsión de salud: distribución realista (75% FONASA, 20% Isapre, 5% otros)
  // previsionIds[0-3] = FONASA A/B/C/D, [4-10] = Isapres, [11-13] = otros
  const h = ((i + 7) * 1234567) >>> 0
  const pct = h % 100
  let idCompaniaSeguro: number
  if (pct < 20) {
    idCompaniaSeguro = previsionIds[0]! // FONASA A
  } else if (pct < 40) {
    idCompaniaSeguro = previsionIds[1]! // FONASA B
  } else if (pct < 55) {
    idCompaniaSeguro = previsionIds[2]! // FONASA C
  } else if (pct < 75) {
    idCompaniaSeguro = previsionIds[3]! // FONASA D
  } else if (pct < 82) {
    idCompaniaSeguro = pick(previsionIds.slice(4, 11), i, 3)! // Isapre aleatoria
  } else if (pct < 90) {
    idCompaniaSeguro = pick(previsionIds.slice(4, 11), i, 7)! // Isapre aleatoria
  } else if (pct < 93) {
    idCompaniaSeguro = previsionIds[11]! // Dipreca
  } else if (pct < 96) {
    idCompaniaSeguro = previsionIds[12]! // Capredena
  } else {
    idCompaniaSeguro = previsionIds[13]! // Particular
  }

  // Residencia adulto mayor: ~10% de pacientes (mayoritariamente los mayores)
  // Asignamos residencia a cada ~10mo paciente
  const idResidenciaAdulto = (i % 10 === 3)
    ? pick(residenciaIds, i, 2)
    : null

  // Número de serie de cédula: solo para pacientes con RUT, ~80% tienen serie
  const serieDocumento = (tipoIdentificador === 'rut' && i % 5 !== 0)
    ? String(100000000 + ((i * 31337 + 99991) % 900000000)).slice(0, 9)
    : null

  return {
    identificador,
    tipoIdentificador,
    serieDocumento,
    nombres: nombre,
    apellidoPaterno,
    apellidoMaterno,
    fechaNacimiento: buildBirthDate(i),
    correo,
    idDireccion: addressId,
    idCompaniaSeguro,
    idResidenciaAdulto,
  }
}

// ─── Precio base de visita de enfermería ──────────────────────────────────────

const NURSING_BASE_PRICE = 30000

// ─── Item builder para visitas ────────────────────────────────────────────────

function buildVisitItems(
  idx: number,
  allProcsCat: { id: number; precio: number }[],
  allExamsCat: { id: number; precio: number }[],
  allWorkshopsCat: { id: number }[],
  allSurchargesCat: { id: number; precio: number }[],
) {
  const h1 = ((idx + 13) * 2654435761) >>> 0
  const h2 = ((idx + 97) * 1234567891) >>> 0
  const variant = h1 % 10

  // variant → tipo de visita
  // 0,1,2 → solo exámenes
  // 3,4   → solo procedimientos
  // 5,6   → exámenes + procedimientos
  // 7     → exámenes + recargo
  // 8     → procedimientos + taller
  // 9     → exámenes + procedimientos + recargo
  const hasExams     = variant !== 3 && variant !== 4 && variant !== 8
  const hasProcs     = variant === 3 || variant === 4 || (variant >= 5 && variant !== 7)
  const hasWorkshop  = variant === 8
  const hasSurcharge = variant === 7 || variant === 9

  const examItems:     { idExamen: number; precio: number }[]       = []
  const procItems:     { idProcedimiento: number; precio: number }[] = []
  const workshopItems: { idTaller: number; precio: number }[]        = []
  const surchargeItems:{ idTipoRecargo: number; precio: number }[]   = []

  if (hasExams && allExamsCat.length > 0) {
    const count = (h1 % 3) + 1 // 1-3 exámenes
    const used = new Set<number>()
    for (let e = 0; e < count; e++) {
      let ei = ((h1 * (e + 1) * 31 + e * 997) >>> 0) % allExamsCat.length
      while (used.has(ei)) ei = (ei + 1) % allExamsCat.length
      used.add(ei)
      examItems.push({ idExamen: allExamsCat[ei]!.id, precio: allExamsCat[ei]!.precio })
    }
  }

  if (hasProcs && allProcsCat.length > 0) {
    const count = (h2 % 2) + 1 // 1-2 procedimientos
    const used = new Set<number>()
    for (let p = 0; p < count; p++) {
      let pi = ((h2 * (p + 1) * 17 + p * 113) >>> 0) % allProcsCat.length
      while (used.has(pi)) pi = (pi + 1) % allProcsCat.length
      used.add(pi)
      procItems.push({ idProcedimiento: allProcsCat[pi]!.id, precio: allProcsCat[pi]!.precio })
    }
  }

  if (hasWorkshop && allWorkshopsCat.length > 0) {
    const wi = (h1 >>> 4) % allWorkshopsCat.length
    const workshopPrice = (((h2 >>> 8) % 7) + 2) * 10000 // 20.000-80.000
    workshopItems.push({ idTaller: allWorkshopsCat[wi]!.id, precio: workshopPrice })
  }

  if (hasSurcharge && allSurchargesCat.length > 0) {
    const si = (h2 >>> 4) % allSurchargesCat.length
    const surcharge = allSurchargesCat[si]!
    // Si el tipo tiene precio fijo lo usa; si es 0 (ej. transporte) genera monto aleatorio
    const surchargePrice = surcharge.precio > 0 ? surcharge.precio : (((h1 >>> 12) % 3) + 1) * 5000
    surchargeItems.push({ idTipoRecargo: surcharge.id, precio: surchargePrice })
  }

  const cobraVisita = (h2 % 100) < 35 // 35% cobran visita de enfermería

  const total =
    examItems.reduce((s, e) => s + e.precio, 0) +
    procItems.reduce((s, p) => s + p.precio, 0) +
    workshopItems.reduce((s, w) => s + w.precio, 0) +
    surchargeItems.reduce((s, r) => s + r.precio, 0) +
    (cobraVisita ? NURSING_BASE_PRICE : 0)

  return { examItems, procItems, workshopItems, surchargeItems, cobraVisita, total }
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Seeding database...')

  // Truncate sin piedad — CASCADE resuelve todas las FK, RESTART IDENTITY resetea los IDs
  await db.execute(sql`
    TRUNCATE TABLE
      recargos_visitas,
      talleres_visitas,
      examenes_visitas,
      procedimientos_visitas,
      examenes_isapre_visitas,
      cotizacion_talleres,
      cotizacion_procedimientos,
      cotizacion_examenes,
      examenes_isapre_cotizaciones,
      cotizacion_recargos,
      cotizaciones,
      visitas,
      precios_visita_enfermeria,
      telefonos_pacientes,
      pacientes,
      direcciones,
      enfermeras,
      companias_seguros,
      residencias_adulto_mayor,
      procedimientos,
      examenes,
      talleres,
      origenes_contacto,
      tipos_recargos,
      usuarios
    RESTART IDENTITY CASCADE
  `)

  // Catálogos "de verdad" (prod-safe, idempotente) + usuarios del sistema.
  // Ver `src/db/seed/catalogos.ts`. No usa RETURNING: los IDs se vuelven a
  // leer por clave natural abajo (la tabla acaba de truncarse, así que el
  // orden de inserción coincide con el orden de `id` ascendente).
  await seedCatalogos(db)

  const insertedPrevisiones = await db
    .select({ id: healthInsurances.id })
    .from(healthInsurances)
    .orderBy(healthInsurances.id)
  const previsionIds = insertedPrevisiones.map(r => r.id)

  const insertedResidencias = await db
    .select({ id: elderlyResidences.id })
    .from(elderlyResidences)
    .orderBy(elderlyResidences.id)
  const residenciaIds = insertedResidencias.map(r => r.id)

  // Direcciones (una por paciente)
  console.log(`   Insertando ${TOTAL_PATIENTS} direcciones...`)
  const addressRows = Array.from({ length: TOTAL_PATIENTS }, (_, i) => buildAddress(i))
  const insertedAddresses = await db.insert(addresses).values(addressRows).returning()

  // Pacientes
  console.log(`   Insertando ${TOTAL_PATIENTS} pacientes...`)
  const patientRows = insertedAddresses.map(({ id }, i) => buildPatient(i, id, previsionIds, residenciaIds))
  const BATCH = 100
  for (let offset = 0; offset < patientRows.length; offset += BATCH) {
    await db.insert(patients).values(patientRows.slice(offset, offset + BATCH))
  }

  const rutCount = patientRows.filter(p => p.tipoIdentificador === 'rut').length
  const passportCount = patientRows.filter(p => p.tipoIdentificador === 'pasaporte').length
  const residenciaCount = patientRows.filter(p => p.idResidenciaAdulto !== null).length

  // Distribución de previsiones
  const prevDist: Record<number, number> = {}
  patientRows.forEach(p => { prevDist[p.idCompaniaSeguro] = (prevDist[p.idCompaniaSeguro] ?? 0) + 1 })
  const fonasaCount = (prevDist[previsionIds[0]!] ?? 0) + (prevDist[previsionIds[1]!] ?? 0) +
                      (prevDist[previsionIds[2]!] ?? 0) + (prevDist[previsionIds[3]!] ?? 0)
  const isapreCount = previsionIds.slice(4, 11).reduce((s, id) => s + (prevDist[id] ?? 0), 0)
  const otrosCount  = TOTAL_PATIENTS - fonasaCount - isapreCount

  // Catálogos para generar items de visitas
  const allProcsCat    = await db.select({ id: procedures.id, precio: procedures.precio }).from(procedures)
  const allExamsCat    = await db.select({ id: exams.id, precio: exams.precio }).from(exams)
  const allWorkshopsCat = await db.select({ id: workshops.id }).from(workshops)
  const allSurchargesCat = await db.select({ id: surchargeTypes.id, precio: surchargeTypes.precio }).from(surchargeTypes)

  // Visitas con historial (enero-early abril 2026)
  const allPatients = await db.select({ id: patients.id }).from(patients)
  const allNurses = await db.select({ id: nurses.id }).from(nurses).where(eq(nurses.activo, true))

  let visitsCount = 0

  if (allPatients.length > 0) {
    type SeedVisitState = 'programada' | 'confirmada' | 'realizada' | 'completada' | 'no_realizada' | 'cancelada'

    const visitRows: Array<{
      fecha: string
      hora: string
      estado: SeedVisitState
      costo: number
      cobraVisita: boolean
      idPaciente: number
      idEnfermera: number | null
      numeroBoleta: string
      tipoDocumento: string
      numeroAtencion: number | null
      origenContacto: string
      informacionAdicional: string
      pagado: boolean
      metodoPago: string | null
      fechaPago: string | null
      resultadosEnviadosCount: number
      resultadosTotalCount: number
      costoTraslado: number
      conceptoNoRealizada: string | null
      motivoCancelacion: string | null
    }> = []

    // Items por visita (indexados igual que visitRows)
    const visitItemsByIndex: Array<ReturnType<typeof buildVisitItems>> = []
    const completedVisitIndexes = new Set<number>()

    // Generate 12-22 visits per day (Mon-Sat) for Jan 1 2025 - Apr 15 2025
    const visitDates: { date: Date; state: SeedVisitState; assignNurse: boolean }[] = []

    const chileDateParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
    const chileYear = Number(chileDateParts.find((part) => part.type === 'year')?.value)
    const chileMonth = Number(chileDateParts.find((part) => part.type === 'month')?.value)
    const chileDay = Number(chileDateParts.find((part) => part.type === 'day')?.value)
    const today = new Date(chileYear, chileMonth - 1, chileDay)
    const cutoffDate = new Date(today)
    cutoffDate.setDate(cutoffDate.getDate() - 1) // Realizadas until yesterday
    const startDate = new Date(2026, 0, 1) // January 1, 2026
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + 15) // Today + 15 days

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      // Skip Sunday (0)
      if (dayOfWeek === 0) continue

      const isRealizada = d < cutoffDate
      const randomCount = Math.floor(Math.random() * 11) + 12 // 12-22 visits

      for (let i = 0; i < randomCount; i++) {
        const state: SeedVisitState = isRealizada
          ? i % 25 === 0 ? 'cancelada'
            : i % 16 === 0 ? 'no_realizada'
            : i % 7 === 0 ? 'realizada'
            : 'completada'
          : i % 20 === 0 ? 'cancelada'
            : i % 3 === 0 ? 'confirmada'
            : 'programada'
        const assignNurse = ['confirmada', 'realizada', 'completada', 'no_realizada'].includes(state)
          ? true
          : state === 'programada'
            ? Math.random() > 0.3
            : Math.random() > 0.5
        visitDates.push({
          date: new Date(d),
          state,
          assignNurse,
        })
      }
    }

    // Sort by date and create visit rows
    visitDates.sort((a, b) => a.date.getTime() - b.date.getTime())

    let realizadaCounter = 0
    for (let idx = 0; idx < visitDates.length; idx++) {
      const { date, state, assignNurse } = visitDates[idx]!
      const fecha = date.toISOString().split('T')[0]!
      const patientId = allPatients[idx % allPatients.length]!.id
      const nurseId = assignNurse && allNurses.length > 0 ? allNurses[idx % allNurses.length]!.id : null
      const hour = Math.floor(Math.random() * 24).toString().padStart(2, '0')
      const minute = Math.floor(Math.random() * 60).toString().padStart(2, '0')
      const second = '00'

      let numeroBoleta = ''
      let tipoDocumento = ''
      let numeroAtencion: number | null = null
      let pagado = false
      let metodoPago: string | null = null
      let fechaPago: string | null = null
      let costoTraslado = 0
      let conceptoNoRealizada: string | null = null
      let motivoCancelacion: string | null = null

      if (state === 'realizada' || state === 'completada') {
        realizadaCounter++
        numeroAtencion = realizadaCounter
        tipoDocumento = realizadaCounter % 3 === 0 ? 'factura' : 'boleta'
        numeroBoleta = String(realizadaCounter).padStart(7, '0')
      }
      if (state === 'completada') {
        pagado = true
        metodoPago = pick(['Efectivo', 'Transferencia', 'Débito', 'Crédito'], idx, 5)
        fechaPago = fecha
      }
      if (state === 'no_realizada') {
        costoTraslado = 12000 + (idx % 5) * 3000
        conceptoNoRealizada = pick(['Traslado', 'Visita fallida', 'Paciente ausente'], idx, 8)
      }
      if (state === 'cancelada') {
        motivoCancelacion = pick(['Reagendada por paciente', 'Paciente cancela', 'Sin disponibilidad horaria'], idx, 11)
      }

      const items = buildVisitItems(idx, allProcsCat, allExamsCat, allWorkshopsCat, allSurchargesCat)
      if (state === 'completada') completedVisitIndexes.add(idx)
      visitItemsByIndex.push(items)
      const resultadosTotalCount = items.examItems.length
      const resultadosEnviadosCount = state === 'completada' ? resultadosTotalCount : 0

      visitRows.push({
        fecha,
        hora: `${hour}:${minute}:${second}`,
        estado: state,
        costo: items.total,
        cobraVisita: items.cobraVisita,
        idPaciente: patientId,
        idEnfermera: nurseId,
        numeroBoleta,
        tipoDocumento,
        numeroAtencion,
        origenContacto: 'Sistema',
        informacionAdicional: '',
        pagado,
        metodoPago,
        fechaPago,
        resultadosEnviadosCount,
        resultadosTotalCount,
        costoTraslado,
        conceptoNoRealizada,
        motivoCancelacion,
      })
    }

    console.log(`   Insertando ${visitRows.length} visitas (enero-abril 2026)...`)
    const insertedVisitIds: number[] = []
    const VISIT_BATCH = 100
    for (let offset = 0; offset < visitRows.length; offset += VISIT_BATCH) {
      const returned = await db.insert(visits).values(visitRows.slice(offset, offset + VISIT_BATCH)).returning()
      insertedVisitIds.push(...returned.map(r => r.id))
    }
    visitsCount = visitRows.length

    // Construir filas de items usando los IDs reales de visitas
    const allExamRows:     { idExamen: number; idVisita: number; precio: number }[]        = []
    const allProcRows:     { idProcedimiento: number; idVisita: number; precio: number }[] = []
    const allWorkshopRows: { idTaller: number; idVisita: number; precio: number }[]        = []
    const allSurchargeRows:{ idTipoRecargo: number; idVisita: number; precio: number }[]   = []

    for (let i = 0; i < insertedVisitIds.length; i++) {
      const visitId = insertedVisitIds[i]!
      const items = visitItemsByIndex[i]!
      for (const e of items.examItems)     allExamRows.push({ ...e, idVisita: visitId })
      for (const p of items.procItems)     allProcRows.push({ ...p, idVisita: visitId })
      for (const w of items.workshopItems) allWorkshopRows.push({ ...w, idVisita: visitId })
      for (const s of items.surchargeItems)allSurchargeRows.push({ ...s, idVisita: visitId })
    }

    const ITEM_BATCH = 500
    if (allExamRows.length > 0) {
      console.log(`   Insertando ${allExamRows.length} exámenes de visitas...`)
      for (let offset = 0; offset < allExamRows.length; offset += ITEM_BATCH) {
        await db.insert(visitExams).values(allExamRows.slice(offset, offset + ITEM_BATCH))
      }

      const completedResults: { idVisita: number; idExamen: number; enviado: boolean; fechaEnvio: string }[] = []
      for (let i = 0; i < insertedVisitIds.length; i++) {
        if (!completedVisitIndexes.has(i)) continue
        const visitId = insertedVisitIds[i]!
        const fechaEnvio = visitRows[i]!.fechaPago ?? visitRows[i]!.fecha
        for (const examItem of visitItemsByIndex[i]!.examItems) {
          completedResults.push({ idVisita: visitId, idExamen: examItem.idExamen, enviado: true, fechaEnvio })
        }
      }
      if (completedResults.length > 0) {
        console.log(`   Insertando ${completedResults.length} resultados de exámenes enviados...`)
        for (let offset = 0; offset < completedResults.length; offset += ITEM_BATCH) {
          await db.insert(visitExamResults).values(completedResults.slice(offset, offset + ITEM_BATCH))
        }
      }
    }
    if (allProcRows.length > 0) {
      console.log(`   Insertando ${allProcRows.length} procedimientos de visitas...`)
      for (let offset = 0; offset < allProcRows.length; offset += ITEM_BATCH) {
        await db.insert(visitProcedures).values(allProcRows.slice(offset, offset + ITEM_BATCH))
      }
    }
    if (allWorkshopRows.length > 0) {
      console.log(`   Insertando ${allWorkshopRows.length} talleres de visitas...`)
      for (let offset = 0; offset < allWorkshopRows.length; offset += ITEM_BATCH) {
        await db.insert(visitWorkshops).values(allWorkshopRows.slice(offset, offset + ITEM_BATCH))
      }
    }
    if (allSurchargeRows.length > 0) {
      console.log(`   Insertando ${allSurchargeRows.length} recargos de visitas...`)
      for (let offset = 0; offset < allSurchargeRows.length; offset += ITEM_BATCH) {
        await db.insert(visitSurcharges).values(allSurchargeRows.slice(offset, offset + ITEM_BATCH))
      }
    }
  }

  // Visitas sin asignación de enfermeras (24-30 marzo 2026, 40 visitas/día - COMMENTED OUT)
  /* Uncomment to add additional 280 visits for Mar 24-30
  if (allPatients.length > 0 && allLaboratories.length > 0) {
    const visitRows: Array<{
      fecha: string
      hora: string
      estado: string
      costo: number
      idPaciente: number
      idEnfermera: null
      idLaboratorio: number
      numeroBoleta: string
      tipoDocumento: string
      origenContacto: string
      informacionAdicional: string
    }> = []
    const startDate = new Date(2026, 2, 24) // Marzo 24, 2026
    const endDate = new Date(2026, 2, 30)   // Marzo 30, 2026

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const fecha = d.toISOString().split('T')[0]!
      for (let i = 0; i < 40; i++) {
        const patientId = allPatients[i % allPatients.length]!.id
        const labId = allLaboratories[i % allLaboratories.length]!.id
        const hour = Math.floor(Math.random() * 24).toString().padStart(2, '0')
        const minute = Math.floor(Math.random() * 60).toString().padStart(2, '0')
        const second = '00'
        visitRows.push({
          fecha,
          hora: `${hour}:${minute}:${second}`,
          estado: 'programada',
          costo: Math.floor(Math.random() * 100000) + 20000,
          idPaciente: patientId,
          idEnfermera: null,
          idLaboratorio: labId,
          numeroBoleta: '',
          tipoDocumento: '',
          origenContacto: 'Sistema',
          informacionAdicional: '',
        })
      }
    }

    console.log(`   Insertando ${visitRows.length} visitas sin asignación de enfermeras...`)
    const VISIT_BATCH = 100
    for (let offset = 0; offset < visitRows.length; offset += VISIT_BATCH) {
      await db.insert(visits).values(visitRows.slice(offset, offset + VISIT_BATCH))
    }
  }
  */

  const [legacyQuotationStates] = await db
    .select({ total: sql<number>`count(*)` })
    .from(quotations)
    .where(sql`${quotations.estado} IN ('borrador', 'convertida')`)
  if (Number(legacyQuotationStates?.total ?? 0) > 0) {
    throw new Error('Seed generó estados legacy de cotización')
  }

  console.log('✅ Seed completado:')
  console.log('   admin@homelab.cl   / admin123  (rol: admin)')
  console.log('   usuario@homelab.cl / user123   (rol: usuario)')
  console.log('   Catálogos: previsiones, residencias, procedimientos, exámenes, orígenes de contacto,')
  console.log('   tipos de recargos, talleres, precios de visita y enfermeras (ver seedCatalogos)')
  console.log(`   ${TOTAL_PATIENTS} pacientes → ${rutCount} con RUT · ${passportCount} con pasaporte`)
  console.log(`   Previsión → FONASA: ${fonasaCount} · Isapre: ${isapreCount} · Otros: ${otrosCount}`)
  console.log(`   ${residenciaCount} pacientes en residencia adulto mayor`)
  console.log(`   ${visitsCount} visitas (ene-abr 2026: programadas, confirmadas, realizadas, completadas, no realizadas y canceladas)`)
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Seed fallido:', err?.message ?? err)
  if (err?.cause) console.error('   Causa:', err.cause)
  process.exit(1)
})
