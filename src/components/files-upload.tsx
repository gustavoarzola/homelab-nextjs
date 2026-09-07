'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, Upload, FileText, X, ArrowUp, ArrowDown, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resizeImage } from '@/lib/images/resize'
import { formatBytes } from '@/lib/format'

export type ArchivoItem = {
  id?: number // fila ya persistida en DB
  key: string // 'tmp/…' recién subida, o la key definitiva si ya estaba
  nombreOriginal: string
  contentType: string
  tamano: number
  previewUrl: string | null // objectURL local o signed URL del servidor
}

type Props = {
  folder: 'pacientes' | 'visitas'
  accept: string
  value: ArchivoItem[]
  onChange: (items: ArchivoItem[]) => void
  maxFiles?: number
  disabled?: boolean
}

type Pending = {
  tempId: string
  nombreOriginal: string
  previewUrl: string | null
  error: string | null
}

const UPLOAD_CONCURRENCY = 3

export function FilesUpload({ folder, accept, value, onChange, maxFiles = 10, disabled }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Pending[]>([])
  const [dragging, setDragging] = useState(false)
  // objectURLs creados aquí, para revocarlos al desmontar
  const objectUrls = useRef<Set<string>>(new Set())

  useEffect(() => {
    const urls = objectUrls.current
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
    }
  }, [])

  const makeObjectUrl = (blob: Blob): string => {
    const url = URL.createObjectURL(blob)
    objectUrls.current.add(url)
    return url
  }

  const uploadOne = useCallback(
    async (file: File): Promise<ArchivoItem | null> => {
      const resized = await resizeImage(file).catch(() => null)
      const body = resized?.blob ?? file
      const previewSource: Blob | null = file.type.startsWith('image/') ? (resized?.blob ?? file) : null

      const fd = new FormData()
      fd.append('file', body, resized ? `${stripExt(file.name)}.${resized.ext}` : file.name)

      const res = await fetch(`/api/upload?folder=${folder}`, { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Error al subir')
      }
      const data = (await res.json()) as {
        key: string
        nombreOriginal: string
        contentType: string
        tamano: number
      }
      return {
        key: data.key,
        nombreOriginal: file.name,
        contentType: data.contentType,
        tamano: data.tamano,
        previewUrl: previewSource ? makeObjectUrl(previewSource) : null,
      }
    },
    [folder],
  )

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (disabled || files.length === 0) return
      const room = maxFiles - value.length
      const batch = files.slice(0, Math.max(0, room))
      if (batch.length === 0) return

      const entries: Pending[] = batch.map((file) => ({
        tempId: crypto.randomUUID(),
        nombreOriginal: file.name,
        previewUrl: file.type.startsWith('image/') ? makeObjectUrl(file) : null,
        error: null,
      }))
      setPending((p) => [...p, ...entries])

      // Cola con concurrencia limitada
      const queue = batch.map((file, i) => ({ file, entry: entries[i]! }))
      let cursor = 0
      const added: ArchivoItem[] = []
      const worker = async () => {
        while (cursor < queue.length) {
          const { file, entry } = queue[cursor++]!
          try {
            const item = await uploadOne(file)
            if (item) added.push(item)
            setPending((p) => p.filter((x) => x.tempId !== entry.tempId))
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Error al subir'
            setPending((p) => p.map((x) => (x.tempId === entry.tempId ? { ...x, error: msg } : x)))
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, queue.length) }, worker))
      if (added.length > 0) onChange([...value, ...added])
    },
    [disabled, maxFiles, value, uploadOne, onChange],
  )

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx))
  }

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= value.length) return
    const next = [...value]
    const a = next[idx]!
    const b = next[target]!
    next[idx] = b
    next[target] = a
    onChange(next)
  }

  const atLimit = value.length + pending.length >= maxFiles

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />

      {(value.length > 0 || pending.length > 0) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 10,
          }}
        >
          {value.map((item, idx) => (
            <div
              key={item.key}
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                background: 'var(--color-surface-muted)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  height: 96,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--color-surface)',
                }}
              >
                {item.previewUrl && item.contentType.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt={item.nombreOriginal}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <FileText style={{ width: 32, height: 32, color: 'var(--color-fg-muted)' }} />
                )}
              </div>
              <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span
                  className="truncate"
                  style={{ fontSize: 'var(--text-xs)', fontWeight: 500 }}
                  title={item.nombreOriginal}
                >
                  {item.nombreOriginal}
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>
                  {formatBytes(item.tamano)}
                </span>
                <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={disabled || idx === 0}
                    className="disabled:opacity-30"
                    title="Subir"
                    style={iconBtnStyle}
                  >
                    <ArrowUp style={{ width: 13, height: 13 }} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={disabled || idx === value.length - 1}
                    className="disabled:opacity-30"
                    title="Bajar"
                    style={iconBtnStyle}
                  >
                    <ArrowDown style={{ width: 13, height: 13 }} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    disabled={disabled}
                    className="ml-auto disabled:opacity-30"
                    title="Quitar"
                    style={{ ...iconBtnStyle, color: 'var(--color-destructive)' }}
                  >
                    <X style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {pending.map((p) => (
            <div
              key={p.tempId}
              style={{
                border: '1px dashed var(--color-border)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                background: 'var(--color-surface-muted)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  height: 96,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {p.error ? (
                  <AlertCircle style={{ width: 26, height: 26, color: 'var(--color-destructive)' }} />
                ) : (
                  <Loader2
                    className="animate-spin"
                    style={{ width: 22, height: 22, color: 'var(--color-fg-muted)' }}
                  />
                )}
              </div>
              <div style={{ padding: '6px 8px' }}>
                <span
                  className="truncate"
                  style={{ fontSize: 'var(--text-xs)', display: 'block' }}
                  title={p.nombreOriginal}
                >
                  {p.nombreOriginal}
                </span>
                {p.error ? (
                  <span
                    style={{ fontSize: 'var(--text-xs)', color: 'var(--color-destructive)' }}
                  >
                    {p.error}{' '}
                    <button
                      type="button"
                      onClick={() => setPending((prev) => prev.filter((x) => x.tempId !== p.tempId))}
                      style={{ textDecoration: 'underline' }}
                    >
                      descartar
                    </button>
                  </span>
                ) : (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>
                    Subiendo…
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!atLimit && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            if (!disabled) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            void handleFiles(Array.from(e.dataTransfer.files))
          }}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click()
          }}
          style={{
            border: `1px dashed ${dragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
            background: dragging ? 'var(--color-surface-muted)' : 'transparent',
            color: 'var(--color-fg-muted)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: 'var(--text-base)',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <Upload style={{ width: 16, height: 16 }} />
          Arrastra imágenes aquí o haz clic para seleccionar
        </div>
      )}

      {atLimit && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>
          Máximo {maxFiles} archivos.
        </p>
      )}
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  padding: 3,
  background: 'var(--color-surface)',
  color: 'var(--color-fg-muted)',
  lineHeight: 0,
}

function stripExt(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

/** Serializa un ArchivoItem al shape que recibe la server action (sin id/previewUrl). */
export function serializeArchivos(items: ArchivoItem[]): string {
  return JSON.stringify(
    items.map((i) => ({
      key: i.key,
      nombreOriginal: i.nombreOriginal,
      contentType: i.contentType,
      tamano: i.tamano,
    })),
  )
}

/** Mapea la lista que devuelve el servidor (ArchivoDTO) a ArchivoItem para el form. */
export function archivosFromDTO(
  dtos: {
    id: number
    key: string
    nombreOriginal: string | null
    contentType: string
    tamano: number
    signedUrl: string | null
  }[],
): ArchivoItem[] {
  return dtos.map((d) => ({
    id: d.id,
    key: d.key,
    nombreOriginal: d.nombreOriginal ?? d.key.split('/').pop() ?? 'archivo',
    contentType: d.contentType,
    tamano: d.tamano,
    previewUrl: d.signedUrl,
  }))
}
