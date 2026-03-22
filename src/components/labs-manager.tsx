'use client'

import { useState, useTransition } from 'react'
import { Plus, Check, X, Pencil, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Lab = {
  id: number
  nombre: string
  activo: boolean
}

type Branch = {
  id: number
  nombre: string
  idLaboratorio: number | null
  activo: boolean
  labNombre: string | null
}

type Result = { success: boolean; error?: string }

type Props = {
  labs: Lab[]
  branches: Branch[]
  createCadena: (fd: FormData) => Promise<Result>
  updateCadena: (fd: FormData) => Promise<Result>
  toggleCadena: (id: number, activo: boolean) => Promise<Result>
  createSucursal: (fd: FormData) => Promise<Result>
  updateSucursal: (fd: FormData) => Promise<Result>
  toggleSucursal: (id: number, activo: boolean) => Promise<Result>
}

export function LabsManager({
  labs,
  branches,
  createCadena,
  updateCadena,
  toggleCadena,
  createSucursal,
  updateSucursal,
  toggleSucursal,
}: Props) {
  const [selectedLabId, setSelectedLabId] = useState<number | null>(null)

  const selectedLab = labs.find((l) => l.id === selectedLabId) ?? null
  const filteredBranches = selectedLabId
    ? branches.filter((b) => b.idLaboratorio === selectedLabId)
    : branches

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
      <CadenasPanel
        labs={labs}
        selectedLabId={selectedLabId}
        onSelectLab={setSelectedLabId}
        onCreate={createCadena}
        onUpdate={updateCadena}
        onToggle={toggleCadena}
      />
      <SucursalesPanel
        branches={filteredBranches}
        allBranches={branches}
        labs={labs}
        selectedLab={selectedLab}
        onCreate={createSucursal}
        onUpdate={updateSucursal}
        onToggle={toggleSucursal}
      />
    </div>
  )
}

// ─── Cadenas Panel ────────────────────────────────────────────────────────────

function CadenasPanel({
  labs,
  selectedLabId,
  onSelectLab,
  onCreate,
  onUpdate,
  onToggle,
}: {
  labs: Lab[]
  selectedLabId: number | null
  onSelectLab: (id: number | null) => void
  onCreate: (fd: FormData) => Promise<Result>
  onUpdate: (fd: FormData) => Promise<Result>
  onToggle: (id: number, activo: boolean) => Promise<Result>
}) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [addKey, setAddKey] = useState(0)
  const [isPending, startTransition] = useTransition()

  const handleAdd = (fd: FormData) => {
    startTransition(async () => {
      const r = await onCreate(fd)
      if (r.success) {
        setAddKey((k) => k + 1)
        toast.success('Cadena creada')
      } else toast.error(r.error)
    })
  }

  const handleUpdate = (fd: FormData) => {
    startTransition(async () => {
      const r = await onUpdate(fd)
      if (r.success) setEditingId(null)
      else toast.error(r.error)
    })
  }

  const handleToggle = (id: number, activo: boolean) => {
    startTransition(async () => {
      const r = await onToggle(id, activo)
      if (!r.success) toast.error(r.error)
    })
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Cadenas
          </h2>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Laboratorios y clínicas
          </p>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
        >
          {labs.length}
        </span>
      </div>

      {/* Add form */}
      <form
        key={addKey}
        action={handleAdd}
        className="flex gap-2 border-b px-4 py-3"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}
      >
        <input
          name="nombre"
          placeholder="Nombre de la cadena"
          required
          disabled={isPending}
          className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none disabled:opacity-50"
          style={{
            backgroundColor: 'var(--background)',
            border: '1px solid var(--input)',
            color: 'var(--foreground)',
          }}
        />
        <button
          type="submit"
          disabled={isPending}
          className="flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 hover:opacity-80 transition-opacity"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </button>
      </form>

      {/* Hint de selección */}
      {selectedLabId && (
        <div
          className="border-b px-4 py-2 text-xs"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: 'oklch(0.6 0.118 184.704 / 8%)',
            color: 'oklch(0.55 0.118 184.704)',
          }}
        >
          Mostrando sucursales de{' '}
          <strong>{labs.find((l) => l.id === selectedLabId)?.nombre}</strong>{' '}
          ·{' '}
          <button
            onClick={() => onSelectLab(null)}
            className="underline hover:no-underline"
          >
            Ver todas
          </button>
        </div>
      )}

      {/* Labs list */}
      {labs.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Sin cadenas. Agrega una arriba.
        </div>
      ) : (
        labs.map((lab) =>
          editingId === lab.id ? (
            <form
              key={lab.id}
              action={handleUpdate}
              className="flex items-center gap-2 border-b px-4 py-2 last:border-0"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}
            >
              <input type="hidden" name="id" value={lab.id} />
              <input
                name="nombre"
                defaultValue={lab.nombre}
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
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                <Check className="h-3 w-3" />
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                disabled={isPending}
                className="rounded-md px-2 py-1 text-xs hover:opacity-80 transition-opacity disabled:opacity-50"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <X className="h-3 w-3" />
              </button>
            </form>
          ) : (
            <button
              key={lab.id}
              onClick={() => onSelectLab(selectedLabId === lab.id ? null : lab.id)}
              className={cn(
                'w-full border-b px-4 py-3 text-left last:border-0 transition-colors hover:opacity-80',
                !lab.activo && 'opacity-50'
              )}
              style={{
                borderColor: 'var(--border)',
                backgroundColor:
                  selectedLabId === lab.id ? 'var(--accent)' : 'transparent',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2
                    className="h-4 w-4 shrink-0"
                    style={{ color: 'var(--muted-foreground)' }}
                  />
                  <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                    {lab.nombre}
                  </span>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setEditingId(lab.id)}
                    disabled={isPending}
                    className="rounded p-1 hover:opacity-80 transition-opacity disabled:opacity-30"
                    style={{ color: 'var(--muted-foreground)' }}
                    title="Editar"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleToggle(lab.id, lab.activo)}
                    disabled={isPending}
                    className="rounded-full px-2 py-0.5 text-xs font-medium hover:opacity-80 transition-opacity disabled:opacity-30"
                    style={
                      lab.activo
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
                    {lab.activo ? 'Inactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            </button>
          )
        )
      )}
    </div>
  )
}

