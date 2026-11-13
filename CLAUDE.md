# Homelab - Sistema de Gestión de Visitas de Enfermería a Domicilio

## Descripción

Aplicación interna (admin panel) para gestionar visitas de enfermería a domicilio en Chile. Cubre el ciclo completo: registro de pacientes, programación de visitas, asignación de enfermeras, cotizaciones, facturación, envío de correos y dashboard financiero.

No tiene interfaz pública — todo está detrás de autenticación.

---

## Stack Técnico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| Runtime | Node.js >= 24 |
| Lenguaje | TypeScript estricto |
| Package manager | pnpm 9 |
| Base de datos | PostgreSQL (Neon serverless en Vercel, postgres.js local con Docker) |
| ORM | Drizzle ORM 0.45 + drizzle-kit |
| Auth | NextAuth v5 beta (credentials provider, bcryptjs) |
| UI | Tailwind CSS 4, Radix UI primitives, Lucide icons |
| Tablas | @tanstack/react-table 8 (componente genérico `DataTable`) |
| Formularios | Controlados con useState (sin react-hook-form) |
| Notificaciones | Sonner (toast) |
| Tema | HomeLab Design System (`src/app/homelab-tokens.css`), solo modo claro |
| Gráficos | Recharts 3 |
| Fechas | date-fns 4, react-day-picker 9 |
| Email | Resend |
| File storage | Cloudflare R2 (via AWS SDK v3, bucket privado + signed URLs) |
| Mapas | Google Maps (@googlemaps/js-api-loader) |
| Drag & Drop | @dnd-kit/core (asignación de visitas) |
| Excel export | exceljs |
| Validación | Zod |
| Testing | Vitest (unit), Playwright (e2e) |
| Deploy | Vercel |

---

## Estructura del Proyecto

```
src/
  app/
    layout.tsx              # Root layout (ThemeProvider, Toaster, TopLoader)
    login/                  # Página de login (server action con signIn)
    (admin)/                # Layout protegido (sidebar + auth check)
      layout.tsx            # Verifica sesión, redirige a /login si no hay
      dashboard/            # Dashboard con gráficos y métricas mensuales
      visitas/              # CRUD visitas + formulario complejo
        page.tsx            # Listado con DataTable
        nueva/page.tsx      # Crear visita
        [id]/page.tsx       # Detalle con ciclo de vida (confirmar, realizar, completar; ver `visita-lifecycle-view.tsx`)
        [id]/editar/page.tsx    # Editar visita (formulario)
        [id]/resultados/page.tsx # Resultados de exámenes
      cotizaciones/         # CRUD cotizaciones standalone
        page.tsx
        nueva/page.tsx
        [id]/page.tsx       # Detalle con ciclo de vida (`cotizacion-lifecycle-view.tsx`)
      asignacion/           # Board drag-and-drop para asignar enfermeras
        page.tsx            # Board con mapa
        envio-correos/      # Envío masivo de correos a enfermeras
      pacientes/            # CRUD pacientes con historial
      enfermeras/           # CRUD enfermeras
      examenes/             # Catálogo de exámenes
      procedimientos/       # Catálogo de procedimientos
      talleres/             # Catálogo de talleres
      previsiones/          # Catálogo de previsiones de salud
      residencias/          # Catálogo de residencias de adulto mayor
      comunas/              # Catálogo de comunas
      tipos-recargos/       # Catálogo de tipos de recargos
      origenes-contacto/    # Catálogo de orígenes de contacto
      precios/              # Gestión de precios (visitas por comuna)
      pagos-enfermeras/     # Resumen mensual de pago a enfermeras + [enfermeraId] detalle
      reportes/             # Reporte de visitas con export Excel (solo admin)
      playground/           # Showcase del design system (solo admin)
    api/
      auth/[...nextauth]/   # NextAuth route handler
      cotizacion/[id]/      # GET → HTML imprimible de cotización (desde visita)
      cotizacion-standalone/[id]/ # GET → HTML imprimible de cotización independiente
      upload/               # POST → Subir archivos a R2
      r2-file/              # GET → Redirect a signed URL de R2
      visitas/export/       # GET → .xlsx de visitas filtradas
      reportes/visitas/export/ # GET → .xlsx del reporte de visitas (solo admin)
  lib/
    actions/                # Server actions (toda la lógica de negocio); tests en `__tests__/`
    with-action.ts          # withQuery / withAction / withFormAction / ActionError / ActionResult
    permissions.ts          # ADMIN_ONLY_PREFIXES, canAccessPath(), isAdmin()
    reportes/               # Definición de columnas del reporte/Excel de visitas
    pricing/                # Lógica de cálculo de precios
    auth-guard.ts           # requireSession() helper
    validation.ts           # parseFormData / parseFormDataWithArrays + campos reutilizables (fields)
    r2.ts                   # Cliente S3 para Cloudflare R2
    excel/build-excel.ts    # Helper genérico para generar .xlsx desde columnas + filas (ExcelJS)
    format.ts               # Formateo de fechas (zona Chile)
    rut.ts                  # Validación/formateo RUT chileno
    paciente.ts             # Helper formatNombre()
    comunas.ts              # normalizeComuna() — normalización case/acento-insensible (el catálogo vive en la tabla `comunas`)
    utils.ts                # cn() (clsx + tailwind-merge)
  components/
    ui/                     # Primitivos: button, card, chart, checkbox, popover
    sidebar.tsx             # Navegación lateral colapsable
    data-table.tsx          # Componente genérico de tabla con filtros, paginación, CRUD modal
    visita-form.tsx         # Formulario complejo de visita
    cotizacion-form.tsx     # Formulario de cotización
    paciente-form.tsx       # Formulario de paciente
    select-combobox.tsx     # Select con búsqueda (usado en todo el proyecto)
    form-date-picker.tsx    # Date picker para formularios
    file-upload.tsx         # Upload de archivos a R2
    *-table.tsx             # Tablas específicas por entidad
    asignacion-*.tsx        # Componentes del board de asignación
    dashboard-*.tsx         # Componentes del dashboard
  db/
    index.ts                # Conexión DB (Neon en Vercel, postgres.js local)
    schema.ts               # Esquema Drizzle completo
    seed/                   # Seed de datos (index.ts, catalogos.ts, operacion.ts, data/ con catálogos y examenes.csv)
    migrations/             # Migraciones Drizzle
  auth.ts                   # Configuración NextAuth
docs/
  historico/                # Planes y especificaciones antiguas ya implementadas (solo referencia histórica)
  plan-*/                   # Planes de trabajo por iniciativa (design system, archivos múltiples, seed/tests)
e2e/                        # Tests Playwright
```

