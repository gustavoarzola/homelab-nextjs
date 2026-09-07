# Paso 6 — Adjuntos del correo de programación

**Objetivo**: adjuntar los N archivos de cada visita con su nombre legible, deduplicados y
descargados en paralelo, y listarlos en el HTML.

Depende de: pasos 1, 3. Archivo central: `src/lib/actions/visitas-asignacion-email.ts`.

## 6.1 Traer los archivos por visita

`getVisitasConDetalles` (`:171-357`):
- Quitar `keyOrdenMedica: visits.keyOrdenMedica` del `select` (`:188`).
- Tras el `Promise.all` de items (`:235-263`), agregar una query:
  ```ts
  db.select({ idVisita: visitFiles.idVisita, key: visitFiles.key, contentType: visitFiles.contentType, orden: visitFiles.orden })
    .from(visitFiles).where(inArray(visitFiles.idVisita, visitaIds)).orderBy(asc(visitFiles.orden), asc(visitFiles.id))
  ```
- Agrupar en `filesByVisita = Map<number, { key, contentType }[]>`.
- En el `.map` final (`:316`): reemplazar `keyOrdenMedica: v.keyOrdenMedica ?? null` por
  `archivos: filesByVisita.get(v.visitaId) ?? []`.

Actualizar el tipo `VisitaConDetalles`: quitar `keyOrdenMedica`, agregar
`archivos: { key: string; contentType: string }[]`. (Grep de `keyOrdenMedica` en el repo para
cazar otros usos del tipo — debería ser solo este archivo y el HTML.)

## 6.2 Helper `buildVisitAttachments` (nuevo, en el mismo archivo o `src/lib/emails/`)

```ts
type EmailAttachment = { filename: string; content: Buffer; contentType?: string; contentId?: string }

export async function buildVisitAttachments(
  visitas: { archivos: { key: string; contentType: string }[] }[],
): Promise<EmailAttachment[]> {
  const keys = [...new Set(visitas.flatMap((v) => v.archivos.map((a) => a.key)))]  // dedup
  const results = await Promise.all(
    keys.map(async (key) => {
      try {
        const { buffer, contentType } = await getR2Object(key)
        return { filename: basename(key), content: buffer, contentType } satisfies EmailAttachment
      } catch (err) {
        console.error(`Error descargando adjunto ${key}:`, err)
        return null
      }
    }),
  )
  return results.filter((r): r is EmailAttachment => r !== null)
}
```

`basename` viene de `src/lib/archivos/nombres.ts` (paso 3). La key ya es
`visitas/v123_gustavo_arzola_1.jpg` → `filename` = `v123_gustavo_arzola_1.jpg`.

## 6.3 Usarlo en los dos envíos

- `EmailAttachment` (tipo local `:22`): agregar `contentType?: string` y pasarlo a Resend
  (`attachments` de Resend acepta `content_type`; revisar la firma actual de `resend.emails.send`
  en la versión instalada — hoy solo se pasa `{ filename, content }` y `{ path/contentId }` para
  el logo).
- `sendScheduledVisitsEmail` (`:383-394`): reemplazar el `for` por
  ```ts
  const attachments: EmailAttachment[] = [emailLogoAttachment(), ...(await buildVisitAttachments(enfermera.visitas))]
  ```
- `sendAllScheduledVisitsEmails` (`:445-456`): idéntico — **elimina el bloque duplicado literal**.

## 6.4 Fila "Adjuntos" en el HTML — `src/lib/emails/scheduled-visits-email-html.ts`

- Agregar `'Adjuntos'` a `rowLabels` (`:73-89`), después de `'Información adicional'` (índice 15).
- En `getValue` (`:33-71`), nuevo `case 15`:
  ```ts
  case 15: return v.archivos.length
    ? v.archivos.map((a) => `<div style="${examLineStyle}">${esc(basename(a.key))}</div>`).join('')
    : '—'
  ```
  (importar `basename`; `v.archivos` según el tipo actualizado en 6.1).
- Esto le da a la enfermera el puente adjunto (`v123_…_1.jpg`) ↔ columna `Visita #123`.

## 6.5 Tests

- `src/lib/emails/__tests__/scheduled-visits-email-html.test.ts`: el fixture (hoy fija
  `keyOrdenMedica: null`, `:23`) pasa a `archivos: []` y un caso con `archivos: [{ key: 'visitas/v1_juan_perez_1.jpg', contentType: 'image/jpeg' }]` → el HTML contiene
  `v1_juan_perez_1.jpg` y la fila "Adjuntos".
- Nuevo `src/lib/actions/__tests__/buildVisitAttachments.test.ts`: mock de `getR2Object`
  (`vi.mock('@/lib/r2')`); dos visitas que comparten una key → una sola descarga y un solo
  attachment; nombres = `basename(key)`; una key que lanza → se omite sin romper el resto.

## 6.6 Verificación

Manual: `/asignacion/envio-correos` con una visita en estado `confirmada` que tenga 2–3 fotos
→ correo recibido con esos adjuntos nombrados `v{id}_{nombre}_{n}.jpg` + logo, y la fila
"Adjuntos" en la tabla listándolos.
