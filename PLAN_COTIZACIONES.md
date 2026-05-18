# Plan: Desacoplar Cotizacion de Visita

## Context

Actualmente la cotizacion es un **objeto derivado/computado** a partir de una visita existente. No tiene tabla propia en la DB - se construye en runtime via `getCotizacionVisita(idVisita)` leyendo datos de `visits`, `visitProcedures`, `visitExams`, `patients`, `addresses`, etc.

El objetivo es que la cotizacion sea una entidad independiente que:
- Pueda existir sin paciente ni visita
- Tenga su propia lista de procedimientos y examenes (identico que visita)
- Permita cobrar visita (seleccionando comuna manualmente, dado que no se puede derivar de la direccion del paciente)
- Permita cobrar recargo (identico que visita)
- Opcionalmente almacene datos de contacto del destinatario cuando no hay paciente asociado
- Eventualmente pueda convertirse en una visita

**Opcion elegida: Opcion 2** - Cotizacion como entidad independiente. No se toca el modelo de visitas. Al convertir cotizacion a visita se usa un adaptador que copia los datos.

---

## Modelo de Datos

```
cotizaciones (nueva tabla)
├── id, estado (borrador/enviada/aceptada/convertida)
├── idPaciente (nullable)
├── nombreDestinatario, emailDestinatario, telefonoDestinatario, identificacionDestinatario (todos opcionales, para cuando no hay paciente)
├── comuna (string, para calcular precio visita)
├── cobraVisita (boolean)
├── montoRecargo, idTipoRecargo
├── total (calculado)
├── idVisita (nullable - se llena cuando se convierte)
└── notas

cotizacion_examenes (nueva tabla)
├── idCotizacion (FK)
├── idExamen (FK)
├── descripcion, codigo, precio (snapshot)

cotizacion_procedimientos (nueva tabla)
├── idCotizacion (FK)
├── idProcedimiento (FK)
├── descripcion, codigo, precio (snapshot)

visitas (SIN CAMBIOS)
└── Mantiene su estructura actual intacta
```

---

## Plan de Implementacion

### 1. Schema - Nueva migracion

**Archivo:** `src/db/schema.ts` + nueva migracion SQL

```sql
CREATE TABLE cotizaciones (
  id SERIAL PRIMARY KEY,
  estado VARCHAR(20) DEFAULT 'borrador', -- borrador, enviada, aceptada, convertida
  id_paciente INTEGER REFERENCES pacientes(id),  -- nullable
  -- Datos manuales del destinatario (opcionales, para cuando no hay paciente)
  nombre_destinatario VARCHAR(255),
  email_destinatario VARCHAR(255),
  telefono_destinatario VARCHAR(50),
  identificacion_destinatario VARCHAR(50),
  comuna VARCHAR(100),  -- manual, independiente del paciente
  cobra_visita BOOLEAN DEFAULT false,
  monto_recargo INTEGER DEFAULT 0,
  id_tipo_recargo INTEGER REFERENCES tipos_recargos(id),
  total INTEGER DEFAULT 0,
  id_visita INTEGER REFERENCES visitas(id),  -- se llena al convertir
  notas TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cotizacion_examenes (
  id SERIAL PRIMARY KEY,
  id_cotizacion INTEGER NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  id_examen INTEGER NOT NULL REFERENCES examenes(id),
  descripcion VARCHAR(255) NOT NULL,
  codigo VARCHAR(50),
  precio INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE cotizacion_procedimientos (
  id SERIAL PRIMARY KEY,
  id_cotizacion INTEGER NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  id_procedimiento INTEGER NOT NULL REFERENCES procedimientos(id),
  descripcion VARCHAR(255) NOT NULL,
  codigo VARCHAR(50),
  precio INTEGER NOT NULL DEFAULT 0
);
```

### 2. Drizzle Schema

**Archivo:** `src/db/schema.ts` - agregar tablas `cotizaciones`, `cotizacionExamenes`, `cotizacionProcedimientos`

Seguir las convenciones existentes del archivo (ver como estan definidas `visits`, `visitProcedures`, `visitExams` y replicar el patron).

### 3. Actions

**Nuevo archivo:** `src/lib/actions/cotizaciones.ts`
- `createCotizacion(formData)` - crear cotizacion
- `updateCotizacion(formData)` - editar
- `getCotizacion(id)` - obtener con examenes y procedimientos
- `listCotizaciones(filters)` - listar
- `deleteCotizacion(id)` - eliminar (solo borrador)
- `convertirCotizacionAVisita(idCotizacion)` - el adaptador que:
  1. Crea la visita con los datos de la cotizacion
  2. Copia examenes a `visitExams` y procedimientos a `visitProcedures`
  3. Marca la cotizacion como "convertida" y guarda `idVisita`

### 4. Pricing

**Reutilizar:** `getPrecioVisitaEnfermeria(comuna)` de `src/lib/pricing/visitas.ts`
- Ya soporta buscar precio por comuna directamente

**Nueva funcion:** `calcularTotalCotizacion(cotizacion)` - suma items + visita + recargo

### 5. UI

**Nuevas paginas:**
- `src/app/(admin)/cotizaciones/page.tsx` - listado
- `src/app/(admin)/cotizaciones/nueva/page.tsx` - formulario nueva cotizacion
- `src/app/(admin)/cotizaciones/[id]/page.tsx` - detalle/edicion