---

## Base de Datos — Esquema

### Entidades principales

| Tabla | Variable Drizzle | Descripción |
|---|---|---|
| `usuarios` | `users` | Usuarios del sistema (login) |
| `enfermeras` | `nurses` | Profesionales que realizan visitas |
| `pacientes` | `patients` | Personas que reciben atención |
| `direcciones` | `addresses` | Dirección física del paciente (con lat/lng) |
| `telefonos_pacientes` | `patientPhones` | Múltiples teléfonos por paciente |
| `visitas` | `visits` | Entidad central: visita programada |
| `cotizaciones` | `quotations` | Cotización independiente (puede convertirse en visita) |

### Catálogos

| Tabla | Variable Drizzle | Descripción |
|---|---|---|
| `examenes` | `exams` | Exámenes médicos (con grupo: imalab, etc.) |
| `procedimientos` | `procedures` | Procedimientos de enfermería (con categoría) |
| `talleres` | `workshops` | Talleres (precio libre por visita) |
| `companias_seguros` | `healthInsurances` | Previsiones de salud (fonasa/isapre/particular) |
| `residencias_adulto_mayor` | `elderlyResidences` | Residencias de adulto mayor |
| `origenes_contacto` | `contactOrigins` | Origen del contacto |
| `tipos_recargos` | `surchargeTypes` | Tipos de recargos excepcionales |
| `comunas` | `comunas` | Comunas (usado por enfermeras, precios de visita y cotizaciones) |
| `precios_visita_enfermeria` | `nursingVisitPrices` | Precio de visita por comuna (`id_comuna` null = base) |

### Tablas pivote

| Tabla | Variable Drizzle | Relación |
|---|---|---|
| `examenes_visitas` | `visitExams` | Exámenes de una visita (con precio snapshot) |
| `procedimientos_visitas` | `visitProcedures` | Procedimientos de una visita (con precio snapshot) |
| `talleres_visitas` | `visitWorkshops` | Talleres de una visita (precio libre) |
| `cotizacion_examenes` | `quotationExams` | Exámenes de una cotización |
| `cotizacion_procedimientos` | `quotationProcedures` | Procedimientos de una cotización |
| `cotizacion_talleres` | `quotationWorkshops` | Talleres de una cotización |
| `archivos_visitas` | `visitFiles` | Adjuntos de una visita (fotos de órdenes médicas), con `orden` |
| `archivos_pacientes` | `patientFiles` | Adjuntos de un paciente (fotos de cédula, PDFs), con `orden` |

### Relaciones clave

- `patients` → `addresses` (1:1, FK obligatorio)

### Dirección del paciente
- `direcciones.direccion` = lo que se muestra a personas (correo a enfermeras, cotizaciones,
  formularios). Por defecto = `direccion_formateada` (Google). Si el operador activa el checkbox
  "Agregar dirección para la enfermera" —se activa solo cuando Google no trae número, con aviso—
  es su texto libre (número, depto, block, referencias), pre-llenado con `direccionCorta()`.
  El formulario deduce el checkbox con `direccion !== direccion_formateada` (no hay columna extra).
