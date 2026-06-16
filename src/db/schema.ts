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
    serieDocumento: varchar('serie_documento', { length: 20 }),
    nombres: varchar('nombres', { length: 200 }).notNull(),
    apellidoPaterno: varchar('apellido_paterno', { length: 200 }).default(''),
    apellidoMaterno: varchar('apellido_materno', { length: 200 }).default(''),
    fechaNacimiento: date('fecha_nacimiento'),
    correo: varchar('correo', { length: 100 }),
    informacionAdicional: text('informacion_adicional'),
    keyIdentificacion: varchar('key_identificacion', { length: 500 }),
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
    grupoExamen: varchar('grupo_examen', { length: 50 }).notNull().default('imalab'),
    precio: integer('precio').notNull().default(0),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('examenes_codigo_idx').on(table.codigo),
    uniqueIndex('examenes_nombre_codigo_grupo_idx').on(table.nombre, table.codigo, table.grupoExamen),
  ]
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
// 13b. TipoRecargo - Catálogo de tipos de recargos excepcionales
// ============================================================================
export const surchargeTypes = pgTable(
  'tipos_recargos',
  {
    id: serial('id').primaryKey(),
    nombre: varchar('nombre', { length: 200 }).notNull(),
    precio: integer('precio').notNull().default(0),
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
    estado: varchar('estado', { length: 40 }).notNull().default('programada'),
    costo: integer('costo').notNull().default(0),
    idPaciente: integer('id_paciente'),
    idEnfermera: integer('id_enfermera'),
    numeroBoleta: varchar('numero_boleta', { length: 20 }).default(''),
    tipoDocumento: varchar('tipo_documento', { length: 20 }).default(''),
    numeroAtencion: integer('numero_atencion'),
    origenContacto: varchar('origen_contacto', { length: 100 }),
    informacionAdicional: text('informacion_adicional').default(''),
    pagado: boolean('pagado').notNull().default(false),
    metodoPago: varchar('metodo_pago', { length: 30 }),
    fechaPago: date('fecha_pago'),
    resultadosEnviadosCount: integer('resultados_enviados_count').notNull().default(0),
    resultadosTotalCount: integer('resultados_total_count').notNull().default(0),
    costoTraslado: integer('costo_traslado').notNull().default(0),
    conceptoNoRealizada: text('concepto_no_realizada'),
    motivoCancelacion: text('motivo_cancelacion'),
    cobraVisita: boolean('cobra_visita').notNull().default(false),
    keyOrdenMedica: varchar('key_orden_medica', { length: 500 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.idPaciente], foreignColumns: [patients.id] })
      .onDelete('cascade'),
    foreignKey({ columns: [table.idEnfermera], foreignColumns: [nurses.id] })
      .onDelete('restrict'),
    index('visitas_fecha_idx').on(table.fecha),
    index('visitas_estado_idx').on(table.estado),
    uniqueIndex('visitas_numero_atencion_idx').on(table.numeroAtencion).where(sql`${table.numeroAtencion} IS NOT NULL`),
    uniqueIndex('visitas_numero_boleta_tipo_doc_idx').on(table.numeroBoleta, table.tipoDocumento).where(sql`${table.numeroBoleta} IS NOT NULL AND ${table.numeroBoleta} != ''`),
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

// ============================================================================
// 19. Cotizacion - Cotización independiente (puede convertirse en visita)
// ============================================================================
export const quotations = pgTable(
  'cotizaciones',
  {
    id: serial('id').primaryKey(),
    estado: varchar('estado', { length: 20 }).notNull().default('creada'), // creada, enviada, aceptada, rechazada
    idPaciente: integer('id_paciente'),
    nombreDestinatario: varchar('nombre_destinatario', { length: 255 }),
    emailDestinatario: varchar('email_destinatario', { length: 255 }),
    telefonoDestinatario: varchar('telefono_destinatario', { length: 50 }),
    identificacionDestinatario: varchar('identificacion_destinatario', { length: 50 }),
    comuna: varchar('comuna', { length: 100 }),
    cobraVisita: boolean('cobra_visita').notNull().default(false),
    total: integer('total').default(0),
    idVisita: integer('id_visita'),
    notas: text('notas'),
    motivoRechazo: text('motivo_rechazo'),
    fechaEnvio: timestamp('fecha_envio'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.idPaciente], foreignColumns: [patients.id] })
      .onDelete('set null'),
    foreignKey({ columns: [table.idVisita], foreignColumns: [visits.id] })
      .onDelete('set null'),
    index('cotizaciones_estado_idx').on(table.estado),
    index('cotizaciones_id_paciente_idx').on(table.idPaciente),
  ]
)