**Nuevo componente:**
- `src/components/cotizacion-form.tsx` - formulario (similar a visita-form pero sin campos de paciente obligatorio)
  - Selector de paciente opcional. Si no se selecciona paciente, se muestran campos manuales opcionales:
    - Nombre del destinatario
    - Correo electronico
    - Telefono
    - Identificacion
  - Estos campos se ocultan si se selecciona un paciente (se usan los datos del paciente)
  - Selector de comuna: se auto-rellena desde la direccion del paciente si hay uno seleccionado, siempre editable manualmente
  - Lista de examenes y procedimientos (agregar/quitar, con precios del catalogo)
  - Toggle cobrar visita
  - Recargo: monto + tipo de recargo (identico a visita-form)
  - Preview de costo total

**Nuevo endpoint API:**
- `src/app/api/cotizacion-standalone/[id]/route.ts` - HTML para imprimir cotizacion standalone

### 6. Flujo "Convertir a Visita"

La conversion NO crea la visita directamente - redirige al form de visita con datos pre-rellenados via query params.

**Caso A: cotizacion con paciente (`idPaciente` presente)**
- Boton "Crear Visita" redirige a `/visitas/nueva?cotizacion={id}`
- La pagina de nueva visita lee el query param, fetcha `getCotizacion(id)` y pre-rellena el form

**Caso B: cotizacion sin paciente**
- Boton "Crear Visita" abre un combobox/autocomplete para seleccionar paciente (el ejecutivo debe haber creado el paciente previamente)
- Al seleccionar paciente, redirige a `/visitas/nueva?cotizacion={id}&paciente={idPaciente}`

**En ambos casos el form de visita pre-rellena:**
- Examenes (de `cotizacion_examenes`)
- Procedimientos (de `cotizacion_procedimientos`)
- `cobraVisita`, `montoRecargo`, `idTipoRecargo`

**La cotizacion se marca como "convertida"** (y se guarda `idVisita`) cuando el usuario guarda exitosamente la visita desde el form, pasando el `idCotizacion` como campo oculto.

**Archivo a modificar:** `src/app/(admin)/visitas/nueva/page.tsx` y `src/components/visita-form.tsx` — leer query param `cotizacion` para pre-rellenar datos.

### 7. Gestion de Estado

En el detalle de la cotizacion, botones para avanzar el estado:
- `borrador` → boton "Marcar como Enviada"
- `enviada` → boton "Marcar como Aceptada"
- `aceptada` → boton "Crear Visita" (conversion)
- `convertida` → solo lectura, muestra link a la visita generada

Server action: `actualizarEstadoCotizacion(id, nuevoEstado)`

---

## Archivos Criticos a Modificar/Crear

| Archivo | Accion |
|---------|--------|
| `src/db/schema.ts` | Agregar tablas cotizaciones, cotizacion_examenes, cotizacion_procedimientos |
| `drizzle/migrations/XXXX_*.sql` | Nueva migracion |
| `src/lib/actions/cotizaciones.ts` | NUEVO - CRUD + actualizarEstado |
| `src/lib/pricing/visitas.ts` | Reutilizar `getPrecioVisitaEnfermeria` |
| `src/components/cotizacion-form.tsx` | NUEVO - formulario |
| `src/app/(admin)/cotizaciones/page.tsx` | NUEVO - listado |
| `src/app/(admin)/cotizaciones/nueva/page.tsx` | NUEVO - crear |
| `src/app/(admin)/cotizaciones/[id]/page.tsx` | NUEVO - detalle + botones de estado |
| `src/app/api/cotizacion-standalone/[id]/route.ts` | NUEVO - HTML print |
| `src/app/(admin)/visitas/nueva/page.tsx` | MODIFICAR - leer query param cotizacion para pre-rellenar |
| `src/components/visita-form.tsx` | MODIFICAR - aceptar initialData desde cotizacion, campo oculto idCotizacion |
| `src/components/sidebar.tsx` | MODIFICAR - agregar link a /cotizaciones |

## Archivos existentes de referencia (replicar patrones)

| Archivo | Para que consultarlo |
|---------|---------------------|
| `src/db/schema.ts` | Convenciones Drizzle, ver `visits`, `visitProcedures`, `visitExams`, `surchargeTypes` |
| `src/components/visita-form.tsx` | Patron de formulario, seleccion de examenes/procedimientos, recargos, preview de costo |
| `src/lib/actions/visitas.ts` | Patron de server actions, validacion, FormData |
| `src/lib/actions/precios.ts` | Tipo `CotizacionVisita`, funcion `getCotizacionVisita` |
| `src/lib/pricing/visitas.ts` | `getPrecioVisitaEnfermeria(comuna)`, `calcularCostoVisitaPreview` |
| `src/lib/actions/catalogos.ts` | `getTiposRecargosForSelect()` para el dropdown de recargos |
| `src/app/api/cotizacion/[id]/route.ts` | Patron HTML para imprimir cotizacion |

---

## Verificacion

1. Crear cotizacion sin paciente con examenes y procedimientos - verificar calculo de total
2. Crear cotizacion sin paciente ingresando datos manuales (nombre, email, telefono, identificacion) - verificar que se guardan
3. Verificar que los campos manuales se ocultan al seleccionar un paciente
4. Crear cotizacion con paciente - verificar que toma datos del paciente
5. Seleccionar comuna manual - verificar precio de visita correcto
6. Agregar recargo - verificar total incluye recargo
7. Convertir cotizacion a visita - verificar que la visita queda con todos los datos
8. Verificar que el flujo de crear visita directamente sigue funcionando sin cambios
9. Imprimir cotizacion standalone - verificar HTML correcto
