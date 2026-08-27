// ─── Operación determinista (Paso 2) ────────────────────────────────────────
//
// Puebla las tablas "de operación" (pacientes, direcciones, teléfonos, visitas
// + items, cotizaciones + items) de forma DETERMINISTA a partir de `(now, seed)`.
// A diferencia de `catalogos.ts`, esta parte SÍ trunca (es data de prueba, no
// catálogo real) y SÍ depende de aleatoriedad — pero toda esa aleatoriedad pasa
// por el PRNG con semilla de `rng.ts`, nunca por `Math.random()`.
//
// Regla de oro: el costo de una visita NUNCA se reimplementa a mano acá. Se
// calcula con `computeCostoVisita()` — el mismo núcleo puro que usa
// `calcularCostoVisitaPersistida()` en la app — a partir de los items recién
// generados en memoria, y se setea directo en el INSERT de `visitas`
// (`costo`/`montoDescuento`/`montoVisitaOriginal`/`montoDescuentoProcedimientos`).
// Antes se insertaba con `costo: 0` y se releía cada visita desde la BD para
// recalcularla; con miles de visitas eso significaba decenas de miles de
// queries adicionales (causa de timeouts en el driver serverless de Vercel).
//
// Para cotizaciones no existe un equivalente persistido (la app calcula `total`
// inline en `createCotizacion`/`updateCotizacion`), así que `computeQuotationCost()`
// replica esa misma fórmula (ver `00-overview.md`) usando el precio real de
// visita por comuna (`resolverPrecioVisitaEnfermeria`/`getPrecioVisitaPorIdComuna`).

import { asc, eq, sql } from 'drizzle-orm'
import { db } from '../index'
import {
  nurses,
  patients,
  addresses,
  patientPhones,
  visits,
  visitExams,
  visitProcedures,
  visitWorkshops,
  visitSurcharges,
  visitIsapreExams,
  visitExamResults,
  quotations,
  quotationExams,
  quotationProcedures,
  quotationWorkshops,
  quotationSurcharges,
  quotationIsapreExams,
  healthInsurances,
  elderlyResidences,
  procedures,
  exams,
  surchargeTypes,
  workshops,
  comunas,
  contactOrigins,
} from '../schema'
import { createRng, type Rng } from './rng'
import { previsionesData } from './data/previsiones'
import { resolverPrecioVisitaEnfermeria, getPrecioVisitaPorIdComuna, computeCostoVisita } from '@/lib/pricing/visitas'
import { resolverMontoDescuento, type DescuentoTipo } from '@/lib/pricing/descuento'
import { todaySantiago, parseDateLocal } from '@/lib/format'

// ─── RUT helper ─────────────────────────────────────────────────────────────

function calcDV(n: number): string {
  let sum = 0
  let m = 2
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

// ─── Pick determinista por índice (hash), independiente de la semilla ───────
// Se sigue usando para lo que ya era determinista antes del Paso 2 (mezcla de
// items por visita, distribución de pacientes) — no necesita el PRNG con
// semilla porque nunca dependió de `Math.random()`.

function pick<T>(arr: T[], i: number, salt = 0): T {
  const idx = ((i * 31 + salt * 997) % arr.length + arr.length) % arr.length
  return arr[idx]!
}

/** YYYY-MM-DD en hora LOCAL del proceso (evita el desfase de `toISOString()` en TZ != UTC). */
function formatDateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// ─── Pools de nombres / direcciones ──────────────────────────────────────────

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
  { nombre: 'Santiago',      region: 'Región Metropolitana', provincia: 'Santiago',   lat: -33.4489, lng: -70.6693 },
  { nombre: 'Providencia',   region: 'Región Metropolitana', provincia: 'Santiago',   lat: -33.4237, lng: -70.6058 },
  { nombre: 'Las Condes',    region: 'Región Metropolitana', provincia: 'Santiago',   lat: -33.3902, lng: -70.5737 },
  { nombre: 'Ñuñoa',         region: 'Región Metropolitana', provincia: 'Santiago',   lat: -33.4268, lng: -70.6048 },
  { nombre: 'La Florida',    region: 'Región Metropolitana', provincia: 'Santiago',   lat: -33.5306, lng: -70.5598 },
  { nombre: 'Maipú',         region: 'Región Metropolitana', provincia: 'Santiago',   lat: -33.5024, lng: -70.7507 },
  { nombre: 'Puente Alto',   region: 'Región Metropolitana', provincia: 'Cordillera', lat: -33.6115, lng: -70.5722 },
  { nombre: 'Vitacura',      region: 'Región Metropolitana', provincia: 'Santiago',   lat: -33.3880, lng: -70.6164 },
  { nombre: 'Lo Barnechea',  region: 'Región Metropolitana', provincia: 'Santiago',   lat: -33.3661, lng: -70.5169 },
  { nombre: 'San Miguel',    region: 'Región Metropolitana', provincia: 'Santiago',   lat: -33.4780, lng: -70.6466 },
  { nombre: 'Macul',         region: 'Región Metropolitana', provincia: 'Santiago',   lat: -33.4897, lng: -70.5782 },
  { nombre: 'La Reina',      region: 'Región Metropolitana', provincia: 'Santiago',   lat: -33.4147, lng: -70.5479 },
  { nombre: 'Peñalolén',     region: 'Región Metropolitana', provincia: 'Santiago',   lat: -33.4566, lng: -70.5361 },
  { nombre: 'Huechuraba',    region: 'Región Metropolitana', provincia: 'Santiago',   lat: -33.3764, lng: -70.6389 },
  { nombre: 'Recoleta',      region: 'Región Metropolitana', provincia: 'Santiago',   lat: -33.4076, lng: -70.6463 },
  { nombre: 'Independencia', region: 'Región Metropolitana', provincia: 'Santiago',   lat: -33.3888, lng: -70.6739 },
  { nombre: 'Conchalí',      region: 'Región Metropolitana', provincia: 'Santiago',   lat: -33.3981, lng: -70.6856 },
  { nombre: 'Lo Prado',      region: 'Región Metropolitana', provincia: 'Santiago',   lat: -33.4438, lng: -70.7243 },
  { nombre: 'Cerro Navia',   region: 'Región Metropolitana', provincia: 'Santiago',   lat: -33.4656, lng: -70.7355 },
  { nombre: 'Valparaíso',    region: 'Región de Valparaíso', provincia: 'Valparaíso', lat: -33.0458, lng: -71.6130 },
  { nombre: 'Viña del Mar',  region: 'Región de Valparaíso', provincia: 'Valparaíso', lat: -32.9814, lng: -71.5527 },
  { nombre: 'Quilpué',       region: 'Región de Valparaíso', provincia: 'Marga Marga', lat: -32.9882, lng: -71.4475 },
  { nombre: 'Villa Alemana', region: 'Región de Valparaíso', provincia: 'Marga Marga', lat: -32.7656, lng: -71.3380 },
  { nombre: 'Concepción',    region: 'Región del Biobío',    provincia: 'Concepción', lat: -36.8201, lng: -73.0447 },
  { nombre: 'Talcahuano',    region: 'Región del Biobío',    provincia: 'Concepción', lat: -36.7169, lng: -73.1062 },
  { nombre: 'Chiguayante',   region: 'Región del Biobío',    provincia: 'Concepción', lat: -36.6369, lng: -72.9930 },
  { nombre: 'Temuco',        region: 'Región de La Araucanía', provincia: 'Cautín',   lat: -38.7359, lng: -72.5904 },
  { nombre: 'Antofagasta',   region: 'Región de Antofagasta', provincia: 'Antofagasta', lat: -23.6345, lng: -70.3997 },
  { nombre: 'La Serena',     region: 'Región de Coquimbo',   provincia: 'Elqui',      lat: -29.9017, lng: -71.2515 },
  { nombre: 'Coquimbo',      region: 'Región de Coquimbo',   provincia: 'Elqui',      lat: -29.9533, lng: -71.3433 },
  { nombre: 'Rancagua',      region: 'Región del Libertador', provincia: 'Cachapoal', lat: -34.1701, lng: -70.7341 },
  { nombre: 'Talca',         region: 'Región del Maule',     provincia: 'Talca',      lat: -35.4437, lng: -71.6677 },
  { nombre: 'Chillán',       region: 'Región de Ñuble',      provincia: 'Diguillín',  lat: -36.6053, lng: -72.1032 },
  { nombre: 'Puerto Montt',  region: 'Región de Los Lagos',  provincia: 'Llanquihue', lat: -41.3144, lng: -72.4886 },
  { nombre: 'Osorno',        region: 'Región de Los Lagos',  provincia: 'Osorno',     lat: -40.5748, lng: -72.5328 },
]

