# Plan: Adjuntos múltiples con nombres legibles (visitas y pacientes)

Este directorio divide el trabajo en **pasos ejecutables por separado**. Cada archivo
`0X-*.md` es autocontenido (incluye el contexto necesario) para poder ejecutarse en una
sesión nueva sin re-explorar el código. Ejecutar en orden.

| Paso | Archivo | Depende de |
|---|---|---|
| 1 | `01-modelo-datos.md` — tablas `archivos_visitas` / `archivos_pacientes`, backfill, drop columnas | — |
| 2 | `02-imagenes-y-upload.md` — compresión en cliente + `/api/upload` a `tmp/` con metadata | — |
| 3 | `03-nombres-y-sync-r2.md` — `slugify`, `buildArchivoKey`, helpers R2, `syncArchivos*` | 1, 2 |
| 4 | `04-ui-multi-archivo.md` — `FilesUpload`, integración en forms de visita/paciente | 2 |
| 5 | `05-server-actions.md` — contrato FormData `archivos`, reconciliación en create/update | 1, 3, 4 |
| 6 | `06-correo-adjuntos.md` — `buildVisitAttachments`, fila "Adjuntos" en el HTML | 1, 3 |
| 7 | `07-migracion-nombres-existentes.md` — script one-off de renombrado + limpieza | 3, 5 |

## Por qué

Hoy cada visita y cada paciente admite **un solo archivo**: `visitas.key_orden_medica` y
`pacientes.key_identificacion`, ambas `varchar(500)` nullable, con una key UUID plana
(`visitas/<uuid>.jpg`). El nombre original del archivo se descarta en
`src/app/api/upload/route.ts:49-50` y nunca se persiste. No existe tabla de adjuntos.

El cliente necesita subir **varias fotos** por visita y por paciente (fotos de órdenes médicas
y de cédulas). Esos archivos se adjuntan al correo de programación que reciben las enfermeras
(`src/lib/actions/visitas-asignacion-email.ts`); hoy se renombran a `visita-${id}.${ext}` en
**dos bloques duplicados** (líneas ~389 y ~451), sin deduplicación, con descargas secuenciales,
y el HTML del correo no menciona los adjuntos. Con N archivos por visita ese nombre deja de
alcanzar.

Resultado buscado: subir varios archivos, **comprimidos en el navegador** a un peso razonable,
guardados en R2 con **nombre físico legible** `v123_gustavo_arzola_1.jpg` /
`p456_gustavo_arzola_1.jpg`, y adjuntados al correo con ese mismo nombre.

## Decisiones tomadas (fijas)

| Tema | Decisión |
|---|---|
| Nombres | **Ambos**: key física legible en R2 *y* filename legible en correo/descarga |
| Alcance | Visitas **y** pacientes, mismo modelo de datos y mismo componente de UI |
| Peso del correo | Resize + recompresión **en el navegador antes de subir** (no `sharp` en server) |
| Columnas viejas | Backfill a la nueva tabla y **DROP** de `key_orden_medica` / `key_identificacion` |
| Formato de salida | Todas las imágenes se normalizan a **JPEG**; los PDF (solo pacientes) pasan intactos |

## Bugs que se corrigen de paso

1. **`createVisita` nunca persiste `keyOrdenMedica`** (`src/lib/actions/visitas.ts:776-779`
   `visitaCreateSchema` no lo incluye; `:998-1006` el `insert` no lo escribe). Subir la orden
   médica al *crear* una visita deja hoy el objeto huérfano en R2 y la visita con `NULL`.
2. En producción (Vercel) el body de un route handler está limitado a ~4.5 MB, pero
   `/api/upload` declara un tope de 10 MB: una foto de celular grande falla hoy. Comprimir en
   el navegador lo resuelve.
3. `src/app/api/r2-file/route.ts` firma **cualquier** key del bucket para cualquier sesión
   (sin validar prefijo `pacientes/` | `visitas/`). Se arregla en el paso 7.

---

## Referencia compartida

### Convención de nombres (key física en R2)

```
visitas/v{idVisita}_{primerNombre}_{apellidoPaterno}_{n}.{ext}     → v123_gustavo_arzola_1.jpg
pacientes/p{idPaciente}_{primerNombre}_{apellidoPaterno}_{n}.{ext} → p456_gustavo_arzola_1.jpg
tmp/{uuid}.{ext}                                                    → staging al subir
```

- `{n}` = posición **1-based** del archivo dentro de la entidad (columna `orden`).
- Para una visita, el nombre usado es el de **su** paciente (`visitas.id_paciente`).
- Slug de cada parte: `NFD` → quitar diacríticos → `toLowerCase` → solo `[a-z0-9]` (lo demás
  a `-`, colapsar y recortar). Sin apellido materno ni segundo nombre. Si una parte queda
  vacía, usar `x`.