- `direcciones.direccion_formateada` + componentes (`calle`, `numero`, `area_administrativa_3`,
  lat/lng) = respuesta de Google Maps, solo para geolocalizar, mapa y resolver comuna/precio.
- Leer siempre vía `direccionParaMostrar()` / `direccionMapsUrl()` / `direccionConComuna()` en
  `src/lib/direccion.ts` — no elegir la columna a mano.
- `patients` → `healthInsurances` (N:1, opcional)
- `patients` → `elderlyResidences` (N:1, opcional)
- `patients` → `patientPhones` (1:N, cascade delete)
- `visits` → `patients` (N:1, cascade delete)
- `visits` → `nurses` (N:1, restrict delete)
- `visits` → `surchargeTypes` (N:1, restrict delete)
- `quotations` → `patients` (N:1, set null — paciente opcional)
- `quotations` → `visits` (N:1, set null — referencia a visita convertida)
- `quotations` → `comunas` (N:1, restrict delete)
- `nurses` → `comunas` (N:1, opcional, restrict delete)
- `nursingVisitPrices` → `comunas` (N:1, opcional — null = precio base, restrict delete)

### Convención de nombres

- Tablas en español plural: `visitas`, `pacientes`, `enfermeras`
- Variables Drizzle en inglés: `visits`, `patients`, `nurses`
- Columnas en snake_case español: `apellido_paterno`, `fecha_nacimiento`
- Props TypeScript en camelCase: `apellidoPaterno`, `fechaNacimiento`

---

## Autenticación

- **NextAuth v5 beta** con Credentials provider (correo + contraseña)
- Contraseñas hasheadas con bcryptjs
- JWT con campo `role` custom (`session.user.role`)
- Guard: `requireSession()` en `src/lib/auth-guard.ts` — se llama al inicio de cada server action
- Layout `(admin)/layout.tsx` verifica sesión y redirige a `/login`
- Página de login usa server action con `signIn('credentials', ...)`

### Roles y permisos
- Roles (`usuarios.rol`): `admin` (acceso total) y `ejecutivo` (default). **Todo lo que no sea
  `admin` queda restringido** — un rol desconocido nunca recibe más acceso.
- Modelo simple: acceso sí/no a interfaces completas, definido en `src/lib/permissions.ts`
  (`ADMIN_ONLY_PREFIXES`, `canAccessPath()`, `isAdmin()`). Hoy solo-admin: exámenes,
  procedimientos, talleres, tipos de recargos, precios de visita, reportes (`/reportes`, `/api/reportes`) y `/playground`.
- Se aplica en 3 capas: `src/proxy.ts` (redirige a `/dashboard`, o 403 en `/api/*`), el sidebar
  (oculta ítems) y las server actions de mutación con `requireAdmin()` (`src/lib/auth-guard.ts`).
  En catálogos del factory basta con `adminOnly: true` en el `CatalogConfig`. Las lecturas
  (`search*`/`get*`) no se restringen porque las usan otros formularios (p.ej. visita).
- Reglas puntuales: `deleteVisita` solo deja a admin eliminar visitas `realizada`/`completada`;
  `deletePaciente` solo deja a admin eliminar pacientes con visitas.
- Al agregar una sección solo-admin: sumar el prefijo a `ADMIN_ONLY_PREFIXES` y `requireAdmin()`
  en sus mutaciones.

### Alta de usuarios y cambio de contraseña
No hay UI de gestión de usuarios: se hace con SQL en el SQL Editor de Neon. Si piden crear un
usuario o cambiar una contraseña, entregar el SQL listo (no un script).
- Hash bcrypt con costo 10 (lo que espera `bcryptjs` en `src/auth.ts`). Generarlo localmente para
  que la contraseña no quede en el historial de la base:
  `node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" '<contraseña>'`.
  Para contraseñas iniciales, generar una aleatoria (~20 caracteres) y entregarla junto al SQL.
- Alternativa en la base (deja la contraseña en el historial; usarla en un Preview y copiar el hash
  a prod): `CREATE EXTENSION IF NOT EXISTS pgcrypto; SELECT crypt('<contraseña>', gen_salt('bf', 10));`
  — el hash `$2a$` de pgcrypto es compatible con `bcryptjs`.
- Crear: `INSERT INTO usuarios (nombre, correo, contrasena, rol, activo, created_at, updated_at)
  VALUES ('<Nombre>', '<correo>', '<hash>', 'ejecutivo', true, NOW(), NOW());` (rol `admin` o
  `ejecutivo`; `correo` es único).
- Cambiar contraseña: `UPDATE usuarios SET contrasena = '<hash>', updated_at = NOW() WHERE correo = '<correo>';`
  — no invalida sesiones JWT ya abiertas.

---

## Server Actions — Referencia

Todas en `src/lib/actions/`, todas con `'use server'` y `requireSession()` al inicio
(lo hacen los wrappers de `src/lib/with-action.ts`, ver "Patrón de server actions").

