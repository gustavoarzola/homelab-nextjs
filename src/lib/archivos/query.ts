import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { visitFiles, patientFiles } from '@/db/schema'
import { getSignedUrl } from '@/lib/r2'

export type ArchivoDTO = {
  id: number
  key: string
  nombreOriginal: string | null
  contentType: string
  tamano: number
  signedUrl: string | null
}

async function withSignedUrls(
  rows: { id: number; key: string; nombreOriginal: string | null; contentType: string; tamano: number }[],
): Promise<ArchivoDTO[]> {
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      signedUrl: await getSignedUrl(row.key).catch(() => null),
    })),
  )
}

export async function getArchivosVisita(idVisita: number): Promise<ArchivoDTO[]> {
  const rows = await db
    .select({
      id: visitFiles.id,
      key: visitFiles.key,
      nombreOriginal: visitFiles.nombreOriginal,
      contentType: visitFiles.contentType,
      tamano: visitFiles.tamano,
    })
    .from(visitFiles)
    .where(eq(visitFiles.idVisita, idVisita))
    .orderBy(asc(visitFiles.orden), asc(visitFiles.id))
  return withSignedUrls(rows)
}

export async function getArchivosPaciente(idPaciente: number): Promise<ArchivoDTO[]> {
  const rows = await db
    .select({
      id: patientFiles.id,
      key: patientFiles.key,
      nombreOriginal: patientFiles.nombreOriginal,
      contentType: patientFiles.contentType,
      tamano: patientFiles.tamano,
    })
    .from(patientFiles)
    .where(eq(patientFiles.idPaciente, idPaciente))
    .orderBy(asc(patientFiles.orden), asc(patientFiles.id))
  return withSignedUrls(rows)
}
