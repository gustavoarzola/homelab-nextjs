'use client'

import { useRef, useState } from 'react'
import { Loader2, Upload, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
        <div className="flex items-center gap-3" style={{ background: 'var(--color-surface-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
          {previewUrl && isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Archivo adjunto"
              className="h-16 w-16 shrink-0 object-cover"
              style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
            />
          ) : (
            <FileText className="shrink-0" style={{ width: 32, height: 32, color: 'var(--color-fg-muted)' }} />
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>Archivo actual</span>
            {previewUrl && !isImage && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:underline"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary)' }}
              >
                Ver documento
              </a>
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="ml-auto shrink-0"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || uploading}
          >
            Reemplazar
          </Button>
        </div>
      )}

      {!currentKey && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading}
          className="flex w-fit items-center gap-2 transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ border: '1px dashed var(--color-border)', color: 'var(--color-fg-muted)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: 'var(--text-base)', background: 'transparent' }}
        >
          {uploading ? <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> : <Upload style={{ width: 16, height: 16 }} />}
          {uploading ? 'Subiendo...' : 'Subir archivo'}
        </button>
      )}

      {uploading && currentKey && (
        <div className="flex items-center gap-2" style={{ fontSize: 'var(--text-base)', color: 'var(--color-fg-muted)' }}>
          <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />
          Subiendo...
        </div>
      )}

      {error && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-destructive)' }}>{error}</p>
      )}
    </div>
  )
}
