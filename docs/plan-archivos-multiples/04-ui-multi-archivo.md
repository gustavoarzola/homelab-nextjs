# Paso 4 — UI multi-archivo

**Objetivo**: nuevo componente `FilesUpload` (lista, drag & drop, quitar, reordenar) que
reemplaza a `FileUpload`, integrado en los formularios de visita y paciente.

Depende de: paso 2. Habilita: paso 5.

## 4.1 `src/components/files-upload.tsx` (nuevo)

Elimina `src/components/file-upload.tsx` (un solo archivo, sin `multiple`, sin drag & drop
real, sin borrar, y con fuga de `URL.createObjectURL` sin revocar en `:39`).

```ts
export type ArchivoItem = {
  id?: number                 // filas ya persistidas en DB (undefined = recién subida)
  key: string                 // 'tmp/…' recién subida, o la key definitiva si ya estaba
  nombreOriginal: string
  contentType: string
  tamano: number
  previewUrl: string | null   // objectURL local o signed URL del servidor
}

type Props = {
  folder: 'pacientes' | 'visitas'
  accept: string
  value: ArchivoItem[]
  onChange: (items: ArchivoItem[]) => void
  maxFiles?: number           // default 10
  disabled?: boolean
}
```

Comportamiento:
- **Entrada**: input `type="file" multiple accept={accept}` oculto + botón, **y** zona de drop
  real (`onDragOver`/`onDragEnter` marca estado visual, `onDragLeave` lo quita, `onDrop` lee
  `e.dataTransfer.files`). Ignora si `disabled` o si se supera `maxFiles`.
- **Por cada archivo entrante**:
  1. `resizeImage(file)` (`src/lib/images/resize.ts`). Si devuelve `ResizedImage`, subir el
     `blob` (con filename `foto.jpg`); si devuelve `null` (PDF), subir el `File` original.
  2. `POST /api/upload?folder={folder}` con `FormData`. Concurrencia limitada a 2–3
     simultáneas (cola simple).
  3. Al resolver: push a `value` un `ArchivoItem` con la `key` de `tmp/…` devuelta,
     `previewUrl = URL.createObjectURL(blobOriginalOComprimido)`, y la metadata de la respuesta.
  4. Estado por archivo: `subiendo` (spinner en su tile) / `error` (mensaje en su tile, con
     opción de reintentar o descartar).
- **Grilla de tiles**: miniatura (imagen) o icono `FileText` (PDF), `nombreOriginal` truncado,
  peso formateado (`formatBytes`), botón ✕ (quita del array), flechas ↑/↓ (swap con el vecino
  — el orden del array define el `_{n}` de la key final).
- **Cleanup**: `useEffect` de desmontaje que hace `URL.revokeObjectURL` de todos los
  `previewUrl` que sean `blob:`.
- Estilos con tokens del HomeLab DS (`var(--color-*)`, `--radius-*`) y primitivos `.hl-*`,
  igual que el componente actual. Revisar `src/app/(admin)/playground/page.tsx` por si hay un
  patrón de grilla/tile reutilizable.

Helper `formatBytes(n)`: si no existe en `src/lib/format.ts`, agregarlo ahí.

## 4.2 Integración en `src/components/visita-form.tsx`

Sección "Orden médica" (`:941-960`). Hoy:
```tsx
const [keyOrdenMedica, setKeyOrdenMedica] = useState<string | null>(visita?.keyOrdenMedica ?? null)  // :348
// prop signedUrlOrdenMedica?: string | null   // :78, :297
<input type="hidden" name="keyOrdenMedica" value={keyOrdenMedica ?? ''} />
<FileUpload folder="visitas" ... />
```

Nuevo:
```tsx
const [archivos, setArchivos] = useState<ArchivoItem[]>(props.archivos ?? [])
// prop: archivos?: ArchivoItem[]  (reemplaza signedUrlOrdenMedica)
...
<input type="hidden" name="archivos" value={JSON.stringify(archivos.map(serializeArchivo))} />
<FilesUpload folder="visitas" accept="image/jpeg,image/png,image/webp,image/gif"
  value={archivos} onChange={setArchivos} disabled={isPending} />
```
`serializeArchivo` = `{ key, nombreOriginal, contentType, tamano }` (sin `id`/`previewUrl`; el
paso 5 reconcilia por `key`). Copy del `<p>`: "Fotos de la orden médica. Se adjuntan al correo
de asignación. Se comprimen automáticamente."

## 4.3 Integración en `src/components/paciente-form.tsx`

Sección "Documento de identificación" (`:559-575`). Análogo:
- `const [keyIdentificacion, setKeyIdentificacion]` (`:211-213`) → `const [archivos, setArchivos] = useState<ArchivoItem[]>(props.archivos ?? [])`.
- prop `signedUrlIdentificacion` → `archivos?: ArchivoItem[]`.
- hidden `keyIdentificacion` → `name="archivos"` con JSON.
- `<FileUpload folder="pacientes" accept="…,application/pdf">` → `<FilesUpload …>` mismo accept.
- Copy: "Imágenes (JPG, PNG, WEBP) o PDF. Las imágenes se comprimen automáticamente."

## 4.4 Server components que arman los props

- `src/app/(admin)/visitas/[id]/editar/page.tsx:45-47,89` — hoy:
  `visita.keyOrdenMedica ? getSignedUrl(visita.keyOrdenMedica) : Promise.resolve(null)` dentro
  de un `Promise.all`, pasado como `signedUrlOrdenMedica`. Nuevo: `getVisita` (o la query de la
  página) trae `visitFiles` de la visita; mapear a `ArchivoItem[]` con
  `previewUrl: await getSignedUrl(f.key)` (mantener el `Promise.all`), pasar como `archivos`.
- `src/app/(admin)/pacientes/[id]/page.tsx:20-29` — `getSignedUrl(paciente.keyIdentificacion)`
  → mapear `patientFiles` a `ArchivoItem[]` igual.
- `src/app/(admin)/visitas/nueva/page.tsx` y `pacientes/nueva/*` — pasar `archivos={[]}` (o
  dejar que el default del form lo cubra).
- Ajustar `getVisita` (`src/lib/actions/visitas.ts`) y `getPaciente` (`pacientes.ts`) para
  incluir la lista de archivos en su retorno (nuevo campo `archivos`), y sus tipos `Row`/DTO.

## 4.5 Verificación

- `pnpm dev`, crear visita nueva: arrastrar 3 fotos → aparecen 3 tiles con preview, peso < 400
  KB c/u; reordenar; quitar una. El hidden `archivos` (inspeccionar en devtools) tiene el JSON
  con 2 items y keys `tmp/…`.
- Repetir en paciente con 2 imágenes + 1 PDF (el PDF muestra icono, no preview).
- Editar una visita/paciente que ya tenía archivo (tras la migración del paso 1): el tile
  aparece precargado con su signed URL.
