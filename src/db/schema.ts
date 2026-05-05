import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  date,
  time,
  numeric,
  foreignKey,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ============================================================================
// 1. Usuario - Usuarios del sistema (login y permisos)
// ============================================================================
export const users = pgTable(
  'usuarios',
  {
    id: serial('id').primaryKey(),
    nombre: varchar('nombre', { length: 200 }).notNull(),
    correo: varchar('correo', { length: 100 }).notNull().unique(),
    contrasena: varchar('contrasena', { length: 255 }).notNull(),
    rol: varchar('rol', { length: 50 }).notNull().default('usuario'),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('usuarios_correo_idx').on(table.correo),
  ]
)

// ============================================================================
// 2. Enfermera - Profesionales que realizan visitas
// ============================================================================
export const nurses = pgTable(
  'enfermeras',
  {
    id: serial('id').primaryKey(),
    nombres: varchar('nombres', { length: 200 }).notNull(),
    apellidoPaterno: varchar('apellido_paterno', { length: 200 }).notNull(),
    apellidoMaterno: varchar('apellido_materno', { length: 200 }).default(''),
    rut: varchar('rut', { length: 200 }),
    telefono: varchar('telefono', { length: 20 }),
    correo: varchar('correo', { length: 100 }),
    porcentajePago: numeric('porcentaje_pago', { precision: 5, scale: 2 }).notNull().default('67.5'),
    comunaResidencia: varchar('comuna_residencia', { length: 100 }),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('enfermeras_apellido_paterno_idx').on(table.apellidoPaterno),
  ]
)

// ============================================================================
// 3. Direccion - Dirección física del paciente
// ============================================================================
export const addresses = pgTable(
  'direcciones',
  {
    id: serial('id').primaryKey(),
    direccion: varchar('direccion', { length: 200 }).notNull(),
    direccionFormateada: varchar('direccion_formateada', { length: 200 }).default(''),
    numero: varchar('numero', { length: 20 }),
    calle: varchar('calle', { length: 200 }),
    localidad: varchar('localidad', { length: 200 }),
    areaAdministrativa1: varchar('area_administrativa_1', { length: 200 }), // Región
    areaAdministrativa2: varchar('area_administrativa_2', { length: 200 }), // Provincia
    areaAdministrativa3: varchar('area_administrativa_3', { length: 200 }), // Comuna
    pais: varchar('pais', { length: 50 }),
    latitud: numeric('latitud', { precision: 20, scale: 18 }),
    longitud: numeric('longitud', { precision: 20, scale: 18 }),
    informacionAdicional: text('informacion_adicional'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  }
)

// ============================================================================
// 4. Paciente - Personas que reciben atención domiciliaria
// ============================================================================
export const patients = pgTable(
  'pacientes',
  {
    id: serial('id').primaryKey(),
    identificador: varchar('identificador', { length: 200 }).unique(),
    tipoIdentificador: varchar('tipo_identificador', { length: 20 }),
    nombres: varchar('nombres', { length: 200 }).notNull(),
    apellidoPaterno: varchar('apellido_paterno', { length: 200 }).default(''),
    apellidoMaterno: varchar('apellido_materno', { length: 200 }).default(''),
    fechaNacimiento: date('fecha_nacimiento'),
    correo: varchar('correo', { length: 100 }),
    informacionAdicional: text('informacion_adicional'),
    idDireccion: integer('id_direccion').notNull(),
    idCompaniaSeguro: integer('id_compania_seguro'),
    idResidenciaAdulto: integer('id_residencia_adulto'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.idDireccion], foreignColumns: [addresses.id] })
      .onDelete('restrict'),
    index('pacientes_apellido_paterno_idx').on(table.apellidoPaterno),
  ]
)

// ============================================================================
// 6. TelefonoPaciente - Múltiples teléfonos por paciente
// ============================================================================
export const patientPhones = pgTable(
  'telefonos_pacientes',
  {
    id: serial('id').primaryKey(),
    telefono: varchar('telefono', { length: 20 }).notNull(),
    descripcion: varchar('descripcion', { length: 50 }),
    idPaciente: integer('id_paciente').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.idPaciente], foreignColumns: [patients.id] })
      .onDelete('cascade'),
    index('telefonos_pacientes_id_paciente_idx').on(table.idPaciente),
  ]
)

// ============================================================================
// 7. Procedimiento - Catálogo de procedimientos de enfermería
// ============================================================================
export const procedures = pgTable(
  'procedimientos',
  {
    id: serial('id').primaryKey(),
    nombre: varchar('nombre', { length: 200 }).notNull(),
    codigo: varchar('codigo', { length: 50 }).notNull(),
    categoria: varchar('categoria', { length: 50 }).notNull().default('otros'),
    precio: integer('precio').notNull().default(0),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('procedimientos_codigo_idx').on(table.codigo),
  ]
)

// ============================================================================
// 8. Examen - Catálogo de exámenes médicos
// ============================================================================
export const exams = pgTable(
  'examenes',
  {
    id: serial('id').primaryKey(),
    nombre: varchar('nombre', { length: 200 }).notNull(),
    codigo: varchar('codigo', { length: 40 }).notNull(),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('examenes_codigo_idx').on(table.codigo),
  ]
)

// ============================================================================
// 9. Laboratorio - Redes de laboratorios
// ============================================================================
export const laboratories = pgTable(
  'laboratorios',
  {
    id: serial('id').primaryKey(),
    nombre: varchar('nombre', { length: 200 }).notNull(),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  }
)