// ============================================================================
// 20. CotizacionExamen - Exámenes en una cotización
// ============================================================================
export const quotationExams = pgTable(
  'cotizacion_examenes',
  {
    id: serial('id').primaryKey(),
    idCotizacion: integer('id_cotizacion').notNull(),
    idExamen: integer('id_examen').notNull(),
    descripcion: varchar('descripcion', { length: 255 }).notNull(),
    codigo: varchar('codigo', { length: 50 }),
    precio: integer('precio').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.idCotizacion], foreignColumns: [quotations.id] })
      .onDelete('cascade'),
    foreignKey({ columns: [table.idExamen], foreignColumns: [exams.id] })
      .onDelete('restrict'),
    index('cotizacion_examenes_id_cotizacion_idx').on(table.idCotizacion),
  ]
)

// ============================================================================
// 17. Taller - Catálogo de talleres
// ============================================================================
export const workshops = pgTable(
  'talleres',
  {
    id: serial('id').primaryKey(),
    nombre: varchar('nombre', { length: 200 }).notNull(),
    codigo: varchar('codigo', { length: 50 }).notNull(),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('talleres_codigo_idx').on(table.codigo),
  ]
)

// ============================================================================
// 17b. TallerVisita - Talleres en una visita (precio libre)
// ============================================================================
export const visitWorkshops = pgTable(
  'talleres_visitas',
  {
    id: serial('id').primaryKey(),
    idTaller: integer('id_taller').notNull(),
    idVisita: integer('id_visita').notNull(),
    precio: integer('precio').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.idTaller], foreignColumns: [workshops.id] })
      .onDelete('restrict'),
    foreignKey({ columns: [table.idVisita], foreignColumns: [visits.id] })
      .onDelete('cascade'),
    index('talleres_visitas_id_visita_idx').on(table.idVisita),
  ]
)

// ============================================================================
// 17c. RecargoVisita - Recargos aplicados a una visita
// ============================================================================
export const visitSurcharges = pgTable(
  'recargos_visitas',
  {
    id: serial('id').primaryKey(),
    idTipoRecargo: integer('id_tipo_recargo').notNull(),
    idVisita: integer('id_visita').notNull(),
    precio: integer('precio').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.idTipoRecargo], foreignColumns: [surchargeTypes.id] })
      .onDelete('restrict'),
    foreignKey({ columns: [table.idVisita], foreignColumns: [visits.id] })
      .onDelete('cascade'),
    index('recargos_visitas_id_visita_idx').on(table.idVisita),
  ]
)

// ============================================================================
// 21. CotizacionProcedimiento - Procedimientos en una cotización
// ============================================================================
export const quotationProcedures = pgTable(
  'cotizacion_procedimientos',
  {
    id: serial('id').primaryKey(),
    idCotizacion: integer('id_cotizacion').notNull(),
    idProcedimiento: integer('id_procedimiento').notNull(),
    descripcion: varchar('descripcion', { length: 255 }).notNull(),
    codigo: varchar('codigo', { length: 50 }),
    precio: integer('precio').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.idCotizacion], foreignColumns: [quotations.id] })
      .onDelete('cascade'),
    foreignKey({ columns: [table.idProcedimiento], foreignColumns: [procedures.id] })
      .onDelete('restrict'),
    index('cotizacion_procedimientos_id_cotizacion_idx').on(table.idCotizacion),
  ]
)

