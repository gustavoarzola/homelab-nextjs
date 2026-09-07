# Paso 2 — Compresión de imágenes en cliente + `/api/upload`

**Objetivo**: comprimir/redimensionar imágenes en el navegador antes de subirlas, y que el
endpoint suba a un área de staging (`tmp/`) devolviendo metadata.

Depende de: nada. Habilita: pasos 4, 5.

## 2.1 `src/lib/images/resize.ts` (nuevo, módulo de cliente)

Parámetros explícitos y juntos para calibrarlos en pruebas:

```ts
export const IMAGE_MAX_DIMENSION = 1600          // px del lado mayor
export const IMAGE_JPEG_QUALITY = 0.72           // calidad inicial (0..1)
export const IMAGE_QUALITY_FALLBACKS = [0.6, 0.5] // reintentos si el blob sigue pesando
export const IMAGE_TARGET_MAX_BYTES = 400 * 1024 // objetivo por imagen
export const IMAGE_OUTPUT_TYPE = 'image/jpeg'
```

Rationale: 1600 px lado mayor + calidad 0.72 deja una foto de orden médica/cédula en
~200–350 KB, legible a pantalla completa en celular y desktop. Con ~4 archivos/paciente y
6–8 visitas, un correo de programación queda bajo el límite de Resend (~40 MB) con amplio
margen.

```ts
export type ResizedImage = { blob: Blob; contentType: string; ext: 'jpg' }

/**
 * Redimensiona y recomprime una imagen a JPEG. Devuelve null si `file` no es imagen
 * (p.ej. PDF), en cuyo caso el caller debe subir el archivo original tal cual.
 */
export async function resizeImage(file: File): Promise<ResizedImage | null>
```

Implementación:
1. Si `!file.type.startsWith('image/')` → `return null`.
2. `const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })` —
   resuelve la rotación EXIF de fotos de celular. Fallback: si `createImageBitmap` con opciones
   lanza (Safari viejo), reintentar sin opciones.
3. Calcular escala: `const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))`.
4. `canvas` (usar `OffscreenCanvas` si existe, si no `document.createElement('canvas')`) con
   `width = round(bitmap.width * scale)`, alto análogo; `ctx.drawImage(bitmap, 0, 0, w, h)`.
   Pintar fondo blanco antes (PNG con transparencia → JPEG).
5. `for (const q of [IMAGE_JPEG_QUALITY, ...IMAGE_QUALITY_FALLBACKS])`: generar blob
   (`canvas.convertToBlob` / `canvas.toBlob` promisificado) y quedarse con el primero
   `<= IMAGE_TARGET_MAX_BYTES`; si ninguno baja del objetivo, usar el último (menor calidad).
6. `bitmap.close()`. Devolver `{ blob, contentType: 'image/jpeg', ext: 'jpg' }`.

No agrega dependencias (todo Web API). Es solo cliente — no importar desde código server.

## 2.2 `src/app/api/upload/route.ts`

Cambios:

- **Key a staging**: `const key = \`tmp/${randomUUID()}.${ext}\`` (antes
  `${folder}/${uuid}.${ext}`). El id de la entidad no existe al crear; el paso 5 mueve de
  `tmp/` a la key definitiva.
- **Respuesta con metadata**:
  ```ts
  return NextResponse.json({
    key,
    nombreOriginal: file.name.slice(0, 255),
    contentType: file.type,
    tamano: file.size,
  })
  ```
- Mantener `requireSession()`, la validación de tipo por `folder` (`visitas` solo imágenes;
  `pacientes` imágenes + PDF) y el tope `MAX_SIZE_BYTES` (10 MB — ahora casi siempre se recibe
  ya comprimido, pero deja margen para PDF).
- `EXT_MAP` sin cambios (el cliente manda `image/jpeg` tras comprimir).
- Agregar al tope del archivo: `export const maxDuration = 30`.

El `folder` sigue viajando por querystring y se usa **solo para validar el tipo permitido**
(ya no para el prefijo de la key).

## 2.3 Verificación

- Unit no aplica bien a `resizeImage` (necesita canvas del browser). Verificación manual en el
  paso 4 (subir una foto real y medir el peso resultante en la respuesta / en R2).
- `curl -F file=@foto.jpg 'localhost:3000/api/upload?folder=visitas'` (con cookie de sesión) →
  respuesta con `key` bajo `tmp/` y los 4 campos.