### Patrón de server actions
Wrappers en `src/lib/with-action.ts` (todos llaman `requireSession()`; usarlos en toda action nueva):
- `withQuery(fn)` — lecturas. Los errores se propagan al error boundary.
- `withAction(errorMsg, fn)` — mutaciones. try/catch: devuelve `{ success: false, error }`; el detalle
  real solo va a `console.error`, el usuario ve `errorMsg`.
- `withFormAction(schema, formData, errorMsg, fn, arrayFields?)` — mutaciones con FormData: parsea con
  Zod (`parseFormData`, o `parseFormDataWithArrays` si pasas `arrayFields`) y luego como `withAction`.
- `ActionError` — lanzarlo dentro de `fn` para devolver un mensaje **visible al usuario** (validaciones de
  negocio, estados inválidos). Cualquier otro error se enmascara con `errorMsg`.
- `ActionResult<T>` — `{ success: true }` | `{ success: true, data: T }` | `{ success: false, error }`.
- Archivos `'use server'`: no exportar desde ellos funciones helper que no sean actions (cada export
  queda expuesto como endpoint). Los helpers van en `src/lib/...`.
- Las mutaciones solo-admin llaman además `requireAdmin()` (`src/lib/auth-guard.ts`).

### visitas.ts
- `searchVisitas(params)` — Listado paginado con filtros (fecha, enfermera, estado, búsqueda)
- `getVisita(id)` — Detalle completo para edición
- `createVisita(formData)` — Crear visita con exámenes, procedimientos, talleres
- `updateVisita(formData)` — Actualizar visita
- `deleteVisita(id)` — Eliminar visita
- `getEnfermeras()` — Select de enfermeras activas
- `getTiposRecargos()` — Select de tipos de recargos activos
- `getVisitaFormPricingContext(comuna, examIds)` — Contexto de precios para preview en formulario
- `searchOrigenesContacto()` — Listado de orígenes
- `actualizarPrecioExamenVisita(...)` — Actualizar precio individual de examen en visita
- `actualizarPrecioProcedimientoVisita(...)` — Actualizar precio individual de procedimiento en visita
- `getVisitaLifecycle(id)` — Detalle para la vista de ciclo de vida (`visita-lifecycle-view.tsx`)
- `listVisitasForExport(filters)` — Filas para `/api/visitas/export`
- `listVisitasForReport(filters)` — Filas del reporte (`/reportes`, `/api/reportes/visitas/export`); columnas en `src/lib/reportes/visitas-columns.ts`
- Ciclo de estados (`visitas.estado`): `programada` → `confirmada` → `realizada` → `completada`;
  ramas `no_realizada` (desde confirmada) y `cancelada` (desde programada o confirmada). `completada`,
  `cancelada` y `no_realizada` son finales (no se editan). Acciones:
  - `confirmarVisita(id)` — programada → confirmada
  - `marcarRealizada(id)` — confirmada → realizada (exige enfermera asignada)
  - `marcarNoRealizada(id, costo, concepto)` — confirmada → no_realizada (costo de traslado)
  - `cancelarVisita(id, motivo)` — programada/confirmada → cancelada
  - `guardarFacturacionVisita(id, data)` / `guardarPagoVisita(id, data)` / `guardarEnvioExamenesVisita(id, examenes)` — guardado parcial del cierre (visita realizada)
  - `completarVisita(id, data)` — realizada → completada (exige documento, pago y fecha de pago)

### cotizaciones.ts
- `searchCotizaciones(params)` — Listado paginado
- `getCotizacion(id)` — Detalle para edición
- `createCotizacion(formData)` / `updateCotizacion(formData)` — Crear / actualizar cotización
  (escrituras en una transacción: un fallo no deja la cotización sin ítems)
- `deleteCotizacion(id)` — Eliminar cotización
- `getPreciosVisita()` — Mapa comuna→precio para el formulario
- `getCotizacionVista(id)` — Datos de la vista de ciclo de vida
- Ciclo de estados (`cotizaciones.estado`): `creada` → `enviada` → `aceptada` | `rechazada`.
  `marcarEnviada(id)` (creada → enviada), `aceptarCotizacion(id, idPaciente?)` (enviada → aceptada,
  **convierte en visita** y devuelve `{ idVisita }`), `rechazarCotizacion(id, motivo)` (enviada → rechazada).
  `aceptarCotizacion` corre en una transacción que primero "reclama" la cotización con un UPDATE
  condicional (`estado = 'enviada' AND id_visita IS NULL`) → dos aceptaciones concurrentes no crean
  dos visitas. La conversión (`convertirCotizacionAVisita`) es un helper interno no exportado que
  recibe `tx`; la visita queda con fecha `todaySantiago()`.