// ─── Sucursales Panel ─────────────────────────────────────────────────────────

function SucursalesPanel({
  branches,
  allBranches,
  labs,
  selectedLab,
  onCreate,
  onUpdate,
  onToggle,
}: {
  branches: Branch[]
  allBranches: Branch[]
  labs: Lab[]
  selectedLab: Lab | null
  onCreate: (fd: FormData) => Promise<Result>
  onUpdate: (fd: FormData) => Promise<Result>
  onToggle: (id: number, activo: boolean) => Promise<Result>
}) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [addKey, setAddKey] = useState(0)
  const [isPending, startTransition] = useTransition()

  const activeLabs = labs.filter((l) => l.activo)

  const handleAdd = (fd: FormData) => {
    startTransition(async () => {
      const r = await onCreate(fd)
      if (r.success) {
        setAddKey((k) => k + 1)
        toast.success('Sucursal creada')
      } else toast.error(r.error)
    })
  }

  const handleUpdate = (fd: FormData) => {
    startTransition(async () => {
      const r = await onUpdate(fd)
      if (r.success) setEditingId(null)
      else toast.error(r.error)
    })
  }

  const handleToggle = (id: number, activo: boolean) => {
    startTransition(async () => {
      const r = await onToggle(id, activo)
      if (!r.success) toast.error(r.error)
    })
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Sucursales
            {selectedLab && (
              <span style={{ color: 'var(--muted-foreground)' }}>
                {' '}· {selectedLab.nombre}
              </span>
            )}
          </h2>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {selectedLab ? 'Filtradas por cadena seleccionada' : 'Todas las sucursales'}{' '}
            · {allBranches.length} total
          </p>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
        >
          {branches.length}
        </span>
      </div>

      {/* Add form */}
      <form
        key={addKey}
        action={handleAdd}
        className="flex gap-2 border-b px-4 py-3"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}
      >
        <input
          name="nombre"
          placeholder="Nombre de la sucursal"
          required
          disabled={isPending}
          className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none disabled:opacity-50"
          style={{
            backgroundColor: 'var(--background)',
            border: '1px solid var(--input)',
            color: 'var(--foreground)',
          }}
        />
        <select
          name="idLaboratorio"
          required
          defaultValue={selectedLab?.id ?? ''}
          disabled={isPending}
          className="rounded-lg px-3 py-1.5 text-sm outline-none disabled:opacity-50"
          style={{
            backgroundColor: 'var(--background)',
            border: '1px solid var(--input)',
            color: 'var(--foreground)',
          }}
        >
          <option value="" disabled>
            Cadena
          </option>
          {activeLabs.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nombre}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={isPending || activeLabs.length === 0}
          className="flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 hover:opacity-80 transition-opacity"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </button>
      </form>

      {/* Branches list */}
      {branches.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {selectedLab
            ? `Sin sucursales para ${selectedLab.nombre}.`
            : 'Sin sucursales. Agrega una arriba.'}
        </div>
      ) : (
        branches.map((branch) =>
          editingId === branch.id ? (
            <form
              key={branch.id}
              action={handleUpdate}
              className="flex items-center gap-2 border-b px-4 py-2 last:border-0"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--muted)' }}
            >
              <input type="hidden" name="id" value={branch.id} />
              <input
                name="nombre"
                defaultValue={branch.nombre}
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
              <select
                name="idLaboratorio"
                defaultValue={branch.idLaboratorio ?? ''}
                required
                disabled={isPending}
                className="rounded-md px-2 py-1 text-sm outline-none disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--background)',
                  border: '1px solid var(--ring)',
                  color: 'var(--foreground)',
                }}
              >
                {activeLabs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                <Check className="h-3 w-3" />
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                disabled={isPending}
                className="rounded-md px-2 py-1 text-xs hover:opacity-80 transition-opacity disabled:opacity-50"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <X className="h-3 w-3" />
              </button>
            </form>
          ) : (
            <div
              key={branch.id}
              className={cn(
                'flex items-center justify-between border-b px-4 py-3 last:border-0',
                !branch.activo && 'opacity-50'
              )}
              style={{ borderColor: 'var(--border)' }}
            >
              <div>
                <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                  {branch.labNombre} · {branch.nombre}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {branch.activo ? 'Activa' : 'Inactiva'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingId(branch.id)}
                  disabled={isPending}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:opacity-80 transition-opacity disabled:opacity-30"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </button>
                <button
                  onClick={() => handleToggle(branch.id, branch.activo)}
                  disabled={isPending}
                  className="rounded-md px-2.5 py-1 text-xs font-medium hover:opacity-80 transition-opacity disabled:opacity-30"
                  style={
                    branch.activo
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
                  {branch.activo ? 'Inactivar' : 'Activar'}
                </button>
              </div>
            </div>
          )
        )
      )}
    </div>
  )
}