// ============================================================================
// 22b. CotizacionRecargo - Recargos en una cotización
// ============================================================================
export const quotationSurcharges = pgTable(
  'cotizacion_recargos',
  {
    id: serial('id').primaryKey(),
    idTipoRecargo: integer('id_tipo_recargo').notNull(),
    idCotizacion: integer('id_cotizacion').notNull(),
    precio: integer('precio').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.idTipoRecargo], foreignColumns: [surchargeTypes.id] })
      .onDelete('restrict'),
    foreignKey({ columns: [table.idCotizacion], foreignColumns: [quotations.id] })
      .onDelete('cascade'),
    index('cotizacion_recargos_id_cotizacion_idx').on(table.idCotizacion),
  ]
)

// ============================================================================
// 23. ExamenIsapreVisita - Exámenes Imalab-Isapre en una visita (precio manual)
// ============================================================================
export const visitIsapreExams = pgTable(
  'examenes_isapre_visitas',
  {
    id: serial('id').primaryKey(),
    idVisita: integer('id_visita').notNull(),
    idExamen: integer('id_examen').notNull(),
    valorCompleto: integer('valor_completo').notNull().default(0),
    valorPagar: integer('valor_pagar').notNull().default(0),
    idPrevision: integer('id_prevision'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.idVisita], foreignColumns: [visits.id] })
      .onDelete('cascade'),
    foreignKey({ columns: [table.idExamen], foreignColumns: [exams.id] })
      .onDelete('restrict'),
    foreignKey({ columns: [table.idPrevision], foreignColumns: [healthInsurances.id] })
      .onDelete('set null'),
    index('examenes_isapre_visitas_id_visita_idx').on(table.idVisita),
  ]
)

// ============================================================================
// 24. ExamenVisitaResultado - Seguimiento de envío de resultados por examen
// ============================================================================
export const visitExamResults = pgTable(
  'examenes_visitas_resultados',
  {
    id: serial('id').primaryKey(),
    idVisita: integer('id_visita').notNull(),
    idExamen: integer('id_examen').notNull(),
    enviado: boolean('enviado').notNull().default(false),
    fechaEnvio: date('fecha_envio'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.idVisita], foreignColumns: [visits.id] }).onDelete('cascade'),
    foreignKey({ columns: [table.idExamen], foreignColumns: [exams.id] }).onDelete('restrict'),
    uniqueIndex('examenes_visitas_resultados_visita_examen_idx').on(table.idVisita, table.idExamen),
    index('examenes_visitas_resultados_id_visita_idx').on(table.idVisita),
  ]
)

// ============================================================================
// 25. ExamenIsapreCotizacion - Exámenes Imalab-Isapre en una cotización
// ============================================================================
export const quotationIsapreExams = pgTable(
  'examenes_isapre_cotizaciones',
  {
    id: serial('id').primaryKey(),
    idCotizacion: integer('id_cotizacion').notNull(),
    idExamen: integer('id_examen').notNull(),
    descripcion: varchar('descripcion', { length: 255 }).notNull(),
    codigo: varchar('codigo', { length: 50 }),
    valorCompleto: integer('valor_completo').notNull().default(0),
    valorPagar: integer('valor_pagar').notNull().default(0),
    idPrevision: integer('id_prevision'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.idCotizacion], foreignColumns: [quotations.id] })
      .onDelete('cascade'),
    foreignKey({ columns: [table.idExamen], foreignColumns: [exams.id] })
      .onDelete('restrict'),
    foreignKey({ columns: [table.idPrevision], foreignColumns: [healthInsurances.id] })
      .onDelete('set null'),
    index('examenes_isapre_cotizaciones_id_cotizacion_idx').on(table.idCotizacion),
  ]
)

// ============================================================================
// 22. CotizacionTaller - Talleres en una cotización (precio libre)
// ============================================================================
export const quotationWorkshops = pgTable(
  'cotizacion_talleres',
  {
    id: serial('id').primaryKey(),
    idCotizacion: integer('id_cotizacion').notNull(),
    idTaller: integer('id_taller').notNull(),
    descripcion: varchar('descripcion', { length: 255 }).notNull(),
    codigo: varchar('codigo', { length: 50 }),
    precio: integer('precio').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.idCotizacion], foreignColumns: [quotations.id] })
      .onDelete('cascade'),
    foreignKey({ columns: [table.idTaller], foreignColumns: [workshops.id] })
      .onDelete('restrict'),
    index('cotizacion_talleres_id_cotizacion_idx').on(table.idCotizacion),
  ]
)
