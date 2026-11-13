import { getR2Object } from '@/lib/r2'
import { basename } from '@/lib/archivos/nombres'

export type EmailAttachment = { filename: string; content: Buffer; contentType?: string; contentId?: string }

export type ArchivoCorreo = { key: string; contentType: string }

/**
 * Descarga (una sola vez por key) los adjuntos de todas las visitas y los
 * devuelve listos para Resend. El `filename` es la key legible ya renombrada
 * (`v123_gustavo_arzola_1.jpg`).
 *
 * Vive fuera de `src/lib/actions/` (archivos `'use server'`) a propósito: es un
 * helper sin guard de sesión y no debe quedar expuesto como server action.
 */
export async function buildVisitAttachments(
  visitas: { archivos: ArchivoCorreo[] }[],
): Promise<EmailAttachment[]> {
  const keys = [...new Set(visitas.flatMap((v) => v.archivos.map((a) => a.key)))]
  const results = await Promise.all(
    keys.map(async (key): Promise<EmailAttachment | null> => {
      try {
        const { buffer, contentType } = await getR2Object(key)
        return { filename: basename(key), content: buffer, contentType }
      } catch (err) {
        console.error(`Error descargando adjunto ${key}:`, err)
        return null
      }
    }),
  )
  return results.filter((r): r is EmailAttachment => r !== null)
}
