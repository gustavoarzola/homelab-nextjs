# Homelab: Plan de Construcción

Sistema de gestión de visitas de enfermería a domicilio.

## Stack

- Next.js 16 + React 19 + TypeScript
- Drizzle ORM + PostgreSQL
- shadcn/ui (Radix + Tailwind 4) + @tanstack/react-table
- sonner, lucide-react, next-themes
- Auth.js v5 (Credentials), zod, exceljs, resend, recharts
- @vis.gl/react-google-maps, @dnd-kit/core, date-fns
- pnpm

---

## Parte 1: Modelos de Datos

Todos los campos usan convención snake_case en al base postgres (en la aplicación usar convenciones typescript). Los modelos están agrupados por dominio.

---

### 1. Usuario

Usuarios del sistema (login y permisos).

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | entero | PK, autoincrement | |
| nombre | texto(200) | requerido | Nombre completo |
| correo | texto(100) | requerido, único | Email para login |
| contrasena | texto(255) | requerido | Hash bcrypt |
| rol | texto(50) | default: "usuario" | "admin" o "usuario" |
| activo | booleano | default: true | |
| created_at | timestamp | auto | |
| updated_at | timestamp | auto-update | |

**Notas:** Solo el rol "admin" puede reabrir visitas cerradas/canceladas.

---

### 2. Enfermera

Profesionales que realizan las visitas a domicilio.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | entero | PK, autoincrement | |
| nombres | texto(200) | requerido | |
| apellido_paterno | texto(200) | requerido | |
| apellido_materno | texto(200) | default: "" | |
| rut | texto(200) | opcional | Documento de identidad |
| telefono | texto(20) | opcional | |
| correo | texto(100) | opcional | Para envío de programación |
| created_at | timestamp | auto | |
| updated_at | timestamp | auto-update | |

**Ordenamiento:** apellido_paterno, apellido_materno, nombres
**Display:** "{apellido_paterno} {nombres}"

---

### 3. Paciente

Personas que reciben atención domiciliaria.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | entero | PK, autoincrement | |
| rut | texto(200) | único, opcional | Documento de identidad |
| nombres | texto(200) | requerido | |
| apellido_paterno | texto(200) | opcional, default: "" | |
| apellido_materno | texto(200) | opcional, default: "" | |
| fecha_nacimiento | fecha | opcional | |
| correo | texto(100) | opcional | |
| informacion_adicional | texto largo | opcional | Notas generales del paciente |
| id_direccion | entero | FK → Direccion | No eliminar dirección si tiene paciente |
| id_compania_seguro | entero | FK → CompaniaSeguro, opcional | |
| id_residencia_adulto | entero | FK → ResidenciaAdultoMayor, opcional | |
| created_at | timestamp | auto | |
| updated_at | timestamp | auto-update | |

**Ordenamiento:** apellido_paterno, apellido_materno, nombres

---

### 4. Direccion

Dirección física del paciente. Los campos se parsean automáticamente desde Google Maps Places API.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | entero | PK, autoincrement | |
| direccion | texto(200) | requerido | Lo que escribe el usuario |
| direccion_formateada | texto(200) | default: "" | Lo que retorna Google Maps |
| numero | texto(20) | opcional | Número de calle |
| calle | texto(200) | opcional | Nombre de calle |
| localidad | texto(200) | opcional | Comuna/localidad |
| area_administrativa_1 | texto(200) | opcional | Región |
| area_administrativa_2 | texto(200) | opcional | Provincia |
| area_administrativa_3 | texto(200) | opcional | Comuna (duplica localidad en Chile) |
| pais | texto(50) | opcional | |
| latitud | decimal(20,18) | opcional | Para mostrar en mapa |
| longitud | decimal(20,18) | opcional | Para mostrar en mapa |
| informacion_adicional | texto largo | opcional | Depto, piso, torre, etc. |
| created_at | timestamp | auto | |
| updated_at | timestamp | auto-update | |

---

### 5. Contacto

Contacto de emergencia del paciente. Un contacto por paciente.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | entero | PK, autoincrement | |
| nombre | texto(50) | requerido | Nombre del contacto |
| telefono | texto(20) | opcional | |
| informacion_adicional | texto largo | opcional | |
| id_paciente | entero | FK → Paciente, único | Un contacto por paciente, se elimina con el paciente |
| created_at | timestamp | auto | |
| updated_at | timestamp | auto-update | |

---

### 6. TelefonoPaciente

Permite múltiples teléfonos por paciente.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | entero | PK, autoincrement | |
| telefono | texto(20) | requerido | |
| descripcion | texto(50) | opcional | Ej: "Casa", "Celular", "Trabajo" |
| id_paciente | entero | FK → Paciente | Se elimina con el paciente |
| created_at | timestamp | auto | |
| updated_at | timestamp | auto-update | |

