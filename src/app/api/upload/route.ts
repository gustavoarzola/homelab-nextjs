import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireSession } from '@/lib/auth-guard'
import { uploadToR2 } from '@/lib/r2'

export const maxDuration = 30

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_PDF_TYPES = ['application/pdf']
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
}

export async function POST(req: NextRequest) {
  try {
    await requireSession()
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const folder = req.nextUrl.searchParams.get('folder')
  if (folder !== 'pacientes' && folder !== 'visitas') {
    return NextResponse.json({ error: 'Carpeta inválida' }, { status: 400 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
  }

  const allowedTypes =
    folder === 'pacientes'
      ? [...ALLOWED_IMAGE_TYPES, ...ALLOWED_PDF_TYPES]
      : ALLOWED_IMAGE_TYPES

  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: `Tipo de archivo no permitido: ${file.type}` }, { status: 400 })
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'El archivo supera el límite de 10 MB' }, { status: 400 })
  }

  const ext = EXT_MAP[file.type]
  // Área de staging: al crear una visita/paciente su id todavía no existe. La
  // server action mueve el objeto a su key definitiva (visitas/v123_… ) al guardar.
  const key = `tmp/${randomUUID()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  await uploadToR2(buffer, key, file.type)

  return NextResponse.json({
    key,
    nombreOriginal: file.name.slice(0, 255),
    contentType: file.type,
    tamano: file.size,
  })
}
