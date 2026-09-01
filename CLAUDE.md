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
        [id]/page.tsx       # Editar visita
      cotizaciones/         # CRUD cotizaciones standalone
        page.tsx
        nueva/page.tsx
        [id]/page.tsx
      asignacion/           # Board drag-and-drop para asignar enfermeras
        page.tsx            # Board con mapa
        envio-correos/      # Envío masivo de correos a enfermeras
      pacientes/            # CRUD pacientes con historial
      enfermeras/           # CRUD enfermeras
      laboratorios/         # CRUD laboratorios
      examenes/             # Catálogo de exámenes
      procedimientos/       # Catálogo de procedimientos
      talleres/             # Catálogo de talleres
      previsiones/          # Catálogo de previsiones de salud
      residencias/          # Catálogo de residencias de adulto mayor
      comunas/              # Catálogo de comunas
      tipos-recargos/       # Catálogo de tipos de recargos
      precios/              # Gestión de precios (visitas por comuna)
      playground/           # Página de desarrollo/testing de componentes
    api/
      auth/[...nextauth]/   # NextAuth route handler
      cotizacion/[id]/      # GET → HTML imprimible de cotización (desde visita)
      cotizacion-standalone/[id]/ # GET → HTML imprimible de cotización independiente
      upload/               # POST → Subir archivos a R2
      r2-file/              # GET → Redirect a signed URL de R2
  lib/
    actions/                # Server actions (toda la lógica de negocio)
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
    seed.ts                 # Seed de datos
    migrations/             # Migraciones Drizzle
  auth.ts                   # Configuración NextAuth
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
| `laboratorios` | `laboratories` | Redes de laboratorios |
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

### Relaciones clave

- `patients` → `addresses` (1:1, FK obligatorio)
- `patients` → `healthInsurances` (N:1, opcional)
- `patients` → `elderlyResidences` (N:1, opcional)
- `patients` → `patientPhones` (1:N, cascade delete)
- `visits` → `patients` (N:1, cascade delete)
- `visits` → `nurses` (N:1, restrict delete)
- `visits` → `laboratories` (N:1, restrict delete)
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

---

## Server Actions — Referencia

Todas en `src/lib/actions/`, todas con `'use server'` y `requireSession()` al inicio.

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

### cotizaciones.ts
- `searchCotizaciones(params)` — Listado paginado
- `getCotizacion(id)` — Detalle para edición
- `createCotizacion(formData)` — Crear cotización
- `updateCotizacion(formData)` — Actualizar cotización
- `deleteCotizacion(id)` — Eliminar cotización
- `convertirCotizacionAVisita(id)` — Convierte cotización en visita (copia ítems)
- `getPreciosVisita()` — Mapa comuna→precio para el formulario

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

### laboratorios.ts
- CRUD estándar: `searchLaboratorios`, `createLaboratorio`, `updateLaboratorio`, `toggleLaboratorio`

### catalogos.ts
- CRUD para cada catálogo: procedimientos, exámenes, talleres, previsiones, residencias, comunas, tipos de recargos
- Patrón: `search*`, `create*`, `update*`, `toggle*`
- Helpers: `getProcedimientos()`, `getExamenes()`, `getTalleres()`, `getComunasForSelect()` — para selects

### precios.ts
- `searchPreciosExamenes(params)` / `searchPreciosVisita(params)` — Gestión de precios
- `getCotizacionVisita(idVisita)` — Datos para generar HTML de cotización desde visita
- `getExamenesForSelect()` — Select de exámenes para asociar precios

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
- Cada enfermera tiene `porcentajePago` (default 67.5%)
- El dashboard calcula el pago como: costo visita * porcentaje

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

- Bucket privado en Cloudflare R2
- Upload: `POST /api/upload?folder=pacientes|visitas` con FormData
- Descarga: `GET /api/r2-file?key=...` → redirect a signed URL (1h)
- Carpetas: `pacientes/` (identificación, imágenes, PDFs) y `visitas/` (órdenes médicas)
- Límite: 10MB, tipos: JPEG, PNG, WebP, GIF + PDF (solo en pacientes)
- Componente: `<FileUpload>` en `src/components/file-upload.tsx`

---

## Email (Resend)

- Se usa para enviar itinerario de visitas a enfermeras
- El correo incluye detalle de cada visita: paciente, dirección, exámenes, procedimientos, talleres, adjuntos (órdenes médicas desde R2)
- `sendScheduledVisitsEmail()` envía a una enfermera
- `sendAllScheduledVisitsEmails()` envío masivo del día
- Archivos adjuntos se descargan de R2 y se incluyen inline en el email
- Todos los correos de salida llevan `cc` a `contacto@homelab.cl` (constante `CC_CORREOS_SALIDA`, override con `RESEND_CC_EMAIL`)

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
- `vercel-build`: ejecuta migraciones antes del build (`drizzle-kit migrate && next build`)
- Seed: `pnpm db:seed` (usa tsx con .env.local)

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

---

## Deuda Técnica

### Alta prioridad

1. **`PricingDb` tipado como `any`** en `src/lib/pricing/visitas.ts:25` — la conexión de DB se pasa como `any` para aceptar tanto Neon como postgres.js. Debería tener un tipo compartido o usar el tipo de Drizzle.

2. ~~Duplicación de lógica HTML entre cotización y cotización-standalone~~ — **Resuelto.** Ambos route handlers son mappers delgados sobre `buildCotizacionHTML()` en `src/lib/cotizacion-html.ts`; los tokens de marca del documento imprimible viven en `src/lib/brand.ts` (`DOC_TOKENS_CSS`, espejo de `homelab-tokens.css`).

3. **`SimpleDatePicker` solo se usa en playground** — El componente existe pero no se usa en producción. Evaluar si eliminarlo o adoptarlo.

### Media prioridad

4. **Catálogos siguen un patrón repetitivo** — `catalogos.ts` tiene ~500 líneas con CRUD casi idéntico para 6 entidades. Podría abstraerse en un factory genérico.

5. **Formularios sin react-hook-form** — Los formularios complejos (visita, cotización, paciente) manejan estado manualmente con muchos `useState`. Esto es funcional pero verboso. Considerar migrar a react-hook-form para gestión de estado en el cliente (la validación server-side con Zod ya está en place).

6. **Tests limitados** — Existen tests en `src/lib/actions/__tests__/` para catalogos, enfermeras, laboratorios y pricing, pero faltan tests para las funcionalidades más críticas (visitas CRUD, cotizaciones, asignación, email).

7. **NextAuth en versión beta** — `next-auth@5.0.0-beta.30` puede tener breaking changes. Monitorear para actualizar a la versión estable cuando salga.

### Baja prioridad

8. **Google Maps API key expuesta al cliente** — `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` es pública por necesidad (se usa en el browser), pero debería tener restricciones de dominio configuradas en la consola de Google Cloud.

9. **No hay rate limiting en API routes** — Los endpoints de upload y archivos no tienen rate limiting.

10. **No hay manejo de errores centralizado en server actions** — Cada action tiene su propio try/catch con `{ success: false, error }`. Un wrapper genérico reduciría la repetición.