### pacientes.ts
- `searchPacientes(params)` — Listado paginado
- `getPaciente(id)` — Detalle con dirección, teléfonos, previsión
- `createPaciente(formData)` — Crear con dirección y teléfonos
- `updatePaciente(formData)` — Actualizar
- `deletePaciente(id)` — Eliminar
- `getHistorialPaciente(id)` — Historial de visitas del paciente
- `getPacientes()` — Select de todos los pacientes

### enfermeras.ts
- `searchEnfermeras(params)` — Listado paginado
- `createEnfermera(formData)` / `updateEnfermera(formData)` / `toggleEnfermera(id, activo)` / `deleteEnfermera(id)`

### catalogos.ts
- CRUD para cada catálogo: procedimientos, exámenes, talleres, previsiones, residencias, comunas, tipos de recargos
- Patrón: `search*`, `create*`, `update*`, `toggle*`
- Cada catálogo se declara con un `CatalogConfig` y delega en `_catalog-factory.ts`

### _catalog-factory.ts
- Factory genérico del CRUD de catálogos: `catalogSearch`, `catalogCreate`, `catalogUpdate`, `catalogToggle`
  (config: `CatalogConfig`, incl. `adminOnly: true` para exigir `requireAdmin()` en mutaciones).
  No es un archivo de actions expuestas: los catálogos lo envuelven en `catalogos.ts`.
- Helpers: `getProcedimientos()`, `getExamenes()`, `getTalleres()`, `getComunasForSelect()` — para selects

### precios.ts
- `searchPreciosExamenes(params)` / `searchPreciosVisita(params)` — Gestión de precios
- `getCotizacionVisita(idVisita)` — Datos para generar HTML de cotización desde visita
- `getExamenesForSelect()` — Select de exámenes para asociar precios

### pagos-enfermeras.ts
- `searchPagosEnfermerasMensual(params)` — Resumen mensual de pago por enfermera (suma SQL con `calcNursePaymentBase()`)
- `getPagoEnfermeraDetalle(...)` — Detalle por visita de una enfermera (usa `calcNursePaymentBreakdown()`)

### asignacion.ts
- `getVisitasParaAsignacion(fecha)` — Visitas del día con datos para el board
- `getEnfermerasActivas()` — Enfermeras para asignar
- `guardarAsignaciones(...)` — Guardar asignación enfermera-visita

### visitas-asignacion-email.ts
- `getVisitasAsignadasPorEnfermera(fecha)` — Datos para correos
- `sendScheduledVisitsEmail(enfermeraId, fecha)` — Enviar correo a una enfermera
- `sendAllScheduledVisitsEmails(fecha)` — Envío masivo

### dashboard.ts
- `getDashboardVisitsByDay(month, year)` — Visitas por día del mes
- `getDashboardFinanciero(month, year)` — Métricas financieras

---

## API Routes (Route Handlers)

Solo se usan cuando se necesita controlar headers HTTP o servir contenido no-JSON:

| Ruta | Método | Propósito |
|---|---|---|
| `/api/auth/[...nextauth]` | * | NextAuth handler |
| `/api/cotizacion/[id]` | GET | HTML imprimible de cotización (desde visita) |
| `/api/cotizacion-standalone/[id]` | GET | HTML imprimible de cotización independiente |
| `/api/upload` | POST | Subir archivo a Cloudflare R2 |
| `/api/r2-file` | GET | Redirect a signed URL de R2 |
| `/api/visitas/export` | GET | Descarga .xlsx con visitas filtradas (acepta los mismos filtros que `searchVisitas` como query params) |

---

## Lógica de Precios

El cálculo de costos es central al negocio:

### Precio de visita de enfermería
- Tabla `precios_visita_enfermeria` con precio por `id_comuna` (FK a `comunas`)
- Si no hay precio para la comuna, se usa el precio base (`id_comuna = null`)
- La comuna del paciente es texto libre (`direcciones.area_administrativa_3`, desde Google Maps) y se
  resuelve contra el catálogo `comunas` por nombre normalizado (case/acento-insensible)
- Funciones en `src/lib/pricing/visitas.ts`:
  - `resolverPrecioVisitaEnfermeria(conn, comunaNombre)` — resuelve por nombre (texto libre); devuelve
    `{ precio, idComuna, comunaEncontrada, usoPrecioBase }`. `comunaEncontrada: false` indica que el
    nombre no matcheó ninguna comuna activa del catálogo (se avisa en el formulario de visita)
  - `getPrecioVisitaPorIdComuna(conn, idComuna)` — resuelve por id ya conocido (p.ej. seleccionado en
    un `<select>`, como en cotizaciones)

### Costo total de una visita
Calculado en `calcularCostoVisitaPersistida()`:
```
total = subtotalExámenes + subtotalProcedimientos + subtotalTalleres
        + costoVisitaEnfermería (si cobraVisita=true)
        + montoRecargo (si aplica)
```

### Preview de costo (formulario)
`calcularCostoVisitaPreview()` en `src/lib/pricing/visita-preview.ts`:
- Calcula en el cliente sin ir al servidor
- Usa precios del catálogo vs precios guardados en la visita (prioridad: guardados)
- Se actualiza en tiempo real al modificar ítems del formulario