---

### 7. Procedimiento

Catálogo de procedimientos de enfermería que se pueden realizar en una visita.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | entero | PK, autoincrement | |
| nombre | texto(200) | requerido | Ej: "Toma de muestra", "Curación" |
| codigo | texto(20) | requerido | Código interno |
| activo | booleano | default: true | Para ocultar sin eliminar |
| created_at | timestamp | auto | |
| updated_at | timestamp | auto-update | |

---

### 8. Examen

Catálogo de exámenes médicos que se pueden solicitar en una visita.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | entero | PK, autoincrement | |
| nombre | texto(200) | requerido | Ej: "Hemograma", "Glicemia" |
| codigo | texto(40) | requerido | |
| activo | booleano | default: true | |
| created_at | timestamp | auto | |
| updated_at | timestamp | auto-update | |

---

### 9. Laboratorio

Redes de laboratorios donde se envían muestras.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | entero | PK, autoincrement | |
| nombre | texto(200) | requerido | Ej: "Blanco", "Integramédica" |
| activo | booleano | default: true | |
| created_at | timestamp | auto | |
| updated_at | timestamp | auto-update | |

---

### 10. Sucursal

Sucursales físicas de un laboratorio.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | entero | PK, autoincrement | |
| nombre | texto(100) | requerido | Ej: "Providencia", "Las Condes" |
| id_laboratorio | entero | FK → Laboratorio, opcional | Se elimina con el laboratorio |
| activo | booleano | default: true | |
| created_at | timestamp | auto | |
| updated_at | timestamp | auto-update | |

**Display:** "{laboratorio.nombre} - {nombre}"

---

### 11. PrevisionSalud

Catálogo de previsiones de salud.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | entero | PK, autoincrement | |
| nombre | texto(200) | requerido | Ej: "Fonasa", "Banmédica", "Cruz Blanca" |
| activo | booleano | default: true | |
| created_at | timestamp | auto | |
| updated_at | timestamp | auto-update | |

---

### 12. ResidenciaAdultoMayor

Catálogo de residencias de adulto mayor (algunos pacientes viven en estas).

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | entero | PK, autoincrement | |
| nombre | texto(200) | requerido | |
| activo | booleano | default: true | |
| created_at | timestamp | auto | |
| updated_at | timestamp | auto-update | |

---

### 13. OrigenContacto

Catálogo de cómo llegó el paciente al servicio (esto debe ser un enum configurable del sistema y no una tabla, es innecesario)

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | entero | PK, autoincrement | |
| nombre | texto(100) | requerido | Ej: "Referido", "Web", "Instagram", "Derivación médica" |
| activo | booleano | default: true | |
| created_at | timestamp | auto | |
| updated_at | timestamp | auto-update | |

---


### 14. Visita

Entidad central. Una visita programada a domicilio.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | entero | PK, autoincrement | |
| fecha | fecha | requerido | Fecha de la visita |
| hora | hora | opcional | |
| estado | texto(40) | default: "creada" | "creada", "completada", "cancelada" |
| costo | entero | default: 0 | Costo de la visita |
| id_paciente | entero | FK → Paciente, opcional | Se elimina con el paciente |
| id_enfermera | entero | FK → Enfermera, opcional | No eliminar enfermera si tiene visitas |
| id_sucursal | entero | FK → Sucursal, opcional | Laboratorio donde se envían muestras |
| numero_boleta | texto(20) | opcional, default: "" | |
| tipo_documento | texto(20) | opcional, default: "" | "Boleta" o "Factura" |
| origen_contacto | del enum origenContacto
| informacion_adicional | texto largo | opcional, default: "" | Notas de la visita |
| created_at | timestamp | auto | |
| updated_at | timestamp | auto-update | |

**Estados:**
- `creada` → Visita programada, pendiente de cierre
- `completada` → Visita realizada y cerrada (con costos finales)
- `cancelada` → Visita cancelada

**Transiciones:** creada→completada, creada→canceleda, completada→creada (solo admin), canceleda→creada (solo admin)

---

### 15. ProcedimientoVisita

Procedimientos realizados en una visita.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | entero | PK, autoincrement | |
| id_procedimiento | entero | FK → Procedimiento | No eliminar procedimiento si tiene visitas |
| id_visita | entero | FK → Visita | No eliminar visita si tiene procedimientos |
| created_at | timestamp | auto | |

---

### 16. ExamenVisita

Exámenes solicitados en una visita.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | entero | PK, autoincrement | |
| id_examen | entero | FK → Examen | No eliminar si tiene visitas |
| id_sucursal | entero | FK → Sucursal, opcional | Sucursal específica para este examen |
| id_visita | entero | FK → Visita | No eliminar si tiene exámenes |
| created_at | timestamp | auto | |


---
