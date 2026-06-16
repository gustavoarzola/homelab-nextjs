import { readFileSync } from 'fs'
import { join } from 'path'
import { db } from './index'
import {
  users, nurses, patients, addresses, patientPhones,
  visits, visitExams, visitProcedures, visitWorkshops, visitSurcharges, visitExamResults,
  healthInsurances, elderlyResidences,
  procedures, exams,
  contactOrigins,
  surchargeTypes,
  nursingVisitPrices,
  workshops,
} from './schema'
import { eq, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

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

const COMUNAS_RM = [
  'Providencia', 'Las Condes', 'Ñuñoa', 'Santiago', 'La Florida', 'Maipú',
  'Vitacura', 'Lo Barnechea', 'La Reina', 'Peñalolén', 'Macul', 'San Miguel',
  'Independencia', 'Recoleta', 'La Cisterna', 'La Granja', 'Pudahuel',
  'Quilicura', 'Huechuraba', 'Conchalí', 'Cerrillos', 'Estación Central',
  'Puente Alto', 'San Bernardo', 'Colina', 'Lampa',
]

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

// ─── Nurse data ────────────────────────────────────────────────────────────────

const nurseData = [
  { nombres: 'María José', apellidoPaterno: 'González', apellidoMaterno: 'Reyes', rut: '8.234.567-1', telefono: '+56912345001', correo: 'mjgonzalez@clinica.cl', activo: true },
  { nombres: 'Claudia Andrea', apellidoPaterno: 'Muñoz', apellidoMaterno: 'Vargas', rut: '9.345.678-5', telefono: '+56912345002', correo: 'cmunoz@clinica.cl', activo: true },
  { nombres: 'Patricia', apellidoPaterno: 'Rojas', apellidoMaterno: 'Fuentes', rut: '10.456.789-4', telefono: '+56912345003', correo: 'projas@clinica.cl', activo: true },
  { nombres: 'Daniela Paz', apellidoPaterno: 'Soto', apellidoMaterno: 'Medina', rut: '11.567.890-6', telefono: '+56912345004', correo: 'dsoto@clinica.cl', activo: true },
  { nombres: 'Valentina', apellidoPaterno: 'Morales', apellidoMaterno: 'Castro', rut: '12.678.901-7', telefono: '+56912345005', correo: 'vmorales@clinica.cl', activo: true },
  { nombres: 'Carolina Isabel', apellidoPaterno: 'Pérez', apellidoMaterno: 'Silva', rut: '13.789.012-7', telefono: '+56912345006', correo: 'cperez@clinica.cl', activo: true },
  { nombres: 'Andrea', apellidoPaterno: 'López', apellidoMaterno: 'Torres', rut: '14.890.123-6', telefono: '+56912345007', correo: 'alopez@clinica.cl', activo: true },
  { nombres: 'Pamela Alejandra', apellidoPaterno: 'Martínez', apellidoMaterno: 'Díaz', rut: '15.901.234-4', telefono: '+56912345008', correo: 'pmartinez@clinica.cl', activo: true },
  { nombres: 'Javiera', apellidoPaterno: 'García', apellidoMaterno: 'Romero', rut: '16.012.345-1', telefono: '+56912345009', correo: 'jgarcia@clinica.cl', activo: true },
  { nombres: 'Camila Fernanda', apellidoPaterno: 'Hernández', apellidoMaterno: 'Vega', rut: '17.123.456-5', telefono: '+56912345010', correo: 'chernandez@clinica.cl', activo: true },
  { nombres: 'Francisca', apellidoPaterno: 'Jiménez', apellidoMaterno: 'Ramos', rut: '8.765.432-K', telefono: '+56912345011', correo: 'fjimenez@clinica.cl', activo: true },
  { nombres: 'Natalia Beatriz', apellidoPaterno: 'Flores', apellidoMaterno: 'Araya', rut: '9.876.543-3', telefono: '+56912345012', correo: 'nflores@clinica.cl', activo: true },
  { nombres: 'Alejandra', apellidoPaterno: 'Ramírez', apellidoMaterno: 'Gutiérrez', rut: '10.987.654-2', telefono: '+56912345013', correo: 'aramirez@clinica.cl', activo: true },
  { nombres: 'Constanza Paz', apellidoPaterno: 'Torres', apellidoMaterno: 'Navarro', rut: '12.111.222-1', telefono: '+56912345014', correo: 'ctorres@clinica.cl', activo: true },
  { nombres: 'Marcela', apellidoPaterno: 'Vargas', apellidoMaterno: 'Salinas', rut: '13.222.333-5', telefono: '+56912345015', correo: 'mvargas@clinica.cl', activo: true },
  { nombres: 'Lorena Andrea', apellidoPaterno: 'Castro', apellidoMaterno: 'Espinoza', rut: '14.333.444-9', telefono: '+56912345016', correo: 'lcastro@clinica.cl', activo: true },
  { nombres: 'Paola', apellidoPaterno: 'Ortiz', apellidoMaterno: 'Fuentes', rut: '15.444.555-2', telefono: '+56912345017', correo: 'portiz@clinica.cl', activo: true },
  { nombres: 'Bárbara Soledad', apellidoPaterno: 'Medina', apellidoMaterno: 'Ibáñez', rut: '16.555.666-6', telefono: '+56912345018', correo: 'bmedina@clinica.cl', activo: true },
  { nombres: 'Gabriela', apellidoPaterno: 'Vega', apellidoMaterno: 'Herrera', rut: '7.654.321-6', telefono: '+56912345019', correo: 'gvega@clinica.cl', activo: true },
  { nombres: 'Verónica Ximena', apellidoPaterno: 'Silva', apellidoMaterno: 'Campos', rut: '8.543.210-9', telefono: '+56912345020', correo: 'vsilva@clinica.cl', activo: true },
  { nombres: 'Susana', apellidoPaterno: 'Navarro', apellidoMaterno: 'Pizarro', rut: '9.432.109-3', telefono: '+56912345021', correo: 'snavarro@clinica.cl', activo: true },
  { nombres: 'Macarena Paz', apellidoPaterno: 'Espinoza', apellidoMaterno: 'Moreno', rut: '10.321.098-4', telefono: '+56912345022', correo: 'mespinoza@clinica.cl', activo: true },
  { nombres: 'Roxana', apellidoPaterno: 'Fuentes', apellidoMaterno: 'Contreras', rut: '11.210.987-0', telefono: '+56912345023', correo: 'rfuentes@clinica.cl', activo: true },
  { nombres: 'Isabel Cristina', apellidoPaterno: 'Contreras', apellidoMaterno: 'Valenzuela', rut: '12.109.876-8', telefono: '+56912345024', correo: 'icontreras@clinica.cl', activo: true },
  { nombres: 'Mónica', apellidoPaterno: 'Herrera', apellidoMaterno: 'Bravo', rut: '13.098.765-6', telefono: '+56912345025', correo: 'mherrera@clinica.cl', activo: true },
  { nombres: 'Ana Luisa', apellidoPaterno: 'Pizarro', apellidoMaterno: 'Cáceres', rut: '14.987.654-5', telefono: '+56912345026', correo: 'apizarro@clinica.cl', activo: true },
  { nombres: 'Karina', apellidoPaterno: 'Bravo', apellidoMaterno: 'Saavedra', rut: '15.876.543-8', telefono: '+56912345027', correo: 'kbravo@clinica.cl', activo: true },
  { nombres: 'Tamara Alejandra', apellidoPaterno: 'Moreno', apellidoMaterno: 'Sepúlveda', rut: '16.765.432-0', telefono: '+56912345028', correo: 'tmoreno@clinica.cl', activo: true },
  { nombres: 'Laura', apellidoPaterno: 'Valenzuela', apellidoMaterno: 'Poblete', rut: '17.654.321-3', telefono: '+56912345029', correo: 'lvalenzuela@clinica.cl', activo: true },
  { nombres: 'Pilar Eugenia', apellidoPaterno: 'Sepúlveda', apellidoMaterno: 'Meza', rut: '8.112.233-4', telefono: '+56912345030', correo: 'psepulveda@clinica.cl', activo: true },
  { nombres: 'Viviana', apellidoPaterno: 'Cáceres', apellidoMaterno: 'Leiva', rut: '9.223.344-8', telefono: '+56912345031', correo: 'vcaceres@clinica.cl', activo: true },
  { nombres: 'Fabiola Andrea', apellidoPaterno: 'Saavedra', apellidoMaterno: 'Acevedo', rut: '10.334.455-7', telefono: '+56912345032', correo: 'fsaavedra@clinica.cl', activo: true },
  { nombres: 'Ximena', apellidoPaterno: 'Poblete', apellidoMaterno: 'Vera', rut: '11.445.566-0', telefono: '+56912345033', correo: 'xpoblete@clinica.cl', activo: true },
  { nombres: 'Ingrid Paola', apellidoPaterno: 'Meza', apellidoMaterno: 'Figueroa', rut: '12.556.677-4', telefono: '+56912345034', correo: 'imeza@clinica.cl', activo: true },
  { nombres: 'Cecilia', apellidoPaterno: 'Leiva', apellidoMaterno: 'Cortés', rut: '13.667.788-8', telefono: '+56912345035', correo: 'cleiva@clinica.cl', activo: true },
  { nombres: 'Rosana Beatriz', apellidoPaterno: 'Acevedo', apellidoMaterno: 'Núñez', rut: '14.778.899-1', telefono: '+56912345036', correo: 'racevedo@clinica.cl', activo: true },
  { nombres: 'Elena', apellidoPaterno: 'Vera', apellidoMaterno: 'Palma', rut: '15.889.900-0', telefono: '+56912345037', correo: 'evera@clinica.cl', activo: true },
  { nombres: 'Jacqueline', apellidoPaterno: 'Figueroa', apellidoMaterno: 'Uribe', rut: '7.778.889-1', telefono: '+56912345038', correo: 'jfigueroa@clinica.cl', activo: true },
  { nombres: 'Sandra Paz', apellidoPaterno: 'Cortés', apellidoMaterno: 'Tapia', rut: '8.889.990-3', telefono: '+56912345039', correo: 'scortes@clinica.cl', activo: true },
  { nombres: 'Carla', apellidoPaterno: 'Núñez', apellidoMaterno: 'Lagos', rut: '9.990.001-6', telefono: '+56912345040', correo: 'cnunez@clinica.cl', activo: true },
  // Algunas inactivas para probar el filtro
  { nombres: 'Rosa María', apellidoPaterno: 'Palma', apellidoMaterno: 'Ríos', rut: '10.001.112-3', telefono: '+56912345041', correo: 'rpalma@clinica.cl', activo: false },
  { nombres: 'Denise', apellidoPaterno: 'Uribe', apellidoMaterno: 'Orellana', rut: '11.112.223-7', telefono: '+56912345042', correo: 'duribe@clinica.cl', activo: false },
  { nombres: 'Miriam Alejandra', apellidoPaterno: 'Tapia', apellidoMaterno: 'Alvarado', rut: '12.223.334-0', telefono: '+56912345043', correo: 'mtapia@clinica.cl', activo: false },
  { nombres: 'Loreto', apellidoPaterno: 'Lagos', apellidoMaterno: 'Benavides', rut: '13.334.445-4', telefono: '+56912345044', correo: 'llagos@clinica.cl', activo: false },
  { nombres: 'Nadia Fernanda', apellidoPaterno: 'Ríos', apellidoMaterno: 'Céspedes', rut: '14.445.556-8', telefono: '+56912345045', correo: 'nrios@clinica.cl', activo: false },
  // Sin algunos datos opcionales
  { nombres: 'Alejandra', apellidoPaterno: 'Orellana', apellidoMaterno: null, rut: null, telefono: '+56912345046', correo: null, activo: true },
  { nombres: 'Beatriz', apellidoPaterno: 'Alvarado', apellidoMaterno: 'Donoso', rut: '15.556.667-1', telefono: null, correo: 'balvarado@clinica.cl', activo: true },
  { nombres: 'Carmen Gloria', apellidoPaterno: 'Benavides', apellidoMaterno: null, rut: null, telefono: null, correo: null, activo: true },
  { nombres: 'Diana', apellidoPaterno: 'Céspedes', apellidoMaterno: 'Molina', rut: '16.667.778-5', telefono: '+56912345049', correo: 'dcespedes@clinica.cl', activo: true },
  { nombres: 'Eva Soledad', apellidoPaterno: 'Donoso', apellidoMaterno: 'Arriagada', rut: '17.778.889-9', telefono: '+56912345050', correo: 'edonoso@clinica.cl', activo: true },
]

// ─── Previsiones de salud ─────────────────────────────────────────────────────
// Distribución aproximada de Chile: ~75% FONASA, ~20% Isapres, ~5% otros

const previsionesData = [
  // FONASA (pública) – 4 tramos
  { nombre: 'FONASA Tramo A (Gratuito)', categoria: 'fonasa' },
  { nombre: 'FONASA Tramo B', categoria: 'fonasa' },
  { nombre: 'FONASA Tramo C', categoria: 'fonasa' },
  { nombre: 'FONASA Tramo D', categoria: 'fonasa' },
  // Isapres privadas vigentes
  { nombre: 'Isapre Banmédica', categoria: 'isapre' },
  { nombre: 'Isapre Cruz Blanca', categoria: 'isapre' },
  { nombre: 'Isapre Consalud', categoria: 'isapre' },
  { nombre: 'Isapre Colmena Golden Cross', categoria: 'isapre' },
  { nombre: 'Isapre Vida Tres', categoria: 'isapre' },
  { nombre: 'Isapre Nueva Masvida', categoria: 'isapre' },
  { nombre: 'Isapre Esencial', categoria: 'isapre' },
  // Sistemas especiales
  { nombre: 'Dipreca (Fuerzas Armadas)', categoria: 'particular' },
  { nombre: 'Capredena (Carabineros de Chile)', categoria: 'particular' },
  // Sin previsión
  { nombre: 'Particular / Sin previsión', categoria: 'particular' },
]


// ─── Residencias adulto mayor ─────────────────────────────────────────────────

const residenciasData = [
  { nombre: 'Residencia El Bosque – Las Condes' },
  { nombre: 'Hogar San José – Providencia' },
  { nombre: 'Residencia Los Abuelos – Maipú' },
  { nombre: 'Casas del Lago – Vitacura' },
  { nombre: 'Residencia Santa Marta – La Reina' },
  { nombre: 'Hogar Buen Pastor – Ñuñoa' },
  { nombre: 'Residencia Jardín de los Años – La Florida' },
  { nombre: 'Hogar Amor y Vida – Santiago Centro' },
  { nombre: 'Residencia Los Almendros – Concepción' },
  { nombre: 'Hogar San Francisco – Valparaíso' },
  { nombre: 'Residencia El Mirador – Temuco' },
  { nombre: 'Hogar Los Olivos – Viña del Mar' },
]

// ─── Procedimientos de enfermería (~100) ─────────────────────────────────────

const procedimientosData = [
  { nombre: 'Administración tto intramuscular / Sector Nororiente', codigo: 'ENF-001', categoria: 'inyectables', precio: 22000 },
  { nombre: 'Administración tto intradérmico', codigo: 'ENF-002', categoria: 'inyectables', precio: 22000 },
  { nombre: 'Curación de herida', codigo: 'ENF-003', categoria: 'curaciones', precio: 25000 },
  { nombre: 'Curación colostomía', codigo: 'ENF-004', categoria: 'curaciones', precio: 25000 },
  { nombre: 'Curación gastrostomía', codigo: 'ENF-005', categoria: 'curaciones', precio: 25000 },
  { nombre: 'Instalación S. Foley', codigo: 'ENF-006', categoria: 'sondas', precio: 35000 },
  { nombre: 'Instalación S. Nasogástrica', codigo: 'ENF-007', categoria: 'sondas', precio: 35000 },
  { nombre: 'Cambio bolsa colostomía', codigo: 'ENF-008', categoria: 'curaciones', precio: 25000 },
  { nombre: 'Cateterización vesical, vaciamiento globo', codigo: 'ENF-009', categoria: 'sondas', precio: 32000 },
  { nombre: 'Instalación Via Venosa Periferica (VVP)', codigo: 'ENF-010', categoria: 'endovenosos', precio: 35000 },
  { nombre: 'Tto EV menor 15 min', codigo: 'ENF-011', categoria: 'endovenosos', precio: 25000 },
  { nombre: 'Tto EV mayor 15 min', codigo: 'ENF-012', categoria: 'endovenosos', precio: 35000 },
  { nombre: 'Instalación VVP + tto EV menor 15 min', codigo: 'ENF-013', categoria: 'endovenosos', precio: 40000 },
  { nombre: 'Instalación VVP + tto EV mayor 15 min', codigo: 'ENF-014', categoria: 'endovenosos', precio: 45000 },
  { nombre: 'Vacuna Influenza colocada junto con examenes', codigo: 'ENF-015', categoria: 'vacunas', precio: 16000 },
  { nombre: 'Vacuna Influenza del pte colocada junto con examenes', codigo: 'ENF-016', categoria: 'vacunas', precio: 7000 },
  { nombre: 'Visita por deposiones y orina', codigo: 'ENF-017', categoria: 'otros', precio: 7000 },
]

// ─── Exámenes Imalab-Isapre (grupo especial, precios manuales en visita) ──────

const examenesIsapreData: { codigo: string; nombre: string; precio: number; grupoExamen: string }[] = [
  { codigo: '301001', nombre: 'HEMOGRAMA COMPLETO', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '301002', nombre: 'ACIDO FOLICO', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '301003', nombre: 'VHS (VELOCIDAD HEMOSEDIMENTACION)', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302005', nombre: 'ACIDO URICO', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302006', nombre: 'ALBUMINA', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302007', nombre: 'BILIRRUBINA TOTAL Y DIRECTA', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302008', nombre: 'CALCIO', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302009', nombre: 'COLESTEROL TOTAL', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302010', nombre: 'COLESTEROL HDL', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302011', nombre: 'COLESTEROL LDL (CALCULADO)', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302012', nombre: 'CREATININA', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302013', nombre: 'FOSFATASA ALCALINA', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302014', nombre: 'FOSFORO', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302015', nombre: 'GLUCOSA EN AYUNAS', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302016', nombre: 'GOT / AST (ASPARTATO AMINOTRANSFERASA)', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302017', nombre: 'GPT / ALT (ALANINO AMINOTRANSFERASA)', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302018', nombre: 'HEMOGLOBINA GLICOSILADA (HBA1C)', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302019', nombre: 'LDH (LACTATO DESHIDROGENASA)', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302020', nombre: 'MAGNESIO', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302021', nombre: 'PERFIL BIOQUIMICO (10 PARAMETROS)', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302022', nombre: 'POTASIO', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302023', nombre: 'PROTEINAS TOTALES', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302024', nombre: 'SODIO', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302025', nombre: 'TRIGLICERIDOS', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302026', nombre: 'UREA', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '302078', nombre: '25 OH VITAMINA D TOTAL', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '303001', nombre: 'TSH (HORMONA ESTIMULANTE DE TIROIDES)', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '303002', nombre: 'T4 LIBRE', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '303003', nombre: 'T3 LIBRE', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '303004', nombre: 'PSA (ANTIGENO PROSTATICO ESPECIFICO)', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '303005', nombre: 'PSA LIBRE', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '303006', nombre: 'INSULINA BASAL', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '303007', nombre: 'CORTISOL', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '303008', nombre: 'FERRITINA', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '303009', nombre: 'HIERRO SERICO', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '303010', nombre: 'CAPACIDAD FIJACION HIERRO (TIBC)', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '303011', nombre: 'B12 (VITAMINA B12 / COBALAMINA)', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '303012', nombre: 'PROTEINA C REACTIVA (PCR)', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '303013', nombre: 'PROTEINA C REACTIVA ULTRASENSIBLE', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '305001', nombre: 'ANA (ANTICUERPOS ANTINUCLEARES)', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '305002', nombre: 'FACTOR REUMATOIDE', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '305003', nombre: 'ANCA', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '306001', nombre: 'HEMOCULTIVO (AEROBIO / ANAEROBIO)', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '306002', nombre: 'UROCULTIVO', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '306003', nombre: 'CULTIVO SECRECION BRONQUIAL', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '306004', nombre: 'CULTIVO SECRECION HERIDA', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '306169', nombre: 'SEROLOGIA VIH (AC/AG)', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '309001', nombre: 'ORINA COMPLETA (SEDIMENTO)', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '309002', nombre: 'MICROALBUMINURIA EN ORINA', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '309003', nombre: 'CLEARANCE DE CREATININA (ORINA 24H)', precio: 0, grupoExamen: 'imalab isapre' },
  { codigo: '310001', nombre: 'PAP (PAPANICOLAOU)', precio: 0, grupoExamen: 'imalab isapre' },
]

// ─── Exámenes de laboratorio y diagnóstico (desde examenes.csv) ──────────────

const csvPath = join(process.cwd(), 'examenes.csv')
const csvLines = readFileSync(csvPath, 'utf-8').trim().split('\n').slice(1) // skip header

const examenesDataWithPrices = csvLines
  .map(line => {
    const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g) ?? line.split(',')
    const [codigo, nombre, precio, laboratorio] = cols.map(c => c.replace(/^"|"$/g, '').trim())
    if (!codigo || !nombre || !precio) return null
    return {
      codigo,
      nombre,
      precio: parseInt(precio, 10),
      grupoExamen: laboratorio ?? 'imalab',
    }
  })
  .filter(Boolean) as { codigo: string; nombre: string; precio: number; grupoExamen: string }[]