### Pago a enfermeras
- Cada enfermera tiene `porcentajePago` (default `DEFAULT_PORCENTAJE_PAGO` = 67.5%)
- **La base excluye exámenes (regulares e isapre), talleres e insumos** — esos montos van al
  laboratorio / terceros. La base es: `fee de visita + procedimientos + recargos`, cada componente
  neto solo del descuento que le afecta (`descuentoAfectaPagoEnfermera` /
  `descuentoProcedimientosAfectaPagoEnfermera`).
- `pago = round(base * porcentajePago / 100)`
- Lógica centralizada en `src/lib/pricing/nurse-payment.ts`:
  - `calcNursePaymentConcepts()` — desglose de conceptos por visita (fee, descuentos, procedimientos,
    recargos, base), **sin** el monto final. Lo usa el correo de programación
    (`generateScheduledVisitsHTML` en `src/lib/emails/scheduled-visits-email-html.ts`), que muestra el
    detalle pero no un monto de pago.
  - `calcNursePaymentBreakdown()` — lo anterior + `porcentaje` + `pago` final. Lo usan
    `getPagoEnfermeraDetalle` (`/pagos-enfermeras`) y el reporte Excel de visitas.
- El resumen mensual agregado (`searchPagosEnfermerasMensual`) usa `calcNursePaymentBase()` con sumas
  SQL — mismo resultado, distinta forma.

---

## Componente DataTable

`src/components/data-table.tsx` es el componente más complejo y reutilizado. Provee:

- Tabla con sorting, paginación server-side
- Filtros configurables (text, checkbox, select, date, date-range)
- Modal de crear/editar inline
- Acciones por fila: editar, eliminar, toggle activo
- Link a detalle
- Server actions como props (`search`, `onCreate`, `onUpdate`, `onDelete`, `onToggle`)

**Tipos públicos exportados:** `SearchParams`, `Result`, `ColumnDef`, `FilterDef`, `FormFieldDef`, `SelectOption`

Patrón de uso en páginas:
```tsx
// page.tsx (Server Component)
const initialData = await searchEntidad({ filters: {}, sort: null, page: 1, pageSize: 10 })
return <EntidadTable initialData={initialData} search={searchEntidad} ... />
```

---

## Archivos y Storage (R2)

- Bucket privado en Cloudflare R2. **Múltiples archivos** por visita y por paciente
  (tablas `archivos_visitas` / `archivos_pacientes`, columna `orden`).
- Componente UI: `<FilesUpload>` (`src/components/files-upload.tsx`) — drag & drop, N archivos,
  reordenar, quitar. Comprime cada imagen **en el navegador** antes de subir
  (`src/lib/images/resize.ts`, constantes `IMAGE_*` para calibrar: 1600px lado mayor, JPEG q0.72).
- Upload: `POST /api/upload?folder=pacientes|visitas` → sube a `tmp/{uuid}.ext`, devuelve
  `{ key, nombreOriginal, contentType, tamano }`. Límite 10MB; `visitas` solo imágenes,
  `pacientes` imágenes + PDF.
- El form manda la lista como **un hidden JSON** `name="archivos"` (`serializeArchivos`);
  la server action reconcilia contra la DB (`src/lib/archivos/persist.ts`) y, tras el commit,
  renombra los objetos de R2 a su key legible con `syncArchivos{Visita,Paciente}`
  (`src/lib/archivos/sync.ts`): `visitas/v{idVisita}_{primerNombre}_{apellidoPaterno}_{n}.ext`
  (nombre del paciente de la visita), `pacientes/p{idPaciente}_..._{n}.ext`. Slug en
  `src/lib/slug.ts`, construcción de key en `src/lib/archivos/nombres.ts`.
- Al cambiar el nombre de un paciente se resincronizan sus archivos y los de sus visitas.
- Descarga/preview: signed URL (1h) generada en el server component (`getArchivos*` en
  `src/lib/archivos/query.ts`). `GET /api/r2-file?key=...` valida prefijo `pacientes/|visitas/`.
- Objetos abandonados en `tmp/` (formulario cancelado): limpiar con lifecycle rule del bucket.
- Script de renombrado one-off tras deploy: `pnpm archivos:renombrar`.

---

## Email (Resend)

- Se usa para enviar itinerario de visitas a enfermeras
- El correo incluye detalle de cada visita: paciente, dirección, exámenes, procedimientos, talleres, adjuntos (fotos de órdenes médicas desde R2)
- `sendScheduledVisitsEmail()` envía a una enfermera
- `sendAllScheduledVisitsEmails()` envío masivo del día
- Todos los archivos de la visita se adjuntan con su nombre legible (`v{id}_{nombre}_{n}.jpg`),
  deduplicados por key y descargados en paralelo (`buildVisitAttachments`). El HTML lista los
  nombres de archivo en la fila "Adjuntos" para mapear adjunto ↔ columna `Visita #N`.