// ============================================================================
// 11. CompaniaSeguro - Compañías de seguros (prev. de salud)
// ============================================================================
export const healthInsurances = pgTable(
  'companias_seguros',
  {
    id: serial('id').primaryKey(),
    nombre: varchar('nombre', { length: 200 }).notNull(),
    categoria: varchar('categoria', { length: 20 }), // 'fonasa' | 'isapre' | 'particular'
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  }
)

// ============================================================================
// 12. ResidenciaAdultoMayor - Catálogo de residencias
// ============================================================================
export const elderlyResidences = pgTable(
  'residencias_adulto_mayor',
  {
    id: serial('id').primaryKey(),
    nombre: varchar('nombre', { length: 200 }).notNull(),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  }
)

// ============================================================================
// 13. OrigenContacto - Catálogo de orígenes (enum configurable)
// ============================================================================
export const contactOrigins = pgTable(
  'origenes_contacto',
  {
    id: serial('id').primaryKey(),
    nombre: varchar('nombre', { length: 100 }).notNull(),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  }
)

// ============================================================================
// 14. Visita - Entidad central: visita programada a domicilio
// ============================================================================
export const visits = pgTable(
  'visitas',
  {
    id: serial('id').primaryKey(),
    fecha: date('fecha').notNull(),
    hora: time('hora'),
    estado: varchar('estado', { length: 40 }).notNull().default('creada'),
    costo: integer('costo').notNull().default(0),
    idPaciente: integer('id_paciente'),
    idEnfermera: integer('id_enfermera'),
    idLaboratorio: integer('id_laboratorio'),
    numeroBoleta: varchar('numero_boleta', { length: 20 }).default(''),
    tipoDocumento: varchar('tipo_documento', { length: 20 }).default(''),
    numeroAtencion: integer('numero_atencion').notNull().default(0),
    origenContacto: varchar('origen_contacto', { length: 100 }),
    informacionAdicional: text('informacion_adicional').default(''),
    pagado: boolean('pagado').notNull().default(false),
    metodoPago: varchar('metodo_pago', { length: 30 }),
    fechaPago: date('fecha_pago'),
    resultadosEnviados: boolean('resultados_enviados').notNull().default(false),
    fechaEnvioResultados: date('fecha_envio_resultados'),
    costoTraslado: integer('costo_traslado').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.idPaciente], foreignColumns: [patients.id] })
      .onDelete('cascade'),
    foreignKey({ columns: [table.idEnfermera], foreignColumns: [nurses.id] })
      .onDelete('restrict'),
    foreignKey({ columns: [table.idLaboratorio], foreignColumns: [laboratories.id] })
      .onDelete('restrict'),
    index('visitas_fecha_idx').on(table.fecha),
    index('visitas_estado_idx').on(table.estado),
  ]
)

// ============================================================================
// 15. ProcedimientoVisita - Procedimientos realizados en una visita
// ============================================================================
export const visitProcedures = pgTable(
  'procedimientos_visitas',
  {
    id: serial('id').primaryKey(),
    idProcedimiento: integer('id_procedimiento').notNull(),
    idVisita: integer('id_visita').notNull(),
    precio: integer('precio').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.idProcedimiento], foreignColumns: [procedures.id] })
      .onDelete('restrict'),
    foreignKey({ columns: [table.idVisita], foreignColumns: [visits.id] })
      .onDelete('cascade'),
    index('procedimientos_visitas_id_visita_idx').on(table.idVisita),
  ]
)

// ============================================================================
// 16. ExamenVisita - Exámenes solicitados en una visita
// ============================================================================
export const visitExams = pgTable(
  'examenes_visitas',
  {
    id: serial('id').primaryKey(),
    idExamen: integer('id_examen').notNull(),
    idVisita: integer('id_visita').notNull(),
    precio: integer('precio').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.idExamen], foreignColumns: [exams.id] })
      .onDelete('restrict'),
    foreignKey({ columns: [table.idVisita], foreignColumns: [visits.id] })
      .onDelete('cascade'),
    index('examenes_visitas_id_visita_idx').on(table.idVisita),
  ]
)

// ============================================================================
// 17. PreciosExamenes - Precios por examen, previsión y comuna
// ============================================================================
export const examPrices = pgTable(
  'precios_examenes',
  {
    id: serial('id').primaryKey(),
    idExamen: integer('id_examen').notNull(),
    tipoPrevision: varchar('tipo_prevision', { length: 20 }).notNull(), // 'fonasa'|'isapre'|'particular'
    comuna: varchar('comuna', { length: 200 }),                         // null = aplica a todas
    precio: integer('precio').notNull(),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.idExamen], foreignColumns: [exams.id] })
      .onDelete('cascade'),
    index('precios_examenes_examen_prevision_idx').on(table.idExamen, table.tipoPrevision, table.comuna),
  ]
)

// ============================================================================
// 18. PreciosVisitaEnfermeria - Precio de visita de enfermería por comuna
// ============================================================================
export const nursingVisitPrices = pgTable(
  'precios_visita_enfermeria',
  {
    id: serial('id').primaryKey(),
    comuna: varchar('comuna', { length: 200 }), // null = precio base
    precio: integer('precio').notNull(),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('precios_visita_enfermeria_comuna_idx').on(table.comuna),
  ]
)
