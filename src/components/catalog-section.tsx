'use client'

import { useState, useTransition } from 'react'
import { Plus, Check, X, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Item = {
  id: number
  nombre: string
  codigo?: string | null
  activo: boolean
}

type Result = { success: boolean; error?: string }

type Props = {
  items: Item[]
  hasCode?: boolean
  entityLabel: string
  onCreate: (formData: FormData) => Promise<Result>
  onUpdate: (formData: FormData) => Promise<Result>
  onToggle: (id: number, activo: boolean) => Promise<Result>
}

export function CatalogSection({
  items,
  hasCode,
  entityLabel,
  onCreate,
  onUpdate,
  onToggle,
}: Props) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [addKey, setAddKey] = useState(0)
  const [isPending, startTransition] = useTransition()

  const handleAdd = (formData: FormData) => {
    startTransition(async () => {
      const result = await onCreate(formData)
      if (result.success) {
        setAddKey((k) => k + 1)
        toast.success(`${entityLabel} agregado`)
      } else {
        toast.error(result.error ?? 'Error al agregar')
      }
    })
  }

  const handleUpdate = (formData: FormData) => {
    startTransition(async () => {
      const result = await onUpdate(formData)
      if (result.success) {
        setEditingId(null)
      } else {
        toast.error(result.error ?? 'Error al actualizar')
      }
    })
  }

  const handleToggle = (id: number, activo: boolean) => {
    startTransition(async () => {
      const result = await onToggle(id, activo)
      if (!result.success) toast.error(result.error ?? 'Error')
    })
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
    >
      {/* Add form */}
      <form
        key={addKey}
        onSubmit={(e) => { e.preventDefault(); handleAdd(new FormData(e.currentTarget)) }}
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}
      >
        <input
          name="nombre"
          placeholder={`Nombre del ${entityLabel.toLowerCase()}`}
          required
          disabled={isPending}
          className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none disabled:opacity-50"
          style={{
            backgroundColor: 'var(--background)',
            border: '1px solid var(--input)',
            color: 'var(--foreground)',
          }}
        />
        {hasCode && (
          <input
            name="codigo"
            placeholder="Código"
            required
            disabled={isPending}
            className="w-28 rounded-lg px-3 py-1.5 text-sm outline-none disabled:opacity-50"
            style={{
              backgroundColor: 'var(--background)',
              border: '1px solid var(--input)',
              color: 'var(--foreground)',
            }}
          />
        )}
        <button
          type="submit"
          disabled={isPending}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 transition-opacity hover:opacity-80"
          style={{
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)',
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </button>
      </form>

      {/* Header row */}
      <div
        className="grid gap-0 border-b px-4 py-2"
        style={{
          borderColor: 'var(--border)',
          gridTemplateColumns: hasCode ? '1fr 7rem 6rem 9rem' : '1fr 6rem 9rem',
        }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
          NOMBRE
        </span>
        {hasCode && (
          <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
            CÓDIGO
          </span>
        )}
        <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
          ESTADO
        </span>
        <span />
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div
          className="px-4 py-10 text-center text-sm"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Sin registros. Agrega uno arriba.
        </div>
      ) : (
        <div>
          {items.map((item) =>
            editingId === item.id ? (
              /* ── Edit mode ── */
              <form
                key={item.id}
                onSubmit={(e) => { e.preventDefault(); handleUpdate(new FormData(e.currentTarget)) }}
                className="flex items-center gap-2 border-b px-4 py-2"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}
              >
                <input type="hidden" name="id" value={item.id} />
                <input
                  name="nombre"
                  defaultValue={item.nombre}
                  required
                  autoFocus
                  disabled={isPending}
                  className="flex-1 rounded-md px-2 py-1 text-sm outline-none disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--ring)',
                    color: 'var(--foreground)',
                  }}
                />
                {hasCode && (
                  <input
                    name="codigo"
                    defaultValue={item.codigo ?? ''}
                    required
                    disabled={isPending}
                    className="w-28 rounded-md px-2 py-1 text-sm outline-none disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--background)',
                      border: '1px solid var(--ring)',
                      color: 'var(--foreground)',
                    }}
                  />
                )}
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50 hover:opacity-80 transition-opacity"
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                  }}
                >
                  <Check className="h-3 w-3" />
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  disabled={isPending}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--muted)',
                    color: 'var(--muted-foreground)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <X className="h-3 w-3" />
                  Cancelar
                </button>
              </form>
            ) : (
              /* ── View mode ── */
              <div
                key={item.id}
                className={cn(
                  'grid items-center gap-0 border-b px-4 py-3 last:border-0',
                  !item.activo && 'opacity-50'
                )}
                style={{
                  borderColor: 'var(--border)',
                  gridTemplateColumns: hasCode ? '1fr 7rem 6rem 9rem' : '1fr 6rem 9rem',
                }}
              >
                <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                  {item.nombre}
                </span>

                {hasCode && (
                  <code
                    className="w-fit rounded px-1.5 py-0.5 text-xs"
                    style={{
                      backgroundColor: 'var(--muted)',
                      color: 'var(--muted-foreground)',
                    }}
                  >
                    {item.codigo}
                  </code>
                )}

                <span
                  className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  style={
                    item.activo
                      ? {
                          backgroundColor: 'oklch(0.6 0.118 184.704 / 15%)',
                          color: 'oklch(0.55 0.118 184.704)',
                        }
                      : {
                          backgroundColor: 'var(--muted)',
                          color: 'var(--muted-foreground)',
                        }
                  }
                >
                  {item.activo ? 'Activo' : 'Inactivo'}
                </span>

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setEditingId(item.id)}
                    disabled={isPending}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:opacity-80 transition-opacity disabled:opacity-30"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggle(item.id, item.activo)}
                    disabled={isPending}
                    className="rounded-md px-2.5 py-1 text-xs font-medium hover:opacity-80 transition-opacity disabled:opacity-30"
                    style={
                      item.activo
                        ? {
                            backgroundColor: 'oklch(0.577 0.245 27.325 / 10%)',
                            color: 'var(--destructive)',
                          }
                        : {
                            backgroundColor: 'oklch(0.6 0.118 184.704 / 15%)',
                            color: 'oklch(0.55 0.118 184.704)',
                          }
                    }
                  >
                    {item.activo ? 'Inactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