const PASSPORT_PREFIXES = [
  'US', 'AR', 'PE', 'BO', 'VE', 'CO', 'EC', 'PY', 'UY', 'BR',
  'MX', 'ES', 'IT', 'DE', 'FR', 'CN', 'HT', 'DO', 'CU', 'GT',
]

const TOTAL_PATIENTS = 2000
const RUT_COUNT = 1250 // el resto usa pasaporte

// ─── Pacientes / direcciones (distribución determinista conservada) ─────────

function buildBirthDate(i: number): string {
  const h = ((i + 1) * 2654435761) >>> 0
  const pct = h % 100
  let year: number
  if (pct < 10) year = 1995 + (h % 29)
  else if (pct < 30) year = 1964 + (h % 31)
  else year = 1926 + (h % 38)
  const month = ((h >>> 4) % 12) + 1
  const day = ((h >>> 8) % 28) + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function buildAddress(i: number, rng: Rng) {
  const calle = pick(CALLES, i, 0)
  const numero = String(100 + (((i + 1) * 37) % 9900))
  const comuna = pick(COMUNAS, i, 4)
  // Jitter de coordenadas dentro de la comuna (±0.02° ≈ ±2km) — vía PRNG con semilla.
  const latVariation = (rng.next() - 0.5) * 0.04
  const lngVariation = (rng.next() - 0.5) * 0.04
  return {
    row: {
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
    },
    comuna: comuna.nombre,
  }
}

interface PrevisionCatalog {
  fonasaA: number
  fonasaB: number
  fonasaC: number
  fonasaD: number
  isapreIds: number[]
  dipreca: number
  capredena: number
  particular: number
}

function buildPatient(
  i: number,
  addressId: number,
  previsionCatalog: PrevisionCatalog,
  residenciaIds: number[],
) {
  const isMale = i % 2 === 0
  const nombre = isMale ? pick(NOMBRES_M, i, 0) : pick(NOMBRES_F, i, 0)
  const apellidoPaterno = pick(APELLIDOS, i, 1)
  const apellidoMaterno = pick(APELLIDOS, i, 2)

  let identificador: string
  let tipoIdentificador: string
  if (i < RUT_COUNT) {
    const rutNumber = 5_000_001 + i * 19
    identificador = formatRut(rutNumber)
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
  const h = ((i + 7) * 1234567) >>> 0
  const pct = h % 100
  let idCompaniaSeguro: number
  if (pct < 20) idCompaniaSeguro = previsionCatalog.fonasaA
  else if (pct < 40) idCompaniaSeguro = previsionCatalog.fonasaB
  else if (pct < 55) idCompaniaSeguro = previsionCatalog.fonasaC
  else if (pct < 75) idCompaniaSeguro = previsionCatalog.fonasaD
  else if (pct < 82) idCompaniaSeguro = pick(previsionCatalog.isapreIds, i, 3)
  else if (pct < 90) idCompaniaSeguro = pick(previsionCatalog.isapreIds, i, 7)
  else if (pct < 93) idCompaniaSeguro = previsionCatalog.dipreca
  else if (pct < 96) idCompaniaSeguro = previsionCatalog.capredena
  else idCompaniaSeguro = previsionCatalog.particular

  // Residencia adulto mayor: ~10% de pacientes
  const idResidenciaAdulto = i % 10 === 3 ? pick(residenciaIds, i, 2) : null

  // Número de serie de cédula: solo pacientes con RUT, ~80% tienen serie
  const serieDocumento =
    tipoIdentificador === 'rut' && i % 5 !== 0
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

// ─── Catálogos de items (leídos por clave natural / activos) ────────────────

interface CatalogItem {
  id: number
  nombre: string
  codigo: string | null
  precio: number
}

interface OperationCatalogs {
  procedures: CatalogItem[]
  examsRegular: CatalogItem[]
  examsIsapre: CatalogItem[]
  workshops: CatalogItem[]
  surcharges: { id: number; precio: number }[]
  contactOrigins: { id: number }[]
}

async function loadCatalogs(): Promise<OperationCatalogs> {
  const procRows = await db
    .select({ id: procedures.id, nombre: procedures.nombre, codigo: procedures.codigo, precio: procedures.precio })
    .from(procedures)
    .where(eq(procedures.activo, true))

  const examRows = await db
    .select({
      id: exams.id,
      nombre: exams.nombre,
      codigo: exams.codigo,
      precio: exams.precio,
      grupoExamen: exams.grupoExamen,
    })
    .from(exams)
    .where(eq(exams.activo, true))

  const workshopRows = await db
    .select({ id: workshops.id, nombre: workshops.nombre, codigo: workshops.codigo })
    .from(workshops)
    .where(eq(workshops.activo, true))

  const surchargeRows = await db
    .select({ id: surchargeTypes.id, precio: surchargeTypes.precio })
    .from(surchargeTypes)
    .where(eq(surchargeTypes.activo, true))

  const contactOriginRows = await db
    .select({ id: contactOrigins.id })
    .from(contactOrigins)
    .where(eq(contactOrigins.activo, true))

  return {
    procedures: procRows,
    examsRegular: examRows.filter((e) => e.grupoExamen !== 'imalab isapre').map(({ grupoExamen: _g, ...rest }) => rest),
    examsIsapre: examRows.filter((e) => e.grupoExamen === 'imalab isapre').map(({ grupoExamen: _g, ...rest }) => rest),
    workshops: workshopRows.map((w) => ({ ...w, precio: 0 })),
    surcharges: surchargeRows,
    contactOrigins: contactOriginRows,
  }
}

async function loadPrevisionCatalog(): Promise<PrevisionCatalog> {
  const rows = await db
    .select({ id: healthInsurances.id, nombre: healthInsurances.nombre, categoria: healthInsurances.categoria })
    .from(healthInsurances)
  const byName = new Map(rows.map((r) => [r.nombre, r.id]))
  function requirePrevision(nombre: string): number {
    const id = byName.get(nombre)
    if (id === undefined) throw new Error(`Previsión no encontrada en catálogo (¿corriste seedCatalogos?): ${nombre}`)
    return id
  }
  return {
    fonasaA: requirePrevision(previsionesData[0]!.nombre),
    fonasaB: requirePrevision(previsionesData[1]!.nombre),
    fonasaC: requirePrevision(previsionesData[2]!.nombre),
    fonasaD: requirePrevision(previsionesData[3]!.nombre),
    isapreIds: rows.filter((r) => r.categoria === 'isapre').map((r) => r.id),
    dipreca: requirePrevision(previsionesData[11]!.nombre),
    capredena: requirePrevision(previsionesData[12]!.nombre),
    particular: requirePrevision(previsionesData[13]!.nombre),
  }
}

// ─── Plan de items de una visita ─────────────────────────────────────────────

interface VisitItemPlan {
  examItems: { idExamen: number; precio: number }[]
  procItems: { idProcedimiento: number; precio: number; descuento: number }[]
  workshopItems: { idTaller: number; precio: number }[]
  surchargeItems: { idTipoRecargo: number; precio: number }[]
  isapreItems: { idExamen: number; valorCompleto: number; valorPagar: number; idPrevision: number | null }[]
  cobraVisita: boolean
  descuentoTipo: DescuentoTipo
  descuentoValor: number
  descuentoAfectaPagoEnfermera: boolean
  montoInsumos: number
  descuentoProcedimientosAfectaPagoEnfermera: boolean
}

function randomWorkshopPrice(rng: Rng): number {
  return rng.int(2, 8) * 10000 // 20.000 - 80.000
}

function randomSurchargePrice(rng: Rng, base: number): number {
  return base > 0 ? base : rng.int(1, 3) * 5000
}

function buildVisitItemPlan(
  idx: number,
  rng: Rng,
  catalogs: OperationCatalogs,
  patientIdPrevisionIsapre: number | null,
): VisitItemPlan {
  const h1 = ((idx + 13) * 2654435761) >>> 0
  const h2 = ((idx + 97) * 1234567891) >>> 0
  const variant = h1 % 10

  // 0,1,2 → solo exámenes · 3,4 → solo procedimientos · 5,6 → exámenes+procedimientos
  // 7 → exámenes+recargo · 8 → procedimientos+taller · 9 → exámenes+procedimientos+recargo
  const hasExams = variant !== 3 && variant !== 4 && variant !== 8
  const hasProcs = variant === 3 || variant === 4 || (variant >= 5 && variant !== 7)
  const hasWorkshop = variant === 8
  const hasSurcharge = variant === 7 || variant === 9

  const examItems: VisitItemPlan['examItems'] = []
  const procItemsRaw: { idProcedimiento: number; precio: number }[] = []
  const workshopItems: VisitItemPlan['workshopItems'] = []
  const surchargeItems: VisitItemPlan['surchargeItems'] = []
  const isapreItems: VisitItemPlan['isapreItems'] = []

  if (hasExams && catalogs.examsRegular.length > 0) {
    const count = (h1 % 3) + 1
    const used = new Set<number>()
    for (let e = 0; e < count; e++) {
      let ei = ((h1 * (e + 1) * 31 + e * 997) >>> 0) % catalogs.examsRegular.length
      while (used.has(ei)) ei = (ei + 1) % catalogs.examsRegular.length
      used.add(ei)
      const item = catalogs.examsRegular[ei]!
      examItems.push({ idExamen: item.id, precio: item.precio })
    }
  }

  if (hasProcs && catalogs.procedures.length > 0) {
    const count = (h2 % 2) + 1
    const used = new Set<number>()
    for (let p = 0; p < count; p++) {
      let pi = ((h2 * (p + 1) * 17 + p * 113) >>> 0) % catalogs.procedures.length
      while (used.has(pi)) pi = (pi + 1) % catalogs.procedures.length
      used.add(pi)
      const item = catalogs.procedures[pi]!
      procItemsRaw.push({ idProcedimiento: item.id, precio: item.precio })
    }
  }

  if (hasWorkshop && catalogs.workshops.length > 0) {
    const wi = (h1 >>> 4) % catalogs.workshops.length
    workshopItems.push({ idTaller: catalogs.workshops[wi]!.id, precio: randomWorkshopPrice(rng) })
  }

  if (hasSurcharge && catalogs.surcharges.length > 0) {
    const si = (h2 >>> 4) % catalogs.surcharges.length
    const surcharge = catalogs.surcharges[si]!
    surchargeItems.push({ idTipoRecargo: surcharge.id, precio: randomSurchargePrice(rng, surcharge.precio) })
  }

  const cobraVisita = (h2 % 100) < 35 // ~35% cobran visita de enfermería

  // ─ Descuento de visita (solo si cobra visita) ─
  let descuentoTipo: DescuentoTipo = 'monto'
  let descuentoValor = 0
  let descuentoAfectaPagoEnfermera = false
  if (cobraVisita && rng.chance(0.4)) {
    descuentoTipo = rng.chance(0.5) ? 'porcentaje' : 'monto'
    descuentoValor = descuentoTipo === 'porcentaje' ? rng.int(5, 30) : rng.int(2000, 10000)
    descuentoAfectaPagoEnfermera = rng.chance(0.5)
  }

  // ─ Monto de insumos (subconjunto, independiente de cobra visita) ─
  const montoInsumos = rng.chance(0.25) ? rng.int(3000, 15000) : 0

  // ─ Descuento por procedimiento (subconjunto de los procedimientos elegidos) ─
  let anyProcDescuento = false
  const procItems: VisitItemPlan['procItems'] = procItemsRaw.map((p) => {
    if (rng.chance(0.35)) {
      anyProcDescuento = true
      const descuento = Math.min(p.precio, rng.int(1000, 8000))
      return { ...p, descuento }
    }
    return { ...p, descuento: 0 }
  })
  const descuentoProcedimientosAfectaPagoEnfermera = anyProcDescuento ? rng.chance(0.5) : false

  // ─ Exámenes Imalab-Isapre (solo pacientes con previsión isapre) ─
  if (patientIdPrevisionIsapre !== null && catalogs.examsIsapre.length > 0 && rng.chance(0.3)) {
    const count = rng.int(1, 2)
    const picked = rng.shuffle(catalogs.examsIsapre).slice(0, count)
    for (const item of picked) {
      const valorCompleto = rng.int(15000, 60000)
      const valorPagar = rng.int(0, Math.round(valorCompleto * 0.4))
      isapreItems.push({ idExamen: item.id, valorCompleto, valorPagar, idPrevision: patientIdPrevisionIsapre })
    }
  }

  return {
    examItems,
    procItems,
    workshopItems,
    surchargeItems,
    isapreItems,
    cobraVisita,
    descuentoTipo,
    descuentoValor,
    descuentoAfectaPagoEnfermera,
    montoInsumos,
    descuentoProcedimientosAfectaPagoEnfermera,
  }
}

// ─── Costo de cotización (no existe función persistida equivalente) ─────────
// Replica exactamente la fórmula de `createCotizacion`/`updateCotizacion`
// (ver `src/lib/actions/cotizaciones.ts` y `00-overview.md`) para que el
// `total` sembrado sea consistente con lo que la app calcularía.

function computeQuotationCost(params: {
  procItems: { precio: number; descuento: number }[]
  examItems: { precio: number }[]
  isapreItems: { valorPagar: number }[]
  workshopItems: { precio: number }[]
  surchargeItems: { precio: number }[]
  cobraVisita: boolean
  montoVisitaOriginal: number
  descuentoTipo: DescuentoTipo
  descuentoValor: number
  montoInsumos: number
}) {
  const subtotalProcedimientosOriginal = params.procItems.reduce((s, p) => s + p.precio, 0)
  const montoDescuentoProcedimientos = params.procItems.reduce(
    (s, p) => s + Math.min(Math.max(0, p.descuento), p.precio),
    0,
  )
  const subtotalProcedimientos = subtotalProcedimientosOriginal - montoDescuentoProcedimientos
  const subtotalExamenes =
    params.examItems.reduce((s, e) => s + e.precio, 0) + params.isapreItems.reduce((s, e) => s + e.valorPagar, 0)
  const subtotalTalleres = params.workshopItems.reduce((s, w) => s + w.precio, 0)
  const subtotalRecargos = params.surchargeItems.reduce((s, r) => s + r.precio, 0)

  const montoVisitaOriginal = params.cobraVisita ? params.montoVisitaOriginal : 0
  const montoDescuento = params.cobraVisita
    ? resolverMontoDescuento(montoVisitaOriginal, params.descuentoTipo, params.descuentoValor)
    : 0
  const costoVisita = params.cobraVisita ? Math.max(0, montoVisitaOriginal - montoDescuento) : 0

  const total = subtotalProcedimientos + subtotalExamenes + subtotalTalleres + costoVisita + subtotalRecargos + params.montoInsumos

  return { total, montoDescuento, montoVisitaOriginal, montoDescuentoProcedimientos }
}

// ─── Seed de operación ────────────────────────────────────────────────────────

export interface SeedOperacionParams {
  /** Fecha de referencia ('YYYY-MM-DD'), reemplaza el "hoy" de zona Santiago como ancla de fechas. */
  now?: string
  /** Semilla del PRNG determinista. */
  seed?: number
}

export async function seedOperacion({ now = todaySantiago(), seed = 42 }: SeedOperacionParams = {}): Promise<void> {
  const rng = createRng(seed)

  // ─── Truncado acotado: SOLO tablas operacionales, nunca catálogos/usuarios ──
  console.log('   Truncando tablas de operación (visitas, cotizaciones, pacientes)...')
  await db.execute(sql`
    TRUNCATE TABLE
      recargos_visitas,
      talleres_visitas,
      examenes_visitas,
      procedimientos_visitas,
      examenes_isapre_visitas,
      examenes_visitas_resultados,
      cotizacion_talleres,
      cotizacion_procedimientos,
      cotizacion_examenes,
      examenes_isapre_cotizaciones,
      cotizacion_recargos,
      cotizaciones,
      visitas,
      telefonos_pacientes,
      pacientes,
      direcciones
    RESTART IDENTITY CASCADE
  `)

  // ─── Catálogos existentes (leídos por clave natural, no por ID correlativo) ─
  const previsionCatalog = await loadPrevisionCatalog()
  const isapreIdSet = new Set(previsionCatalog.isapreIds)

  const residenciaRows = await db.select({ id: elderlyResidences.id }).from(elderlyResidences)
  const residenciaIds = residenciaRows.map((r) => r.id)

  const catalogs = await loadCatalogs()

  const nurseRows = await db.select({ id: nurses.id }).from(nurses).where(eq(nurses.activo, true))

  // Catálogo real de comunas (id + nombre) — las cotizaciones necesitan un
  // `id_comuna` que exista de verdad (FK), a diferencia de `COMUNAS` más abajo
  // (fixture geográfico con lat/lng, incluye comunas fuera de la RM, usado
  // sólo para direcciones de fantasía y para ejercitar el camino "comuna sin
  // match en el catálogo ⇒ precio base").
  const catalogComunaRows = await db.select({ id: comunas.id, nombre: comunas.nombre }).from(comunas).orderBy(asc(comunas.id))
  const idComunaPorNombre = new Map(catalogComunaRows.map((c) => [c.nombre, c.id]))

  // Precio real de visita de enfermería, cacheado para no golpear la BD por
  // cada visita/cotización (las visitas persistidas obtienen su fee
  // automáticamente vía `actualizarCostoVisitaPersistida`; acá se precalcula
  // para el `costo` que se inserta directo en el INSERT masivo).
  const comunaFeeCache = new Map<string, number>()
  for (const c of COMUNAS) {
    comunaFeeCache.set(c.nombre, (await resolverPrecioVisitaEnfermeria(db, c.nombre)).precio ?? 0)
  }
  const baseFee = (await resolverPrecioVisitaEnfermeria(db, null)).precio ?? 0
  const feeForComuna = (comuna: string) => comunaFeeCache.get(comuna) ?? baseFee

  const idComunaFeeCache = new Map<number, number>()
  for (const c of catalogComunaRows) {
    idComunaFeeCache.set(c.id, (await getPrecioVisitaPorIdComuna(db, c.id)) ?? 0)
  }
  const feeForIdComuna = (idComuna: number) => idComunaFeeCache.get(idComuna) ?? baseFee

  // ─── Direcciones + pacientes ──────────────────────────────────────────────
  console.log(`   Insertando ${TOTAL_PATIENTS} direcciones...`)
  const addressBuilds = Array.from({ length: TOTAL_PATIENTS }, (_, i) => buildAddress(i, rng))
  const insertedAddresses = await db.insert(addresses).values(addressBuilds.map((a) => a.row)).returning()
  const addressComunas = addressBuilds.map((a) => a.comuna)

  console.log(`   Insertando ${TOTAL_PATIENTS} pacientes...`)
  const patientRows = insertedAddresses.map(({ id }, i) => buildPatient(i, id, previsionCatalog, residenciaIds))
  const BATCH = 100
  for (let offset = 0; offset < patientRows.length; offset += BATCH) {
    await db.insert(patients).values(patientRows.slice(offset, offset + BATCH))
  }

  const allPatients = await db.select({ id: patients.id }).from(patients).orderBy(patients.id)
  // `allPatients[i]` corresponde a `patientRows[i]` / `addressComunas[i]`: el
  // orden de inserción coincide con el orden ascendente de `id` (tabla recién
  // truncada, sin escrituras concurrentes).

  const rutCount = patientRows.filter((p) => p.tipoIdentificador === 'rut').length
  const passportCount = patientRows.filter((p) => p.tipoIdentificador === 'pasaporte').length
  const residenciaCount = patientRows.filter((p) => p.idResidenciaAdulto !== null).length

  // ─── Teléfonos de pacientes (1-2 por paciente, hoy no se sembraban) ─────────
  console.log(`   Insertando teléfonos de pacientes...`)
  const descripcionesTelefono = ['Móvil', 'Casa', 'Trabajo', 'Contacto']
  const phoneRows: { telefono: string; descripcion: string | null; idPaciente: number }[] = []
  for (const { id: idPaciente } of allPatients) {
    const count = rng.int(1, 2)
    for (let n = 0; n < count; n++) {
      const telefono = `+569${String(rng.int(10000000, 99999999))}`
      const descripcion = n === 0 ? 'Móvil' : rng.pick(descripcionesTelefono)
      phoneRows.push({ telefono, descripcion, idPaciente })
    }
  }
  for (let offset = 0; offset < phoneRows.length; offset += 500) {
    await db.insert(patientPhones).values(phoneRows.slice(offset, offset + 500))
  }

  // ─── Visitas (historial relativo a `now`) ────────────────────────────────
  let visitsCount = 0
  const insertedVisitIds: number[] = []

  if (allPatients.length > 0) {
    type SeedVisitState = 'programada' | 'confirmada' | 'realizada' | 'completada' | 'no_realizada' | 'cancelada'

    const visitRows: Array<{
      fecha: string
      hora: string
      estado: SeedVisitState
      costo: number
      montoDescuento: number
      montoVisitaOriginal: number
      montoDescuentoProcedimientos: number
      cobraVisita: boolean
      montoInsumos: number
      descuentoTipo: DescuentoTipo
      descuentoValor: number
      descuentoAfectaPagoEnfermera: boolean
      descuentoProcedimientosAfectaPagoEnfermera: boolean
      idPaciente: number
      idEnfermera: number | null
      numeroBoleta: string
      tipoDocumento: string
      numeroAtencion: number | null
      idOrigenContacto: number | null
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

    const visitItemsByIndex: VisitItemPlan[] = []
    const completedVisitIndexes = new Set<number>()

    const today = parseDateLocal(now)
    const cutoffDate = new Date(today)
    cutoffDate.setDate(cutoffDate.getDate() - 1) // Realizadas hasta ayer
    const startDate = new Date(2026, 0, 1) // Ancla fija de negocio: 1 de enero de 2026
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + 15) // hoy + 15 días

    const visitDates: { date: Date; state: SeedVisitState; assignNurse: boolean }[] = []

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay() // 0 = domingo
      if (dayOfWeek === 0) continue

      const isRealizada = d < cutoffDate
      const dailyCount = rng.int(12, 22)

      for (let i = 0; i < dailyCount; i++) {
        const state: SeedVisitState = isRealizada
          ? i % 25 === 0
            ? 'cancelada'
            : i % 16 === 0
              ? 'no_realizada'
              : i % 7 === 0
                ? 'realizada'
                : 'completada'
          : i % 20 === 0
            ? 'cancelada'
            : i % 3 === 0
              ? 'confirmada'
              : 'programada'
        const assignNurse = ['confirmada', 'realizada', 'completada', 'no_realizada'].includes(state)
          ? true
          : state === 'programada'
            ? rng.chance(0.7) // deja ~30% de las "programada" SIN enfermera (board de asignación)
            : rng.chance(0.5)
        visitDates.push({ date: new Date(d), state, assignNurse })
      }
    }

    visitDates.sort((a, b) => a.date.getTime() - b.date.getTime())

    const metodosPago = ['Efectivo', 'Transferencia', 'Débito', 'Crédito']
    let realizadaCounter = 0

    for (let idx = 0; idx < visitDates.length; idx++) {
      const { date, state, assignNurse } = visitDates[idx]!
      const fecha = formatDateLocal(date)
      const patientArrayIdx = idx % allPatients.length
      const patientId = allPatients[patientArrayIdx]!.id
      const patientPrevisionId = patientRows[patientArrayIdx]!.idCompaniaSeguro
      const patientIdPrevisionIsapre = isapreIdSet.has(patientPrevisionId) ? patientPrevisionId : null
      const nurseId = assignNurse && nurseRows.length > 0 ? nurseRows[idx % nurseRows.length]!.id : null
      const hour = String(rng.int(0, 23)).padStart(2, '0')
      const minute = String(rng.int(0, 59)).padStart(2, '0')

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
        metodoPago = rng.pick(metodosPago)
        fechaPago = fecha
      }
      if (state === 'no_realizada') {
        costoTraslado = 12000 + (idx % 5) * 3000
        conceptoNoRealizada = pick(['Traslado', 'Visita fallida', 'Paciente ausente'], idx, 8)
      }
      if (state === 'cancelada') {
        motivoCancelacion = pick(['Reagendada por paciente', 'Paciente cancela', 'Sin disponibilidad horaria'], idx, 11)
      }

      const items = buildVisitItemPlan(idx, rng, catalogs, patientIdPrevisionIsapre)
      if (state === 'completada') completedVisitIndexes.add(idx)
      visitItemsByIndex.push(items)
      const resultadosTotalCount = items.examItems.length + items.isapreItems.length
      const resultadosEnviadosCount = state === 'completada' ? resultadosTotalCount : 0

      // Costo derivado con la MISMA fórmula pura que usa la app
      // (`computeCostoVisita`, compartida con `calcularCostoVisitaPersistida`),
      // calculado en memoria con los items recién generados — evita releer
      // miles de visitas desde la BD tras insertarlas.
      const costo = computeCostoVisita({
        procedimientos: items.procItems,
        examenes: items.examItems,
        exameneIsapre: items.isapreItems,
        talleres: items.workshopItems,
        recargos: items.surchargeItems,
        aplicaVisitaEnfermeria: items.cobraVisita,
        precioVisita: items.cobraVisita ? feeForComuna(addressComunas[patientArrayIdx]!) : null,
        descuentoTipo: items.descuentoTipo,
        descuentoValor: items.descuentoValor,
        montoInsumos: items.montoInsumos,
      })

      visitRows.push({
        fecha,
        hora: `${hour}:${minute}:00`,
        estado: state,
        costo: costo.total,
        montoDescuento: costo.montoDescuento,
        montoVisitaOriginal: costo.costoVisitaEnfermeriaOriginal,
        montoDescuentoProcedimientos: costo.montoDescuentoProcedimientos,
        cobraVisita: items.cobraVisita,
        montoInsumos: items.montoInsumos,
        descuentoTipo: items.descuentoTipo,
        descuentoValor: items.descuentoValor,
        descuentoAfectaPagoEnfermera: items.descuentoAfectaPagoEnfermera,
        descuentoProcedimientosAfectaPagoEnfermera: items.descuentoProcedimientosAfectaPagoEnfermera,
        idPaciente: patientId,
        idEnfermera: nurseId,
        numeroBoleta,
        tipoDocumento,
        numeroAtencion,
        idOrigenContacto: catalogs.contactOrigins.length > 0 ? rng.pick(catalogs.contactOrigins).id : null,
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

    console.log(`   Insertando ${visitRows.length} visitas...`)
    const VISIT_BATCH = 100
    for (let offset = 0; offset < visitRows.length; offset += VISIT_BATCH) {
      const returned = await db.insert(visits).values(visitRows.slice(offset, offset + VISIT_BATCH)).returning()
      insertedVisitIds.push(...returned.map((r) => r.id))
    }
    visitsCount = visitRows.length

    const allExamRows: { idExamen: number; idVisita: number; precio: number }[] = []
    const allProcRows: { idProcedimiento: number; idVisita: number; precio: number; descuento: number }[] = []
    const allWorkshopRows: { idTaller: number; idVisita: number; precio: number }[] = []
    const allSurchargeRows: { idTipoRecargo: number; idVisita: number; precio: number }[] = []
    const allIsapreRows: { idExamen: number; idVisita: number; valorCompleto: number; valorPagar: number; idPrevision: number | null }[] = []

    for (let i = 0; i < insertedVisitIds.length; i++) {
      const visitId = insertedVisitIds[i]!
      const items = visitItemsByIndex[i]!
      for (const e of items.examItems) allExamRows.push({ ...e, idVisita: visitId })
      for (const p of items.procItems) allProcRows.push({ ...p, idVisita: visitId })
      for (const w of items.workshopItems) allWorkshopRows.push({ ...w, idVisita: visitId })
      for (const s of items.surchargeItems) allSurchargeRows.push({ ...s, idVisita: visitId })
      for (const iso of items.isapreItems) allIsapreRows.push({ ...iso, idVisita: visitId })
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
        for (const isoItem of visitItemsByIndex[i]!.isapreItems) {
          completedResults.push({ idVisita: visitId, idExamen: isoItem.idExamen, enviado: true, fechaEnvio })
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
    if (allIsapreRows.length > 0) {
      console.log(`   Insertando ${allIsapreRows.length} exámenes isapre de visitas...`)
      for (let offset = 0; offset < allIsapreRows.length; offset += ITEM_BATCH) {
        await db.insert(visitIsapreExams).values(allIsapreRows.slice(offset, offset + ITEM_BATCH))
      }
    }
  }

  // ─── Cotizaciones (hoy: cero) ────────────────────────────────────────────
  const COTIZACIONES_COUNT = Math.min(500, Math.max(150, Math.round(insertedVisitIds.length * 0.12)))
  const motivosRechazo = ['Precio muy alto', 'Eligió otro proveedor', 'Cambio de planes', 'Fuera de cobertura']
  const notasPosibles = [
    'Paciente solicita evaluación previa por videollamada.',
    'Coordinar con familiar antes de agendar.',
    'Requiere confirmación de previsión.',
    'Enviado con condiciones especiales de horario.',
  ]

  let quotationsCount = 0
  if (COTIZACIONES_COUNT > 0) {
    console.log(`   Insertando ${COTIZACIONES_COUNT} cotizaciones...`)

    type QuotationEstado = 'creada' | 'enviada' | 'aceptada' | 'rechazada'

    interface QuotationPlanItem {
      row: typeof quotations.$inferInsert
      procItems: { id: number; nombre: string; codigo: string | null; precio: number; descuento: number }[]
      examItems: { id: number; nombre: string; codigo: string | null; precio: number }[]
      isapreItems: { id: number; nombre: string; codigo: string | null; valorCompleto: number; valorPagar: number; idPrevision: number | null }[]
      workshopItems: { id: number; nombre: string; codigo: string | null; precio: number }[]
      surchargeItems: { idTipoRecargo: number; precio: number }[]
    }

    const plans: QuotationPlanItem[] = []

    for (let idx = 0; idx < COTIZACIONES_COUNT; idx++) {
      const r = rng.next()
      const estado: QuotationEstado = r < 0.25 ? 'creada' : r < 0.5 ? 'enviada' : r < 0.8 ? 'aceptada' : 'rechazada'

      const usePatient = rng.chance(0.6)
      let idPaciente: number | null = null
      let nombreDestinatario: string | null = null
      let emailDestinatario: string | null = null
      let telefonoDestinatario: string | null = null
      let identificacionDestinatario: string | null = null
      // Las cotizaciones exigen un `id_comuna` real (FK a `comunas`), a
      // diferencia de la dirección de fantasía del paciente (que puede caer
      // fuera de la RM). Si la comuna de la dirección no matchea el catálogo,
      // se cae a una comuna del catálogo elegida determinísticamente por
      // índice — igual de reproducible que el resto del seed, sin gastar un
      // draw extra del PRNG.
      let idComuna: number
      let patientIdPrevisionIsapre: number | null = null

      if (usePatient) {
        const patientArrayIdx = rng.int(0, allPatients.length - 1)
        idPaciente = allPatients[patientArrayIdx]!.id
        const nombreComuna = addressComunas[patientArrayIdx]!
        idComuna = idComunaPorNombre.get(nombreComuna) ?? pick(catalogComunaRows, patientArrayIdx, 13).id
        const previsionId = patientRows[patientArrayIdx]!.idCompaniaSeguro
        patientIdPrevisionIsapre = isapreIdSet.has(previsionId) ? previsionId : null
      } else {
        const isMale = rng.chance(0.5)
        const nombre = isMale ? rng.pick(NOMBRES_M) : rng.pick(NOMBRES_F)
        const apellido = rng.pick(APELLIDOS)
        const apellido2 = rng.pick(APELLIDOS)
        const comunaObj = rng.pick(catalogComunaRows)
        nombreDestinatario = `${nombre} ${apellido} ${apellido2}`
        emailDestinatario = `${normalize(nombre)}.${normalize(apellido)}${idx}@mail.cl`
        telefonoDestinatario = `+569${String(rng.int(10000000, 99999999))}`
        identificacionDestinatario = formatRut(6_000_000 + rng.int(0, 4_000_000))
        idComuna = comunaObj.id
        if (previsionCatalog.isapreIds.length > 0 && rng.chance(0.15)) {
          patientIdPrevisionIsapre = rng.pick(previsionCatalog.isapreIds)
        }
      }

      const cobraVisita = rng.chance(0.5)
      let descuentoTipo: DescuentoTipo = 'monto'
      let descuentoValor = 0
      let descuentoAfectaPagoEnfermera = false
      if (cobraVisita && rng.chance(0.4)) {
        descuentoTipo = rng.chance(0.5) ? 'porcentaje' : 'monto'
        descuentoValor = descuentoTipo === 'porcentaje' ? rng.int(5, 30) : rng.int(2000, 10000)
        descuentoAfectaPagoEnfermera = rng.chance(0.5)
      }
      const montoInsumos = rng.chance(0.25) ? rng.int(3000, 15000) : 0

      const procItemsRaw =
        catalogs.procedures.length > 0 && rng.chance(0.6)
          ? rng.shuffle(catalogs.procedures).slice(0, rng.int(1, 2))
          : []
      let anyProcDescuento = false
      const procItems = procItemsRaw.map((p) => {
        if (rng.chance(0.35)) {
          anyProcDescuento = true
          return { ...p, descuento: Math.min(p.precio, rng.int(1000, 8000)) }
        }
        return { ...p, descuento: 0 }
      })
      const descuentoProcedimientosAfectaPagoEnfermera = anyProcDescuento ? rng.chance(0.5) : false

      const examItems =
        catalogs.examsRegular.length > 0 && rng.chance(0.7)
          ? rng.shuffle(catalogs.examsRegular).slice(0, rng.int(1, 3))
          : []

      const isapreItems =
        patientIdPrevisionIsapre !== null && catalogs.examsIsapre.length > 0 && rng.chance(0.3)
          ? rng.shuffle(catalogs.examsIsapre)
              .slice(0, rng.int(1, 2))
              .map((e) => {
                const valorCompleto = rng.int(15000, 60000)
                const valorPagar = rng.int(0, Math.round(valorCompleto * 0.4))
                return { ...e, valorCompleto, valorPagar, idPrevision: patientIdPrevisionIsapre }
              })
          : []

      const workshopItems =
        catalogs.workshops.length > 0 && rng.chance(0.15)
          ? [{ ...rng.pick(catalogs.workshops), precio: randomWorkshopPrice(rng) }]
          : []

      const surchargeItems =
        catalogs.surcharges.length > 0 && rng.chance(0.15)
          ? [
              (() => {
                const s = rng.pick(catalogs.surcharges)
                return { idTipoRecargo: s.id, precio: randomSurchargePrice(rng, s.precio) }
              })(),
            ]
          : []

      const montoVisitaOriginal = cobraVisita ? feeForIdComuna(idComuna) : 0
      const cost = computeQuotationCost({
        procItems,
        examItems,
        isapreItems,
        workshopItems,
        surchargeItems,
        cobraVisita,
        montoVisitaOriginal,
        descuentoTipo,
        descuentoValor,
        montoInsumos,
      })

      const fechaEnvio =
        estado === 'enviada' || estado === 'aceptada' || estado === 'rechazada'
          ? new Date(parseDateLocal(now).getTime() - rng.int(1, 60) * 86_400_000)
          : null
      const motivoRechazo = estado === 'rechazada' ? rng.pick(motivosRechazo) : null
      const notas = rng.chance(0.3) ? rng.pick(notasPosibles) : null

      plans.push({
        row: {
          estado,
          idPaciente,
          nombreDestinatario,
          emailDestinatario,
          telefonoDestinatario,
          identificacionDestinatario,
          idComuna,
          cobraVisita,
          total: cost.total,
          montoInsumos,
          descuentoTipo,
          descuentoValor,
          montoDescuento: cost.montoDescuento,
          montoVisitaOriginal: cost.montoVisitaOriginal,
          descuentoAfectaPagoEnfermera,
          montoDescuentoProcedimientos: cost.montoDescuentoProcedimientos,
          descuentoProcedimientosAfectaPagoEnfermera,
          notas,
          motivoRechazo,
          fechaEnvio,
        },
        procItems,
        examItems,
        isapreItems,
        workshopItems,
        surchargeItems,
      })
    }

    const QUOTATION_BATCH = 100
    const insertedQuotationIds: number[] = []
    for (let offset = 0; offset < plans.length; offset += QUOTATION_BATCH) {
      const chunk = plans.slice(offset, offset + QUOTATION_BATCH)
      const returned = await db.insert(quotations).values(chunk.map((p) => p.row)).returning()
      insertedQuotationIds.push(...returned.map((r) => r.id))
    }
    quotationsCount = insertedQuotationIds.length

    const procRows: (typeof quotationProcedures.$inferInsert)[] = []
    const examRowsQ: (typeof quotationExams.$inferInsert)[] = []
    const isapreRowsQ: (typeof quotationIsapreExams.$inferInsert)[] = []
    const workshopRowsQ: (typeof quotationWorkshops.$inferInsert)[] = []
    const surchargeRowsQ: (typeof quotationSurcharges.$inferInsert)[] = []

    for (let i = 0; i < insertedQuotationIds.length; i++) {
      const idCotizacion = insertedQuotationIds[i]!
      const plan = plans[i]!
      for (const p of plan.procItems) {
        procRows.push({ idCotizacion, idProcedimiento: p.id, descripcion: p.nombre, codigo: p.codigo, precio: p.precio, descuento: p.descuento })
      }
      for (const e of plan.examItems) {
        examRowsQ.push({ idCotizacion, idExamen: e.id, descripcion: e.nombre, codigo: e.codigo, precio: e.precio })
      }
      for (const iso of plan.isapreItems) {
        isapreRowsQ.push({
          idCotizacion,
          idExamen: iso.id,
          descripcion: iso.nombre,
          codigo: iso.codigo,
          valorCompleto: iso.valorCompleto,
          valorPagar: iso.valorPagar,
          idPrevision: iso.idPrevision,
        })
      }
      for (const w of plan.workshopItems) {
        workshopRowsQ.push({ idCotizacion, idTaller: w.id, descripcion: w.nombre, codigo: w.codigo, precio: w.precio })
      }
      for (const s of plan.surchargeItems) {
        surchargeRowsQ.push({ idCotizacion, idTipoRecargo: s.idTipoRecargo, precio: s.precio })
      }
    }

    const Q_ITEM_BATCH = 500

    if (procRows.length > 0) {
      for (let offset = 0; offset < procRows.length; offset += Q_ITEM_BATCH) {
        await db.insert(quotationProcedures).values(procRows.slice(offset, offset + Q_ITEM_BATCH))
      }
    }
    if (examRowsQ.length > 0) {
      for (let offset = 0; offset < examRowsQ.length; offset += Q_ITEM_BATCH) {
        await db.insert(quotationExams).values(examRowsQ.slice(offset, offset + Q_ITEM_BATCH))
      }
    }
    if (isapreRowsQ.length > 0) {
      for (let offset = 0; offset < isapreRowsQ.length; offset += Q_ITEM_BATCH) {
        await db.insert(quotationIsapreExams).values(isapreRowsQ.slice(offset, offset + Q_ITEM_BATCH))
      }
    }
    if (workshopRowsQ.length > 0) {
      for (let offset = 0; offset < workshopRowsQ.length; offset += Q_ITEM_BATCH) {
        await db.insert(quotationWorkshops).values(workshopRowsQ.slice(offset, offset + Q_ITEM_BATCH))
      }
    }
    if (surchargeRowsQ.length > 0) {
      for (let offset = 0; offset < surchargeRowsQ.length; offset += Q_ITEM_BATCH) {
        await db.insert(quotationSurcharges).values(surchargeRowsQ.slice(offset, offset + Q_ITEM_BATCH))
      }
    }
  }

  // ─── Guard: nunca deben quedar estados legacy de cotización ─────────────
  const [legacyQuotationStates] = await db
    .select({ total: sql<number>`count(*)` })
    .from(quotations)
    .where(sql`${quotations.estado} IN ('borrador', 'convertida')`)
  if (Number(legacyQuotationStates?.total ?? 0) > 0) {
    throw new Error('seedOperacion generó estados legacy de cotización')
  }

  console.log('✅ Operación sembrada:')
  console.log(`   now=${now} · seed=${seed}`)
  console.log(`   ${TOTAL_PATIENTS} pacientes → ${rutCount} con RUT · ${passportCount} con pasaporte · ${residenciaCount} en residencia`)
  console.log(`   ${phoneRows.length} teléfonos de pacientes`)
  console.log(`   ${visitsCount} visitas`)
  console.log(`   ${quotationsCount} cotizaciones`)
}