// ─── Orígenes de contacto ─────────────────────────────────────────────────────

const tiposRecargosData = [
  { nombre: 'Frasco glucosa 75gm', precio: 5000 },
  { nombre: 'Extracción muestra por sondeo', precio: 7000 },
  { nombre: 'Extracción menor 5 años 1 EU', precio: 7000 },
  { nombre: 'Extracción menor 3 años y/o cond. Especial 2 EU', precio: 7000 },
  { nombre: 'Extraccion Especial (diferentes diagnosticos)', precio: 7000 },
  { nombre: 'Domingos, Festivos y Sábado en la tarde', precio: 7000 },
  { nombre: 'Inyecciones fuera de lo estipulado', precio: 10000 },
  { nombre: 'Suspensión domicilio estando allá', precio: 7000 },
  { nombre: 'Transporte rapido de muestra (Gases, IFI, Copro)', precio: 0 },
]

const origenesContactoData = [
  { nombre: 'Bionet' },
  { nombre: 'Facebook' },
  { nombre: 'Instagram' },
  { nombre: 'Integramédica' },
  { nombre: 'Militar' },
  { nombre: 'Paciente antiguo' },
  { nombre: 'Publicidad Aauto' },
  { nombre: 'PUC' },
  { nombre: 'RAM' },
  { nombre: 'Recomendación de un amigo/familiar' },
  { nombre: 'Sitio Web' },
  { nombre: 'Tabancura' },
  { nombre: 'U Andes' },
]