- `ext`: `jpg` para imágenes (ya normalizadas a JPEG), `pdf` para PDF.

### Infra actual relevante

- **Upload UI**: `src/components/file-upload.tsx` — un solo archivo, sin `multiple`, sin drag &
  drop real, sin botón de borrar. Se elimina en el paso 4.
- **Endpoint**: `src/app/api/upload/route.ts` — `requireSession()`, `folder` ∈
  {`pacientes`,`visitas`} por querystring; `pacientes` acepta imágenes + PDF, `visitas` solo
  imágenes; tope 10 MB; `EXT_MAP` por MIME; key = `${folder}/${randomUUID()}.${ext}`; responde
  `{ key }`.
- **R2**: `src/lib/r2.ts` — `uploadToR2(buffer,key,contentType)`, `getSignedUrl(key, ttl=3600)`,
  `getR2Object(key) → { buffer, contentType }`. Cliente S3 v3 contra endpoint de Cloudflare.
- **Proxy de lectura**: `src/app/api/r2-file/route.ts` — redirect a signed URL (sin uso real
  hoy; las signed URLs se generan en server components).
- **Persistencia hoy**:
  - `patients.keyIdentificacion` = `varchar('key_identificacion', {length:500})`
    (`schema.ts:132`). Form: `src/components/paciente-form.tsx:559-575`, hidden
    `name="keyIdentificacion"`. Schema: `pacienteBaseSchema` (`pacientes.ts:81`,
    `keyIdentificacion: fields.nullableStr`); insert `pacientes.ts:317-321`, update `:393-397`.
  - `visits.keyOrdenMedica` = `varchar('key_orden_medica', {length:500})` (`schema.ts:312`).
    Form: `src/components/visita-form.tsx:942-959`, hidden `name="keyOrdenMedica"`. Schema:
    `visitaUpdateSchema` (`visitas.ts:783`) — **no** está en `visitaCreateSchema`. Update lo
    escribe (`:837`); create no.
- **Validación**: `src/lib/validation.ts` — `parseFormData` / `parseFormDataWithArrays` hacen
  `Object.fromEntries(formData)` (nombres repetidos colapsan → se usa **un hidden con JSON**).
  `fields.nullableStr = z.string().trim().optional().transform(v => v || null)`.
- **Correo**: `src/lib/actions/visitas-asignacion-email.ts` — único archivo del repo que usa
  `Resend`. `getVisitasConDetalles(fecha, nurseIds)` (`:171-357`) trae `keyOrdenMedica`
  (`:188`, `:319`). Adjuntos: `EmailAttachment = { filename, content: Buffer, contentId? }`
  (sin `contentType`). Bloque duplicado literal en `sendScheduledVisitsEmail` (`:383-394`) y
  `sendAllScheduledVisitsEmails` (`:445-456`). `getR2Object` se llama secuencialmente en un
  `for`. El logo inline va siempre primero (`emailLogoAttachment()`).
- **HTML del correo**: `src/lib/emails/scheduled-visits-email-html.ts` — puro, testeado en
  `src/lib/emails/__tests__/scheduled-visits-email-html.test.ts`. `rowLabels` (`:73-89`) define
  las filas de la tabla; cabecera de columna por visita `Visita #${v.id}` (`:93`). No hay fila
  de adjuntos.
- **Helpers de nombre**: `src/lib/paciente.ts` `formatNombre` (`"Apellido…, Nombres"`, con coma
  — no apto para filename). `src/lib/comunas.ts:8-16` `normalizeComuna` — única lógica de
  quitado de acentos del proyecto (se refactoriza para consumir `stripDiacritics`).
- **Migraciones**: `src/db/migrations/` (`drizzle-kit generate` + `drizzle-kit migrate`). DB
  local vía Docker (postgres.js); Neon en Vercel.
- **Scripts one-off**: patrón `tsx --env-file=.env.local src/db/xxx.ts` (ver `db:seed` en
  `package.json`).

## Verificación global (al terminar todos los pasos)

- `pnpm test` verde (tests nuevos de `slug`, `nombres`, `sync/planRenames`,
  `buildVisitAttachments`, HTML de correo actualizado).
- `pnpm build` (typecheck) verde.
- `pnpm drizzle-kit migrate` en DB local: `archivos_visitas` / `archivos_pacientes` con una
  fila por cada key previa; columnas viejas ya no existen.
- E2E manual (skill `verify`): flujo 1–6 de `07-*.md` / sección de verificación del plan raíz.
