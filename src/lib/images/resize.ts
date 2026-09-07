/**
 * Compresión y redimensionado de imágenes en el navegador, antes de subirlas.
 *
 * Las fotos de órdenes médicas y cédulas se adjuntan al correo de programación
 * de las enfermeras. Sin comprimir, una foto de celular pesa varios MB y un
 * correo con muchas visitas superaría el límite de Resend. Los parámetros están
 * juntos y exportados para poder calibrarlos con pruebas reales.
 *
 * Solo cliente — no importar desde código server.
 */

export const IMAGE_MAX_DIMENSION = 1600 // px del lado mayor
export const IMAGE_JPEG_QUALITY = 0.72 // calidad inicial (0..1)
export const IMAGE_QUALITY_FALLBACKS = [0.6, 0.5] // reintentos si el blob sigue pesando
export const IMAGE_TARGET_MAX_BYTES = 400 * 1024 // objetivo por imagen
export const IMAGE_OUTPUT_TYPE = 'image/jpeg'
export const IMAGE_OUTPUT_EXT = 'jpg'

export type ResizedImage = { blob: Blob; contentType: string; ext: string }

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Navegadores viejos no aceptan opciones
    return createImageBitmap(file)
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), IMAGE_OUTPUT_TYPE, quality)
  })
}

/**
 * Redimensiona y recomprime una imagen a JPEG. Devuelve `null` si `file` no es
 * una imagen (p.ej. un PDF): en ese caso el caller debe subir el archivo original.
 */
export async function resizeImage(file: File): Promise<ResizedImage | null> {
  if (!file.type.startsWith('image/')) return null

  const bitmap = await loadBitmap(file)
  try {
    const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    // Fondo blanco: PNG/GIF con transparencia → JPEG opaco
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)

    let best: Blob | null = null
    for (const quality of [IMAGE_JPEG_QUALITY, ...IMAGE_QUALITY_FALLBACKS]) {
      const blob = await canvasToBlob(canvas, quality)
      if (!blob) continue
      best = blob
      if (blob.size <= IMAGE_TARGET_MAX_BYTES) break
    }
    if (!best) return null

    return { blob: best, contentType: IMAGE_OUTPUT_TYPE, ext: IMAGE_OUTPUT_EXT }
  } finally {
    bitmap.close()
  }
}