// ─── Precios de visita de enfermería por comuna ────────────────────────────────

function buildNursingVisitPrices(): Array<{
  comuna: string | null
  precio: number
}> {
  const comunasStgo = [
    'Providencia', 'Las Condes', 'Ñuñoa', 'Santiago', 'La Florida', 'Maipú',
    'Vitacura', 'Lo Barnechea', 'La Reina', 'Peñalolén', 'Macul', 'San Miguel',
    'Independencia', 'Recoleta', 'La Cisterna', 'La Granja', 'Pudahuel',
    'Quilicura', 'Huechuraba', 'Conchalí', 'Cerrillos', 'Estación Central',
    'Puente Alto', 'San Bernardo', 'Colina', 'Lampa',
  ]

  const preciosVisita: Array<{
    comuna: string | null
    precio: number
  }> = [{ comuna: null, precio: 30000 }]

  // Definir precios base según zona
  // Zonas caras (centro/oriente): 40.000-55.000
  // Zonas medias (periférico cercano): 30.000-40.000
  // Zonas lejanas (periférico lejano): 25.000-35.000

  const zonasCaras = ['Providencia', 'Las Condes', 'Vitacura', 'Lo Barnechea', 'La Reina', 'Ñuñoa']
  const zonasMedias = ['Santiago', 'Peñalolén', 'Macul', 'San Miguel', 'Huechuraba', 'Recoleta', 'Independencia']
  const zonasLejanas = [
    'La Florida', 'Maipú', 'La Cisterna', 'La Granja', 'Pudahuel', 'Quilicura',
    'Conchalí', 'Cerrillos', 'Estación Central', 'Puente Alto', 'San Bernardo', 'Colina', 'Lampa'
  ]

  for (let i = 0; i < comunasStgo.length; i++) {
    const comuna = comunasStgo[i]!
    let basePrice = 0

    if (zonasCaras.includes(comuna)) {
      basePrice = 45000 + (i % 5) * 2000 // 45.000 - 53.000
    } else if (zonasMedias.includes(comuna)) {
      basePrice = 32000 + (i % 4) * 1500 // 32.000 - 36.500
    } else {
      basePrice = 28000 + (i % 4) * 1200 // 28.000 - 32.600
    }

    // Redondear a múltiplo de 500
    const precioRedondeado = Math.round(basePrice / 500) * 500

    preciosVisita.push({
      comuna,
      precio: precioRedondeado,
    })
  }

  return preciosVisita
}

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

  // Usuarios del sistema
  const adminHash = await bcrypt.hash('admin123', 10)
  const userHash = await bcrypt.hash('user123', 10)
  await db.insert(users).values([
    { nombre: 'Administrador', correo: 'admin@homelab.cl', contrasena: adminHash, rol: 'admin', activo: true },
    { nombre: 'Usuario Demo',  correo: 'usuario@homelab.cl', contrasena: userHash, rol: 'usuario', activo: true },
  ])

  // Previsiones de salud
  console.log(`   Insertando ${previsionesData.length} previsiones de salud...`)
  const insertedPrevisiones = await db.insert(healthInsurances).values(previsionesData).returning()
  const previsionIds = insertedPrevisiones.map(r => r.id)

  // Residencias adulto mayor
  console.log(`   Insertando ${residenciasData.length} residencias de adulto mayor...`)
  const insertedResidencias = await db.insert(elderlyResidences).values(residenciasData).returning()
  const residenciaIds = insertedResidencias.map(r => r.id)

  // Procedimientos
  console.log(`   Insertando ${procedimientosData.length} procedimientos...`)
  await db.insert(procedures).values(procedimientosData)

  // Exámenes
  console.log(`   Insertando ${examenesDataWithPrices.length} exámenes imalab...`)
  const insertedExams = await db.insert(exams).values(examenesDataWithPrices).onConflictDoNothing().returning()
  const examIds = insertedExams.map(e => e.id)

  // Exámenes Isapre
  console.log(`   Insertando ${examenesIsapreData.length} exámenes imalab isapre...`)
  await db.insert(exams).values(examenesIsapreData).onConflictDoNothing()

  // Orígenes de contacto
  console.log(`   Insertando ${origenesContactoData.length} orígenes de contacto...`)
  await db.insert(contactOrigins).values(origenesContactoData)

  // Tipos de recargos
  console.log(`   Insertando ${tiposRecargosData.length} tipos de recargos...`)
  await db.insert(surchargeTypes).values(tiposRecargosData)

  // Talleres
  const talleresData = [
    { nombre: 'Taller de Heridas y Curaciones', codigo: 'TAL-001' },
    { nombre: 'Taller de Administración de Medicamentos', codigo: 'TAL-002' },
    { nombre: 'Taller de Primeros Auxilios', codigo: 'TAL-003' },
    { nombre: 'Taller de Cuidados del Adulto Mayor', codigo: 'TAL-004' },
    { nombre: 'Taller de Prevención de Úlceras por Presión', codigo: 'TAL-005' },
    { nombre: 'Taller de Rehabilitación Respiratoria', codigo: 'TAL-006' },
    { nombre: 'Taller de Manejo del Dolor Crónico', codigo: 'TAL-007' },
    { nombre: 'Taller de Nutrición y Alimentación Enteral', codigo: 'TAL-008' },
    { nombre: 'Taller de Cuidados Postoperatorios', codigo: 'TAL-009' },
    { nombre: 'Taller de Autocuidado para Pacientes Crónicos', codigo: 'TAL-010' },
  ]
  console.log(`   Insertando ${talleresData.length} talleres...`)
  await db.insert(workshops).values(talleresData)

  // Enfermeras
  await db.insert(nurses).values(nurseData.map((n, i) => ({ ...n, rut: n.rut?.replace(/[.\-]/g, '') ?? null, comunaResidencia: pick(COMUNAS_RM, i) })))

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

      // Actualizar resultadosTotalCount en cada visita según sus exámenes reales
      const examCountByVisit = new Map<number, number>()
      for (const { idVisita } of allExamRows) {
        examCountByVisit.set(idVisita, (examCountByVisit.get(idVisita) ?? 0) + 1)
      }
      console.log(`   Actualizando resultadosTotalCount en ${examCountByVisit.size} visitas...`)
      for (const [idVisita, total] of examCountByVisit) {
        await db.update(visits).set({ resultadosTotalCount: total }).where(eq(visits.id, idVisita))
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

        const sentCountByVisit = new Map<number, number>()
        for (const { idVisita } of completedResults) {
          sentCountByVisit.set(idVisita, (sentCountByVisit.get(idVisita) ?? 0) + 1)
        }
        console.log(`   Actualizando resultadosEnviadosCount en ${sentCountByVisit.size} visitas completadas...`)
        for (const [idVisita, total] of sentCountByVisit) {
          await db.update(visits).set({ resultadosEnviadosCount: total }).where(eq(visits.id, idVisita))
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

  // Precios de visita de enfermería por comuna
  console.log(`   Generando precios de visitas de enfermería...`)
  const visitPricesData = buildNursingVisitPrices()
  await db.insert(nursingVisitPrices).values(visitPricesData)

  console.log('✅ Seed completado:')
  console.log('   admin@homelab.cl   / admin123  (rol: admin)')
  console.log('   usuario@homelab.cl / user123   (rol: usuario)')
  console.log(`   ${nurseData.length} enfermeras (${nurseData.filter(n => !n.activo).length} inactivas)`)
  console.log(`   ${TOTAL_PATIENTS} pacientes → ${rutCount} con RUT · ${passportCount} con pasaporte`)
  console.log(`   Previsión → FONASA: ${fonasaCount} · Isapre: ${isapreCount} · Otros: ${otrosCount}`)
  console.log(`   ${residenciaCount} pacientes en residencia adulto mayor`)
  console.log(`   ${visitsCount} visitas (ene-abr 2026: programadas, confirmadas, realizadas, completadas, no realizadas y canceladas)`)
  console.log(`   ${previsionesData.length} previsiones de salud`)
  console.log(`   ${procedimientosData.length} procedimientos · ${examenesDataWithPrices.length} exámenes imalab · ${examenesIsapreData.length} exámenes imalab isapre`)
  console.log(`   ${visitPricesData.length} precios de visitas de enfermería (por comuna)`)
  console.log(`   ${residenciasData.length} residencias adulto mayor`)
  console.log(`   ${origenesContactoData.length} orígenes de contacto`)
  console.log(`   ${tiposRecargosData.length} tipos de recargos`)
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Seed fallido:', err?.message ?? err)
  if (err?.cause) console.error('   Causa:', err.cause)
  process.exit(1)
})