- Todos los correos de salida llevan `cc` a `contacto@homelab.cl` (constante `CC_CORREOS_SALIDA`, override con `RESEND_CC_EMAIL`)
- Destinatarios por ambiente vía `resolveEmailEnvelope()` (`src/lib/emails/recipients.ts`), obligatorio
  en todo envío nuevo: con `EMAIL_REDIRECT_TO` todo va solo a esa casilla (sin CC, asunto
  `[PRUEBA → destinatarios originales] ...`); en Preview sin `EMAIL_REDIRECT_TO` **no se envía nada**
  (los previews usan una copia de la base con correos reales).

---

## Convenciones Técnicas

### Idioma
- **Código fuente**: inglés (variables, funciones, tipos, nombres de archivos)
- **UI/labels/mensajes**: español (Chile)
- **Esquema DB**: tablas y columnas en español, variables Drizzle en inglés
- **Comentarios**: español está bien, pero preferir código auto-documentado

### Patrones obligatorios
1. **Toda server action debe llamar `await requireSession()` al inicio**
2. **Usar `revalidatePath` después de mutaciones** para invalidar cache
3. **Precios se almacenan como enteros** (pesos chilenos, sin decimales)
4. **Fechas se almacenan como `YYYY-MM-DD` string** en la DB (tipo `date`)
5. **Usar `parseDateLocal()` para convertir strings a Date** — evita desfase UTC
6. **Zona horaria: America/Santiago** — usar `todaySantiago()` para fecha actual
7. **RUT se valida con `validateRut()`** de `src/lib/rut.ts`
8. **Formateo de nombres con `formatNombre()`** de `src/lib/paciente.ts`
9. **Notificaciones con `toast` de sonner** (toast.success, toast.error)
10. **Estilos con los tokens del HomeLab Design System** (`var(--color-fg)`, `var(--color-fg-muted)`, `var(--color-primary)`, etc. — ver sección "Design System")
11. **Server actions con FormData usan Zod** — `parseFormData` para campos escalares, `parseFormDataWithArrays` para forms con arrays (`procedure_ids`, `exam_ids`, etc.), ambos en `src/lib/validation.ts`. Campos reutilizables en `fields` (nullableStr, nullableId, bool, fechaRequerida, ids). Validación cruzada con `.superRefine()`. Claves dinámicas (`taller_precio_${id}`, `phone_${i}`) siguen extrayéndose manualmente después del parse.
12. **Todo cambio debe pasar `pnpm typecheck && pnpm lint` antes de commitear** (`lint` = `eslint .` con flat config en `eslint.config.mjs`; `typecheck` = `tsc --noEmit`). `next build` ya no corre lint. Las reglas `react-hooks/set-state-in-effect` y `no-explicit-any` están en `warn` (deuda conocida); el resto debe quedar en 0 errores.

### Patrones de UI
- Páginas de listado: Server Component que hace fetch inicial + Client Component tabla
- Formularios complejos (visita, cotización, paciente): componente client dedicado
- Catálogos simples: `DataTable` genérico con modal inline
- Select con búsqueda: `<SelectCombobox>` (wraps Popover + Command-like)
- Date picker: `<FormDatePicker>` (wraps react-day-picker)
- Todas las páginas dentro de `(admin)/` viven dentro de la estructura de shell `.app` /
  `.app-main` / `.app-body` (`src/app/homelab-shell.css`) — no agregar wrappers propios de
  padding (`p-8`, `min-h-screen`, etc.), ya lo provee el layout.

### Design System (HomeLab DS)
- Tokens en `src/app/homelab-tokens.css` (`@theme`, namespaces `--color-*`, `--space-*`,
  `--radius-*`, `--text-*`, `--control-*` para densidad) + primitivos CSS `.hl-*` (botón,
  input, card, tabla, badge, tag, modal, etc.). `src/app/homelab-shell.css` define el shell
  (`.app`, `.app-side`, `.page-head`, `.toolbar`).
- Componentes React en `src/components/ui/*` envuelven las clases `.hl-*` (`Button`,
  `Badge`, `Tag`, `Chip`, `StatusDot`, `Avatar`, `Callout`, `MetaGrid`/`MetaTile`,
  `EmptyState`, etc.) — usarlos en vez de reescribir markup con estilos inline.
  `src/app/(admin)/playground/page.tsx` tiene un showcase de todos ellos.
  `<PageHeader>` (`src/components/page-header.tsx`) reemplaza el header manual de cada página.
- Solo modo claro — no hay paleta oscura ni toggle de tema.
- Densidad parametrizada en un solo lugar: `<html data-density="medium">` (`--control-h`,
  `--row-py`, `--cell-px`, etc. en `homelab-tokens.css`); cambiar el atributo reescala toda
  la app.
