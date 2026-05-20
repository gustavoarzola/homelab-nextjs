'use client'

import { useRef, useState } from 'react'
import { Loader2, Upload, FileText } from 'lucide-react'

type Props = {
  folder: 'pacientes' | 'visitas'
  accept: string
  currentKey: string | null
  signedUrl?: string | null
  onUploaded: (key: string) => void
  disabled?: boolean
}

export function FileUpload({ folder, accept, currentKey, signedUrl, onUploaded, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(signedUrl ?? null)
  const [isImage, setIsImage] = useState<boolean>(!currentKey || !currentKey.endsWith('.pdf'))

  const handleFile = async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/upload?folder=${folder}`, { method: 'POST', body: fd })
      if (!res.ok) {
        const body = await res.json()
        setError(body.error ?? 'Error al subir')
        return
      }
      const { key } = await res.json()
      onUploaded(key)
      setIsImage(!key.endsWith('.pdf'))
      if (file.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(file))
      } else {
        setPreviewUrl(null)
      }
    } catch {
      setError('Error de red al subir el archivo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />

      {currentKey && (
        <div
          className="flex items-center gap-3 rounded-lg p-3"
          style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          {previewUrl && isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Archivo adjunto"
              className="h-16 w-16 rounded object-cover shrink-0"
              style={{ border: '1px solid var(--border)' }}
            />
          ) : (
            <FileText className="h-8 w-8 shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          )}
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              Archivo actual
            </span>
            {previewUrl && !isImage && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs hover:underline truncate"
                style={{ color: 'var(--primary)' }}
              >
                Ver documento
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || uploading}
            className="ml-auto shrink-0 rounded px-2.5 py-1 text-xs hover:opacity-80 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            Reemplazar
          </button>
        </div>
      )}

      {!currentKey && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading}
          className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:opacity-80 transition-opacity disabled:opacity-50 w-fit"
          style={{ border: '1px dashed var(--border)', color: 'var(--muted-foreground)' }}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? 'Subiendo...' : 'Subir archivo'}
        </button>
      )}

      {uploading && currentKey && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Subiendo...
        </div>
      )}

      {error && (
        <p className="text-xs" style={{ color: 'var(--destructive)' }}>{error}</p>
      )}
    </div>
  )
}
