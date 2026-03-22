# Homelab: Especificación de Funcionalidades

**Fecha:** 2026-03-22
**Estado:** Documentación validada con cliente
**Objetivo:** Detalle completo de funcionalidades para implementación en Next.js + PostgreSQL + Drizzle

---

## TABLA DE CONTENIDOS

1. [Dominio: PACIENTES](#dominio-pacientes)
2. [Dominio: VISITAS](#dominio-visitas)
3. [Dominio: ENFERMERAS](#dominio-enfermeras)
4. [Dominio: ASIGNACIÓN DE VISITAS](#dominio-asignación-de-visitas)
5. [Dominio: COMUNICACIÓN (EMAILS)](#dominio-comunicación-emails)
6. [Dominio: REPORTES](#dominio-reportes)
7. [Dominio: LABORATORIOS Y CLÍNICAS](#dominio-laboratorios-y-clínicas)
8. [Dominio: CATÁLOGOS](#dominio-catálogos)
9. [Dominio: BÚSQUEDAS Y FILTROS](#dominio-búsquedas-y-filtros)
10. [Dominio: SEGURIDAD Y AUDITORÍA](#dominio-seguridad-y-auditoría)
11. [Eliminaciones y Cambios](#eliminaciones-y-cambios)

---

## DOMINIO: PACIENTES

### 1.1 Gestión de Pacientes (CRUD)

**Estado:** Se mantiene igual al sistema actual

#### Funcionalidades

**Crear Paciente**
- Pantalla de creación con formulario
- Campos:
  - Identificador (RUT o Pasaporte) - obligatorio
  - Nombres - obligatorio
  - Apellido paterno - obligatorio
  - Apellido materno - opcional
  - Fecha de nacimiento - obligatorio
  - Correo electrónico - opcional
  - Dirección - obligatorio (se parsea con Google Maps API)
  - Información adicional - texto largo, opcional
  - Previsión de salud (FK → PrevisionSalud) - opcional
  - Residencia de adulto mayor (FK → ResidenciaAdultoMayor) - opcional

**Validaciones en Identificador**
- RUT chileno: Validar formato y estructura en frontend
  - Formato: XX.XXX.XXX-K (donde K es dígito o letra)
  - Validar dígito verificador (algoritmo oficial)
  - Debe ser único en BD
- Pasaporte:
  - Solo validar que sea alfanumérico (sin caracteres especiales) y largo entre 8 a 16 (guardar en uppercase)
  - Debe ser único en BD

**Editar Paciente**
- Modificar todos los campos (excepto rut/pasaporte)
- Validaciones iguales a creación

**Listar Pacientes**
- Tabla con: Identificador, Nombres, Apellidos (evaluar si es bueno crear un gin index o computarlo on the fly para buscar por parciales de nombres, apellidos)
- Filtros: Por identificador, por apellido, por previsión

**Búsqueda de Paciente**
- Por identificador (RUT/Pasaporte) para crear visita
- Respuesta: Datos completos editables si existe

#### Direcciones

**Parseo de Google Maps API**
- Usuario ingresa dirección libre
- Sistema consulta Google Places API
- Se extraen automáticamente:
  - Número (house_number)
  - Calle (route)
  - Localidad/Comuna (locality)
  - Área administrativa 1 (administrative_area_level_1) = Región
  - Área administrativa 2 (administrative_area_level_2) = Provincia
  - Área administrativa 3 (administrative_area_level_3) = Comuna alternativa
  - País
  - Latitud/Longitud (para mostrar en mapa)
- Usuario puede agregar información adicional (depto, piso, descripción)

#### Teléfonos

**Múltiples Teléfonos por Paciente**
- Un paciente puede tener N teléfonos
- Cada teléfono tiene: número y descripción (opcional: "Casa", "Celular", "Trabajo")
- Crear/editar/eliminar teléfonos en la pantalla de paciente (y por extensión en la de visita)

#### Contacto de Emergencia

**Un Contacto por Paciente**
- Nombre: obligatorio
- Teléfono: opcional
- Información adicional: opcional
- Se crea/edita junto con el paciente
- Se elimina con el paciente

* evaluar si es necesario tenerlo normalizado, podría ser en la misma tabla
---

## DOMINIO: VISITAS

### 2.1 Gestión de Visitas (CRUD)

**Estado:** Se mantiene igual al sistema actual

#### Flujo de Creación

1. **Búsqueda de Paciente**
   - Usuario ingresa RUT/Pasaporte
   - Sistema busca en BD
   - Resultado: paciente encontrado o no

2. **Si No Existe**
   - Redirigir a creación de nuevo paciente + visita en una pantalla

3. **Si Existe**
   - Redirigir a formulario de visita con paciente pre-cargado y editable

#### Crear Visita

**Datos de Visita:**
- Fecha - obligatorio
- Hora - opcional
- Enfermera (FK → Enfermera) - opcional
- Laboratorio/Clínica (FK → LaboratoryOffice) - opcional
- Información adicional - texto largo, opcional

**Procedimientos en Visita:**
- Tabla donde agregar N procedimientos
- Para cada procedimiento: seleccionar de catálogo
- Eliminar procedimientos anteriormente asociados a la visita (si existen) antes de guardar para simplificar flujo (no es necesario hacer updates)

**Exámenes en Visita:**
- Tabla donde agregar N exámenes
- Para cada examen: seleccionar de catálogo
- Eliminar exámenes anteriormente asociados a la visita (si existen) antes de guardar para simplificar flujo (no es necesario hacer updates)

**Opcionalidad de Asignación:**
- Al crear, puedo dejar sin asignar enfermera
- O asignar directamente en el momento de creación

**Guardado:**
- Crea registro Visit con estado `creada`
- Crea registros de VisitMedicalProcedure (N registros)
- Crea registros de VisitMedicalExam (N registros)
- Auditoría: registra quién creó y cuándo

#### Editar Visita

**Restricción de Estado:**
- Solo editable si estado = `creada`
- Si está en `completada` o `cancelada` → no se puede editar
- Mensaje claro al usuario

**Campos Editables (si estado = creada):**
- Fecha, hora, enfermera, laboratorio, procedimientos, exámenes, método contacto, numero boleta, costo, información adicional
- Auditoría: registra quién cambió y cuándo

#### Ver Detalles de Visita

- Mostrar: paciente, enfermera, fecha, hora, estado
- Procedimientos y exámenes realizados
- Información adicional
- Historial de cambios (auditoría)

#### Cerrar Visita

**Transición:** creada → completada

- Pantalla de cierre con campos adicionales:
  - Número de boleta - texto, obligatorio en este cambio de estado (todas las completadas deben quedar con número de boleta)
  - Tipo de documento - select (Boleta / Factura), opcional
  - Costo - número, opcional
  - Observaciones finales - texto, opcional

- Auditoría: registra quién cerró, cuándo.

#### Cancelar Visita

**Transición:** creada → cancelada

- Requiere motivo de cancelación - obligatorio
- Auditoría: registra quién canceló, cuándo, motivo

#### Reabrir Visita

**Transición:** completada → creada O cancelada → creada

- **Solo Admin puede hacer esto**
- Motivo de reapertura - obligatorio
- Requiere confirmación (modal)
- Auditoría: registra quién reabrió, cuándo, motivo

#### Listar Visitas

- Tabla con: Fecha, Paciente, Enfermera, Estado, Acciones
- Filtros: Por fecha (rango), estado, enfermera
- Ordenamiento: Por fecha (descendente por defecto)
- Paginación: 20-50 registros por página

#### Búsqueda Rápida

- Campo de búsqueda que filtra por:
  - Nombre de paciente
  - RUT/Pasaporte de paciente
  - Nombre de enfermera
  - ~~Aplicación en tiempo real (debounce 300ms)~~ con botón de buscar para evitar sobrecargas innecesarias en BD 

---

## DOMINIO: ENFERMERAS

### 3.1 Gestión de Enfermeras

**Estado:** Se mantiene igual, pero con ELIMINACIONES

#### Cambios Respecto a Sistema Anterior

- ❌ **Eliminar:** Asignación de áreas geográficas (Ya no se usa)
- ❌ **Eliminar:** Asignación de competencias/procedimientos que puede realizar
- ✅ **Mantener:** CRUD básico de enfermeras
- ✅ **Mantener:** Información de contacto

**Motivo:** Todas las enfermeras pueden realizar cualquier procedimiento/examen. No se requiere asignación.

#### Crear Enfermera

**Campos:**
- Nombres - obligatorio
- Apellido paterno - obligatorio
- Apellido materno - opcional
- RUT - opcional
- Teléfono - opcional
- Correo electrónico - opcional (para envío de programación)
- Activa - booleano, default true (esto permite que se dejen de mostrar en las distintas secciones del sistema)

#### Editar Enfermera

- Cambiar cualquier campo
- Auditoría: registra cambios

#### Eliminar Enfermera

- No eliminar si tiene visitas asignadas
- Mensaje: "No se puede eliminar porque tiene X visitas asignadas"

#### Listar Enfermeras

- Tabla: Nombres, Apellido, Teléfono, Correo, Activa
- Ordenamiento: apellido_paterno, apellido_materno, nombres
- Filtro: Mostrar/ocultar inactivas

#### Desactivar Enfermera

- Toggle en listado o en detalle
- No elimina, solo marca como inactiva
- Las inactivas no aparecen en selectores de asignación

---

## DOMINIO: ASIGNACIÓN DE VISITAS

### 4.1 Asignación de Enfermeras a Visitas

**Estado:** Mejoras de UX manteniendo lógica

#### Flujo Principal

1. **Ver Visitas sin Asignar**
   - Listado de todas las visitas en estado `creada` sin enfermera asignada
   - Mostrar: Fecha, Hora, Paciente, Dirección, Procedimientos

2. **Asignar: Drag & Drop**
   - Vista de dos columnas o cartas:
     - Izquierda: Visitas sin asignar
     - Derecha: Enfermeras (agrupadas o en filas)
   - Draggear visita sobre enfermera para asignar
   - Guardar cambios (botón "Guardar")
   - Feedback visual de arrastre (cursor, highlighting)

3. **Guardar Asignaciones**
   - Actualizar BD con asignaciones
   - Validar que no haya errores
   - Mensaje de éxito
   - Auditoría: registra quién asignó, a qué enfermera, cuándo

4. **Revisar Asignaciones**
   - Pantalla de revisión: tabla con enfermeras y sus visitas del día
   - Por cada enfermera: mostrar visitas (fecha, hora, paciente, dirección)
   - Opción de reasignar (quitar de una, asignar a otra)

5. **Enviar Programación por Email**
   - Después de revisar, botón "Enviar Programación"
   - Se envía email a cada enfermera con sus visitas (ver sección EMAIL)
   - Registro de envío (auditoría)

#### Asignar al Crear Visita

**Alternativa Rápida:**
- Cuando creo una visita, puedo asignar enfermera directamente
- Select de enfermeras en el formulario de creación
- Se guarda asignado (no requiere ir a pantalla de asignación)

#### Reasignar

**En Pantalla de Asignación:**
- Puedo quitar una visita de una enfermera
- Reasignarla a otra (drag & drop nuevamente)
- O dejarla sin asignar para reasignarla después

---

## DOMINIO: COMUNICACIÓN (EMAILS)

### 5.1 Envío de Programación a Enfermeras

**Estado:** Cambio de proveedor (Mailjet → Resend)

#### Especificaciones Técnicas

**Proveedor:** Resend (resend.com)
- API moderna y simple
- Mejor entrega que Mailjet
- Soporte nativo para React Email

**Construcción de Email:** React Email
- Template HTML moderno (basado en React)
- Reutilizable, versionable, testeable
- Componentes para: header, tabla de visitas, footer

**Límite:** Máximo 15 correos diarios

#### Contenido del Email

**Asunto:** "Programación de visitas - [Fecha]"

**Cuerpo:**

1. **Saludo personalizado**
   - "Hola [Nombre de Enfermera],"
   - "Tu programación para [fecha] es la siguiente:"

2. **Tabla de Visitas**
   - Columnas: Hora, Paciente (con RUT), Dirección, Procedimientos, Contacto
   - Filas: Una por visita asignada a esa enfermera
   - Ejemplo:
     ```
     09:00 | Juan Pérez (12.345.678-9) | Avenida 5 #123, Providencia
           | Procedimientos: Toma de muestra, Curación
           | Contacto paciente: +56 9 1234 5678

     11:30 | María López (15.678.234-5) | Calle 10 #456, Las Condes
           | Procedimientos: Inyectable, Curación
           | Contacto paciente: +56 9 9876 5432
     ```

3. **Footer**
   - Logo de Homelab
   - Link a plataforma (si aplica)
   - "¿Duda? Contacta a admin@homelab.cl"

#### Triggers de Envío

**Opción 1: Manual**
- Botón "Enviar Programación" en pantalla de asignación
- Permite seleccionar enfermeras (o enviar a todas)
- Confirmación antes de enviar

**Opción 2: Automático (Futuro)**
- Se puede programar para enviar a las X:00 cada día

#### Registro de Envío

- Auditoría: Registra quién envió, a quién, cuándo
- No requiere confirmación de lectura (fire and forget)

---

## DOMINIO: REPORTES

### 6.1 Reportes

**Estado:** Cambios significativos (eliminación de reportes financieros)

#### Eliminaciones

- ❌ Reportes financieros (completo, gastos mensuales, por agente, etc)
- **Motivo:** Ya no se utilizan

#### Formatos Requeridos

1. **Descarga Excel** - Exportación de datos en .xlsx
2. **Visualización Web/Dashboard** - Tablas interactivas
3. **Gráficos/Charts** - Visualización de datos con recharts

#### Acceso

- **Admin:** Acceso a todos los reportes
- **Usuario:** Acceso a todos los reportes
- **Enfermera/Paciente:** Sin acceso

#### Reporte Implementado

**1. Resumen de Visitas**

**Descripción:** Vista consolidada de todas las visitas en un período, con filtros y exportación a Excel.

**Filtros:**
- Rango de fecha (desde - hasta)
- Estado (creada, completada, cancelada)
- Enfermera (multi-select o individual)

**Columnas en Tabla:**
| Fecha | Hora | Paciente | RUT/Pasaporte | Enfermera | Estado | Procedimientos | Exámenes | Acciones |
|---|---|---|---|---|---|---|---|---|

**Exportación Excel (.xlsx):**
- Incluir todos los filtros aplicados en el nombre del archivo
- Ejemplo: `Visitas_2026-03-01_a_2026-03-31_completadas.xlsx`

**Formatos Disponibles:**
1. **Web/Dashboard:** Tabla interactiva con paginación, ordenamiento
2. **Excel:** Descargar datos en .xlsx
3. **Gráficos:**
   - Pie: Distribución por estado (creada/completada/cancelada)
   - Bar: Visitas por enfermera
   - Line: Visitas por día (tendencia)

---

## DOMINIO: LABORATORIOS Y CLÍNICAS

### 7.1 Gestión de Laboratorios/Clínicas

**Estado:** Simplificación

#### Cambios Respecto a Sistema Anterior

- ✅ **Mantener:** CRUD de Cadenas (Laboratorios/Clínicas)
- ✅ **Mantener:** CRUD de Sucursales
- ❌ **Eliminar:** Gestión de exámenes disponibles por sucursal
- ❌ **Eliminar:** Mapeo de exámenes a sucursales

#### Crear Cadena (Laboratorio/Clínica)

**Campos:**
- Nombre - obligatorio
- Activa - booleano, default true

**Ejemplo:** "Clínica Aconcagua", "Laboratorio Blanco", "Integramédica"

#### Crear Sucursal

**Campos:**
- Nombre - obligatorio
- Cadena (FK → Laboratory) - obligatorio
- Activa - booleano, default true

**Ejemplo:** "Clínica Aconcagua - Providencia", "Laboratorio Blanco - Las Condes"

#### Listar Sucursales

- Agrupadas por cadena
- Display: "{cadena.nombre} - {sucursal.nombre}"
- Filtro: por cadena activa

#### Uso en Visitas

- Al crear visita, seleccionar sucursal (opcional)
- Se usa para registrar dónde se envían las muestras
- Sin validación de qué exámenes se pueden hacer en cada lugar

---

## DOMINIO: CATÁLOGOS

### 8.1 Procedimientos de Enfermería

**Estado:** Se mantiene

#### Estructura

**Campos:**
- Nombre - obligatorio (ej: "Toma de muestra", "Curación", "Inyectable")
- Código - obligatorio (código interno)
- Activo - booleano, default true

#### Operaciones

- CRUD: Crear, listar, editar, inactivar
- Uso: Seleccionar en creación de visita (múltiples por visita)

### 8.2 Exámenes Médicos

**Estado:** Se mantiene

#### Estructura

**Campos:**
- Nombre - obligatorio (ej: "Hemograma", "Glicemia", "Perfil Lipídico")
- Código - obligatorio
- Activo - booleano, default true

#### Operaciones

- CRUD: Crear, listar, editar, inactivar
- Uso: Seleccionar en creación de visita (múltiples por visita)

### 8.3 Previsiones de Salud

**Estado:** Se mantiene

#### Estructura

**Campos:**
- Nombre - obligatorio (ej: "Fonasa", "Banmédica", "Isapre Cruz Blanca")
- Activa - booleano, default true

#### Operaciones

- CRUD: Crear, listar, editar, inactivar
- Uso: Seleccionar en perfil de paciente (opcional)

### 8.4 Residencias de Adulto Mayor

**Estado:** Se mantiene

#### Estructura

**Campos:**
- Nombre - obligatorio
- Activa - booleano, default true

#### Operaciones

- CRUD: Crear, listar, editar, inactivar
- Uso: Seleccionar en perfil de paciente (opcional)

### 8.5 Origen de Contacto

**Estado:** Cambio a ENUM (no tabla)

#### Cambio de Diseño

- **Antes:** Tabla ContactSource (consulta a BD cada vez)
- **Ahora:** ENUM en ScheduledVisit (valores hardcodeados)

#### Valores ENUM

```typescript
enum OriginContact {
  REFERRAL = "Referido",
  WEB = "Web",
  INSTAGRAM = "Instagram",
  MEDICAL_REFERRAL = "Derivación médica",
  WORD_OF_MOUTH = "Recomendación",
  // Agregar más si es necesario
}
```

**Ventajas:**
- Menos consultas a BD
- Menos mantenimiento (los valores son fijos)
- Más performance

#### Uso

- Seleccionar en creación de visita
- Filtrable en búsquedas

### 8.6 Eliminaciones

- ❌ **Suministros/Vacunas** - No se necesita
- ❌ **Métodos de Pago** - No se necesita
- ❌ **Precios** - Ver sección Eliminaciones

---

## DOMINIO: BÚSQUEDAS Y FILTROS

### 9.1 Búsquedas y Filtrados

**Estado:** Se mejoran con filtros avanzados

#### Búsqueda Global

- Campo de búsqueda general (si aplica)
- Búsqueda por RUT/Pasaporte de paciente
- Búsqueda por nombre de paciente (parcial)
- Búsqueda por nombre de enfermera (parcial)

#### Filtros Avanzados en Listados

**En Listado de Visitas:**
- Por rango de fecha (desde - hasta)
- Por estado (creada, completada, cancelada)
- Por enfermera (multi-select)
- Por paciente (si aplica)
- Aplicar/resetear filtros

**En Listado de Pacientes:**
- Por apellido (parcial)
- Por identificador (RUT/Pasaporte)
- Por previsión de salud
- Por residencia

**En Listado de Enfermeras:**
- Por nombre
- Mostrar/ocultar inactivas
- Por teléfono (parcial)

#### Persistencia de Filtros

- Se pueden guardar filtros (opcional, futuro)
- O resetear a filtros por defecto

---

## DOMINIO: SEGURIDAD Y AUDITORÍA

### 10.1 Autenticación

**Estado:** Auth.js v5

#### Sistema

- Credenciales (usuario/contraseña)
- Hash bcrypt para contraseñas
- Sesiones en servidor

#### Gestión de Usuarios

- Crear usuario: nombre, correo, contraseña (y rol)
- Cambiar contraseña
- Resetear contraseña (con email link)

### 10.2 Autorización y Roles

**Roles Disponibles:**
1. **Admin**
   - Acceso total a todo
   - Puede reabrir visitas cerradas/canceladas
   - Puede gestionar usuarios
   - Acceso a reportes

2. **Usuario**
   - Puede crear/editar/cerrar visitas
   - Puede asignar enfermeras
   - Puede gestionar pacientes y enfermeras
   - Acceso a reportes
   - NO puede reabrir visitas

#### Permisos por Acción

| Acción | Admin | Usuario |
|--------|-------|---------|
| Crear paciente | ✓ | ✓ |
| Crear visita | ✓ | ✓ |
| Editar visita (creada) | ✓ | ✓ |
| Cerrar visita | ✓ | ✓ |
| Cancelar visita | ✓ | ✓ |
| **Reabrir visita** | ✓ | ✗ |
| Asignar enfermera | ✓ | ✓ |
| Crear enfermera | ✓ | ✓ |
| Ver reportes | ✓ | ✓ |
| Ver auditoría | ✓ | ✓ |

### 10.3 Auditoría

**Registro de Cambios:**
- Quién realizó la acción (usuario.id + nombre)
- Cuándo se realizó (timestamp)
- Qué acción (crear, editar, cerrar, asignar, etc)
- Qué se cambió (opcional: detalles)
- En qué entidad (Paciente, Visita, Enfermera, etc)

**Entidades Auditadas:**
- Creación de pacientes
- Cambios en pacientes
- Creación de visitas
- Edición de visitas
- Cierre de visitas
- Cancelación de visitas
- Reapertura de visitas
- Asignación de enfermeras
- Envío de emails
- Cambios en enfermeras
- Cambios en catálogos

**Acceso a Auditoría:**
- Pantalla de auditoría (Admin y Usuario)
- Mostrar: Usuario, Acción, Entidad, Cambios, Timestamp
- Filtros: Por usuario, por entidad, por rango de fecha

---

## ELIMINACIONES Y CAMBIOS

### ❌ Funcionalidades Eliminadas

| Funcionalidad | Razón |
|---|---|
| Asignación de áreas a enfermeras | Ya no se usa |
| Asignación de competencias a enfermeras | Todas pueden hacer todo |
| Gestión de precios (compra/venta) | No se trackea costo |
| Catálogo de suministros/vacunas | No se necesita |
| Catálogo de métodos de pago | No se necesita |
| Exámenes disponibles por sucursal | Se simplifica |
| Gastos mensuales y reportes financieros | Ya no se usan |
| Almacenamiento de archivos/documentos | No se requiere |
| Notificaciones en-app | Solo email basta |
| SMS/Push notifications | Solo email basta |

### ✅ Cambios Principales

| Sistema | Cambio | Razón |
|---|---|---|
| Email | Mailjet → Resend | API más moderna y simple |
| Email Template | HTML manual → React Email | Mejor mantenibilidad |
| OrigenContacto | Tabla → ENUM | Menos consultas a BD |
| Auditoría | No existe → Implementar básica | Compliance y trazabilidad |
| Filtros | Básicos → Avanzados | Mejor usabilidad |

### ⚠️ Validaciones Nuevas

| Campo | Validación Nueva |
|---|---|
| Identificador (RUT/Pasaporte) | Formato RUT chileno validado en app |
| RUT | Dígito verificador |
| Pasaporte | Solo validar existencia |

---

## TABLA DE CAMBIOS A BD

### Modelos a MANTENER de PLAN_MIGRACION.md

- Usuario
- Enfermera (Agent)
- Paciente
- Dirección
- Contacto
- TelefonoPaciente
- Procedimiento
- Examen
- Laboratorio
- Sucursal
- PrevisionSalud
- ResidenciaAdultoMayor
- Visita
- ProcedimientoVisita
- ExamenVisita

### Nuevos Campos/Tablas

**Nueva Tabla: Auditoría**
- id
- usuario_id (FK → Usuario)
- entidad (texto: "Paciente", "Visita", "Enfermera", etc)
- accion (texto: "crear", "editar", "cerrar", etc)
- detalles (JSON, opcional)
- created_at

### Modelos a ELIMINAR de PLAN_MIGRACION.md

- ❌ AreaAssignment (asignación de áreas)
- ❌ AreaAssignment tabla entera
- ❌ FeasibleMedicalExam (exámenes por sucursal)
- ❌ MedicalSupply (suministros)
- ❌ AgentMedicalProcedures (competencias)
- ❌ PricingDefinition y todas las tablas de precios
- ❌ PaymentMethod
- ❌ MonthlyExpense
- ❌ ContactSource (→ ENUM en lugar)

---

## PRÓXIMOS PASOS

1. **Validación Final** con cliente sobre detalles faltantes
2. **Diseño de Reportes** - Definir exactamente qué reportes se necesitan
3. **Diseño de UI/UX** - Mockups de pantallas principales
4. **Planificación de Sprints** - Orden de implementación
5. **Setup del Stack** - Configurar Next.js + Drizzle + Auth.js

---

## NOTAS IMPORTANTES

- Este documento es **versión 1.0** y será actualizado con feedback del cliente
- Las fechas de timestamp usan `created_at` y `updated_at` (no `fecha_creacion`)
- Todos los IDs son enteros con autoincrement (o UUID según decisión)
- Respeti
n convención snake_case en BD, camelCase en aplicación TypeScript
- Google Maps API key está configurada en variables de entorno
- Resend API key para emails también en variables de entorno