- Origen: proyecto de diseño Claude Design "HomeLab Design System"
  (`f20b3901-7c86-452d-854e-3c51dd890562`). El plan de migración completo (paso a paso,
  con verificación) vive en `docs/plan-design-system/`.

### Conexión a base de datos
- En Vercel: Neon serverless (WebSocket via `@neondatabase/serverless` Pool)
- Local: `postgres` (TCP directo) — se detecta con `process.env.VERCEL`
- Variable: `HOMELAB_DATABASE_URL` (pooled), `HOMELAB_DATABASE_URL_UNPOOLED` (para migraciones)

### Build
- `vercel-build`: `tsx scripts/db-guard.ts && drizzle-kit migrate && next build`
- Cada deployment de **Preview** usa su propia rama de Neon (`preview/<rama-git>`, creada por la
  integración Vercel↔Neon desde la rama principal), así que las migraciones de una rama no tocan
  producción. `scripts/db-guard.ts` (lógica en `src/lib/db-guard.ts`) imprime el host de la base y
  **corta el build** si un Preview apunta al host de producción (`HOMELAB_PRODUCTION_DB_HOST`) o si
  esa variable falta en Preview
- Seed: `pnpm db:seed` (usa tsx con .env.local); `pnpm db:seed:catalogos` solo catálogos. Los datos
  viven en `src/db/seed/data/` (incluye `examenes.csv`, leído con `process.cwd()`).
- Tests: `pnpm test` (todo vitest), `pnpm test:unit` (`src/lib/__tests__` y `src/lib/pricing/__tests__`),
  `pnpm test:integration` (`src/lib/actions/__tests__`, requieren Postgres de test vía
  `HOMELAB_TEST_DATABASE_URL`, ver `src/test/global-setup.ts`), `pnpm test:e2e` (Playwright, `e2e/`).

---

## Variables de Entorno

| Variable | Descripción |
|---|---|
| `HOMELAB_DATABASE_URL` | PostgreSQL connection string (pooled) |
| `HOMELAB_DATABASE_URL_UNPOOLED` | PostgreSQL connection string (direct, para migraciones) |
| `AUTH_SECRET` | Secret para NextAuth JWT |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | API key de Google Maps |
| `RESEND_API_KEY` | API key de Resend para emails |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | Nombre del bucket R2 |
| `VERCEL` | Autoinyectada por Vercel (detecta entorno) |
| `EMAIL_REDIRECT_TO` | Solo Preview/Development: casilla que recibe todos los correos de salida |
| `HOMELAB_PRODUCTION_DB_HOST` | Host de la base de producción (sin credenciales). Lo usa `db-guard` en el build; obligatoria en Preview |

---

## Deuda Técnica

### Alta prioridad

1. **`PricingDb` tipado como `any`** en `src/lib/pricing/visitas.ts:35` — la conexión de DB se pasa como `any` para aceptar tanto Neon como postgres.js. Debería tener un tipo compartido o usar el tipo de Drizzle.

2. **`SimpleDatePicker` solo se usa en playground** — El componente existe pero no se usa en producción. Evaluar si eliminarlo o adoptarlo.

### Media prioridad

3. **Formularios sin react-hook-form** — Los formularios complejos (visita, cotización, paciente) manejan estado manualmente con muchos `useState`. Esto es funcional pero verboso. La validación server-side con Zod ya está en place; no es prioridad migrar.

4. **NextAuth en versión beta** — `next-auth@5.0.0-beta.30` puede tener breaking changes. Monitorear para actualizar a la versión estable cuando salga.

5. **Los cuadros de pendientes del dashboard son un quickview, no un reporte.** "Cobros pendientes" y "Resultados pendientes" (`getDashboardFinanciero`) muestran solo las primeras 20 filas del mes seleccionado (el subtítulo indica el total real). Falta una página de reporte dedicada, con filtros propios (rango de fechas, enfermera, laboratorio, grupo de examen), paginación y export a Excel vía `src/lib/excel/build-excel.ts`, tanto para cobros pendientes como para exámenes con resultado por enviar.

### Baja prioridad

6. **Google Maps API key expuesta al cliente** — `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` es pública por necesidad (se usa en el browser), pero debería tener restricciones de dominio configuradas en la consola de Google Cloud.

7. **No hay rate limiting en API routes** — Los endpoints de upload y archivos no tienen rate limiting.

### Resuelto (referencia)
- Duplicación de HTML entre cotización y cotización-standalone → `buildCotizacionHTML()` en `src/lib/cotizacion-html.ts`.
- Catálogos con CRUD repetido → `src/lib/actions/_catalog-factory.ts`.
- Manejo de errores centralizado en server actions → `src/lib/with-action.ts`.
- Cobertura de tests → tests de integración en `src/lib/actions/__tests__/` (visitas, cotizaciones, asignación, email, reportes, pagos, permisos, dashboard, catálogos, enfermeras, pricing), unit en `src/lib/__tests__/` y e2e en `e2e/`.
