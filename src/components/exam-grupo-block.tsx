'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, X, Search, AlertCircle, ChevronDown } from 'lucide-react'
import { EXAM_GRUPO_META, EXAM_GRUPOS } from '@/lib/exam-grupos'
import type { ExamGrupo } from '@/lib/exam-grupos'
import type { ExamenRow } from '@/lib/actions/catalogos'
import type { IsaprePrevisionRow } from '@/lib/actions/catalogos'

// ─── Types ────────────────────────────────────────────────────────────────────

type CatalogoExam = {
  tipo: 'catalogo'
  id: number
  codigo: string
  nombre: string
  precio: number
}

type IsapreExam = {
  tipo: 'isapre'
  id: number
  codigo: string
  nombre: string
  valor: string
  valorPagar: string
}

export type ExamGroupItem = CatalogoExam | IsapreExam

export type ExamGroup = {
  grupoId: ExamGrupo
  idPrevision: number | null
  exams: ExamGroupItem[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onOut])
}

const formatCLP = (n: number) =>
  n > 0 ? `$${n.toLocaleString('es-CL')}` : '$0'

const parseNum = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0

function formatThousands(raw: string): string {
  const n = parseNum(raw)
  return n > 0 ? n.toLocaleString('es-CL') : ''
}

// ─── MoneyField ───────────────────────────────────────────────────────────────

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1.5 shrink-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 rounded-md pl-2 pr-1.5 h-8 border border-input bg-background">
        <span className="text-[12px] text-muted-foreground">$</span>
        <input
          value={formatThousands(value)}
          onChange={(e) => onChange(String(parseNum(e.target.value) || ''))}
          placeholder="0"
          inputMode="numeric"
          className="w-[72px] bg-transparent text-right text-[13px] tabular-nums outline-none text-foreground"
        />
      </span>
    </label>
  )
}

// ─── ExamPicker ───────────────────────────────────────────────────────────────

function ExamPicker({
  grupoId,
  allExams,
  takenIds,
  onPick,
}: {
  grupoId: ExamGrupo
  allExams: ExamenRow[]
  takenIds: number[]
  onPick: (exam: ExamenRow) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const meta = EXAM_GRUPO_META[grupoId]
  const groupExams = allExams.filter((e) => e.grupoExamen === grupoId && !takenIds.includes(e.id))
  const ql = q.trim().toLowerCase()
  const list = ql
    ? groupExams.filter((e) => e.nombre.toLowerCase().includes(ql) || e.codigo.toLowerCase().includes(ql))
    : groupExams

  return (
    <div ref={ref} className="relative">
      <div
        className="flex cursor-text items-center gap-2 rounded-lg px-3 h-9 border border-input bg-background"
        onClick={() => setOpen(true)}
      >
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={`Buscar examen en ${meta.label}…`}
          className="flex-1 bg-transparent text-[13px] outline-none text-foreground"
        />
      </div>
      {open && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-auto rounded-lg py-1 border border-border bg-card shadow-lg">
          {list.length === 0 ? (
            <div className="px-3 py-3 text-[12px] text-muted-foreground">
              {groupExams.length === 0 ? 'No hay exámenes en este grupo.' : 'Sin resultados.'}
            </div>
          ) : (
            list.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => { onPick(e); setQ(''); setOpen(false) }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
              >
                <span className="rounded px-1.5 py-0.5 font-mono text-[10.5px] bg-muted text-muted-foreground">{e.codigo}</span>
                <span className="flex-1 text-[13px] text-foreground">{e.nombre}</span>
                {meta.tipo === 'catalogo' && e.precio > 0 ? (
                  <span className="tabular-nums text-[12px] text-muted-foreground">{formatCLP(e.precio)}</span>
                ) : (
                  <span className="text-[11px]" style={{ color: EXAM_GRUPO_META['imalab isapre'].color }}>precio manual</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── IsapreSelector ───────────────────────────────────────────────────────────

function IsapreSelector({
  value,
  onChange,
  options,
}: {
  value: number | null
  onChange: (id: number | null) => void
  options: IsaprePrevisionRow[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const selected = options.find((o) => o.id === value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md px-2.5 h-[30px] border text-[13px] bg-card"
        style={{ borderColor: value ? 'var(--input)' : EXAM_GRUPO_META['imalab isapre'].color, minWidth: 180 }}
      >
        <span className="flex-1 text-left truncate text-foreground">
          {selected ? selected.nombre : <span className="text-muted-foreground">Seleccionar isapre…</span>}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 min-w-[200px] rounded-lg py-1 border border-border bg-card shadow-lg">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => { onChange(o.id); setOpen(false) }}
              className="flex w-full items-center px-3 py-2 text-[13px] text-left hover:bg-muted/50 transition-colors text-foreground"
            >
              {o.nombre}
            </button>
          ))}
          {value && (
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              className="flex w-full items-center px-3 py-2 text-[12px] text-left hover:bg-muted/50 transition-colors text-muted-foreground border-t border-border mt-1"
            >
              Quitar selección
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── GrupoLabBlock ────────────────────────────────────────────────────────────

function GrupoLabBlock({
  group,
  allExams,
  isaprePrevisiones,
  onUpdate,
  onRemove,
}: {
  group: ExamGroup
  allExams: ExamenRow[]
  isaprePrevisiones: IsaprePrevisionRow[]
  onUpdate: (patch: Partial<ExamGroup>) => void
  onRemove: () => void
}) {
  const meta = EXAM_GRUPO_META[group.grupoId]
  const isIsapre = meta.tipo === 'isapre'
  const takenIds = group.exams.map((e) => e.id)

  const addExam = (e: ExamenRow) => {
    const item: ExamGroupItem = isIsapre
      ? { tipo: 'isapre', id: e.id, codigo: e.codigo, nombre: e.nombre, valor: '', valorPagar: '' }
      : { tipo: 'catalogo', id: e.id, codigo: e.codigo, nombre: e.nombre, precio: e.precio }
    onUpdate({ exams: [...group.exams, item] })
  }

  const removeExam = (id: number) =>
    onUpdate({ exams: group.exams.filter((e) => e.id !== id) })

  const patchIsapreExam = (id: number, patch: Partial<IsapreExam>) =>
    onUpdate({
      exams: group.exams.map((e) =>
        e.id === id && e.tipo === 'isapre' ? { ...e, ...patch } : e
      ),
    })

  const subtotal = group.exams.reduce((s, e) => {
    if (e.tipo === 'isapre') return s + (parseNum(e.valorPagar) || 0)
    return s + e.precio
  }, 0)

  const bonifica = isIsapre
    ? group.exams.reduce((s, e) => {
        if (e.tipo !== 'isapre') return s
        const v = parseNum(e.valor)
        const vp = parseNum(e.valorPagar)
        return s + Math.max(0, v - vp)
      }, 0)
    : 0

  const previsionName = isaprePrevisiones.find((p) => p.id === group.idPrevision)?.nombre

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {/* Header */}
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3"
        style={{ backgroundColor: meta.bg }}
      >
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold" style={{ color: meta.color }}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
          {meta.label}
        </span>
        {isIsapre && (
          <span
            className="rounded px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wide bg-card"
            style={{ color: meta.color }}
          >
            precio manual
          </span>
        )}
        {isIsapre && (
          <div className="flex items-center gap-2">
            <span className="text-[12px]" style={{ color: meta.color }}>Isapre del paciente</span>
            <IsapreSelector
              value={group.idPrevision}
              onChange={(id) => onUpdate({ idPrevision: id })}
              options={isaprePrevisiones}
            />
          </div>
        )}
        <span className="ml-auto tabular-nums text-[13px] font-semibold text-foreground">
          {group.exams.length ? formatCLP(subtotal) : '—'}
        </span>
        <button
          type="button"
          onClick={onRemove}
          title="Quitar grupo-laboratorio"
          className="rounded p-1 hover:opacity-60 transition-opacity"
          style={{ color: meta.color }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="space-y-3 p-3.5 bg-card">
        <ExamPicker grupoId={group.grupoId} allExams={allExams} takenIds={takenIds} onPick={addExam} />

        {isIsapre && !group.idPrevision && (
          <p className="flex items-center gap-1.5 text-[12px]" style={{ color: meta.color }}>
            <AlertCircle className="h-3 w-3" />
            Indica la isapre del paciente para esta cotización.
          </p>
        )}

        {group.exams.length === 0 ? (
          <div
            className="rounded-lg border border-dashed py-6 text-center text-[12.5px] text-muted-foreground"
          >
            Busca y agrega exámenes de <strong className="text-foreground">{meta.label}</strong>.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            {group.exams.map((e, i) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5 text-[13px] bg-card"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}
              >
                <span className="rounded px-1.5 py-0.5 font-mono text-[10.5px] bg-muted text-muted-foreground">{e.codigo}</span>
                <span className="min-w-[180px] flex-1 text-foreground">{e.nombre}</span>
                {e.tipo === 'isapre' ? (
                  <div className="flex items-center gap-2.5">
                    <MoneyField
                      label="Valor"
                      value={e.valor}
                      onChange={(v) => patchIsapreExam(e.id, { valor: v })}
                    />
                    <MoneyField
                      label="A pagar"
                      value={e.valorPagar}
                      onChange={(v) => patchIsapreExam(e.id, { valorPagar: v })}
                    />
                  </div>
                ) : (
                  <span className="tabular-nums text-foreground text-right" style={{ minWidth: 84 }}>
                    {formatCLP(e.precio)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeExam(e.id)}
                  className="rounded p-1 hover:opacity-70 transition-opacity text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {isIsapre && bonifica > 0 && (
          <p className="text-[12px] text-muted-foreground">
            {previsionName ?? 'La isapre'} bonifica{' '}
            <span className="tabular-nums font-medium text-foreground">{formatCLP(bonifica)}</span>{' '}
            · el paciente paga{' '}
            <span className="tabular-nums font-medium text-foreground">{formatCLP(subtotal)}</span>
          </p>
        )}
      </div>
    </div>
  )
}

// ─── AddGroupMenu ─────────────────────────────────────────────────────────────

function AddGroupMenu({
  available,
  onAdd,
  empty,
}: {
  available: ExamGrupo[]
  onAdd: (id: ExamGrupo) => void
  empty?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  if (available.length === 0) return null

  return (
    <div ref={ref} className={empty ? 'relative' : 'relative'}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          empty
            ? 'flex w-full flex-col items-center gap-1 rounded-xl border border-dashed py-7 text-center hover:bg-muted/30 transition-colors'
            : 'inline-flex items-center gap-1.5 rounded-lg px-3 h-9 text-[13px] font-medium border border-dashed border-border bg-card hover:bg-muted/30 transition-colors text-foreground'
        }
      >
        {empty ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground">
              <Plus className="h-3.5 w-3.5" /> Seleccionar grupo-laboratorio
            </span>
            <span className="text-[12px] text-muted-foreground">
              Elige primero un laboratorio para ver y filtrar sus exámenes.
            </span>
          </>
        ) : (
          <>
            <Plus className="h-3.5 w-3.5" /> Agregar grupo-laboratorio
          </>
        )}
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 w-80 rounded-lg py-1 border border-border bg-card shadow-lg"
          style={empty ? { left: '50%', transform: 'translateX(-50%)' } : { left: 0 }}
        >
          {available.map((grupoId) => {
            const m = EXAM_GRUPO_META[grupoId]
            return (
              <button
                key={grupoId}
                type="button"
                onClick={() => { onAdd(grupoId); setOpen(false) }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: m.color }} />
                <span className="flex-1">
                  <span className="block text-[13px] font-medium text-foreground">{m.label}</span>
                  <span className="block text-[11.5px] text-muted-foreground">
                    {m.tipo === 'isapre'
                      ? 'Sin precio de catálogo · valor, copago e isapre manuales'
                      : 'Precios desde el catálogo del laboratorio'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── ExamenesPorGrupo (main export) ──────────────────────────────────────────

export function ExamenesPorGrupo({
  groups,
  setGroups,
  allExams,
  isaprePrevisiones,
}: {
  groups: ExamGroup[]
  setGroups: React.Dispatch<React.SetStateAction<ExamGroup[]>>
  allExams: ExamenRow[]
  isaprePrevisiones: IsaprePrevisionRow[]
}) {
  const usedIds = groups.map((g) => g.grupoId)
  const available = EXAM_GRUPOS.filter((g) => !usedIds.includes(g))

  const addGroup = (id: ExamGrupo) =>
    setGroups((prev) => [...prev, { grupoId: id, idPrevision: null, exams: [] }])

  const updateGroup = (i: number, patch: Partial<ExamGroup>) =>
    setGroups((prev) => prev.map((g, x) => (x === i ? { ...g, ...patch } : g)))

  const removeGroup = (i: number) =>
    setGroups((prev) => prev.filter((_, x) => x !== i))

  if (groups.length === 0) {
    return <AddGroupMenu available={available} onAdd={addGroup} empty />
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((g, i) => (
        <GrupoLabBlock
          key={g.grupoId}
          group={g}
          allExams={allExams}
          isaprePrevisiones={isaprePrevisiones}
          onUpdate={(patch) => updateGroup(i, patch)}
          onRemove={() => removeGroup(i)}
        />
      ))}
      <AddGroupMenu available={available} onAdd={addGroup} />
    </div>
  )
}

// ─── buildInitialGroups helper ────────────────────────────────────────────────

export function buildInitialGroups(
  examIds: number[],
  examPrices: { idExamen: number; precio: number }[],
  isapreExams: { idExamen: number; valorCompleto: number; valorPagar: number; idPrevision: number | null }[],
  allExams: ExamenRow[],
): ExamGroup[] {
  const groups: ExamGroup[] = []

  // Group regular exams by grupoExamen (preserving saved prices)
  const priceMap = new Map(examPrices.map((e) => [e.idExamen, e.precio]))
  const byGroup = new Map<ExamGrupo, CatalogoExam[]>()

  for (const id of examIds) {
    const exam = allExams.find((e) => e.id === id)
    if (!exam) continue
    const grupoId = exam.grupoExamen as ExamGrupo
    if (EXAM_GRUPO_META[grupoId]?.tipo !== 'catalogo') continue
    if (!byGroup.has(grupoId)) byGroup.set(grupoId, [])
    byGroup.get(grupoId)!.push({
      tipo: 'catalogo',
      id: exam.id,
      codigo: exam.codigo,
      nombre: exam.nombre,
      precio: priceMap.get(exam.id) ?? exam.precio,
    })
  }

  // Add catalog groups in EXAM_GRUPOS order
  for (const grupoId of EXAM_GRUPOS) {
    if (EXAM_GRUPO_META[grupoId].tipo !== 'catalogo') continue
    const exams = byGroup.get(grupoId)
    if (exams && exams.length > 0) {
      groups.push({ grupoId, idPrevision: null, exams })
    }
  }

  // Add isapre group if any isapre exams exist
  if (isapreExams.length > 0) {
    const idPrevision = isapreExams[0]?.idPrevision ?? null
    const isItems: IsapreExam[] = isapreExams.map((e) => {
      const exam = allExams.find((a) => a.id === e.idExamen)
      return {
        tipo: 'isapre',
        id: e.idExamen,
        codigo: exam?.codigo ?? '',
        nombre: exam?.nombre ?? '',
        valor: String(e.valorCompleto),
        valorPagar: String(e.valorPagar),
      }
    })
    groups.push({ grupoId: 'imalab isapre', idPrevision, exams: isItems })
  }

  return groups
}

// ─── appendExamGroupsToFormData helper ────────────────────────────────────────

export function appendExamGroupsToFormData(fd: FormData, groups: ExamGroup[]) {
  for (const group of groups) {
    const meta = EXAM_GRUPO_META[group.grupoId]
    if (meta.tipo === 'isapre') {
      for (const e of group.exams) {
        if (e.tipo !== 'isapre') continue
        fd.append('isapre_exam_ids', String(e.id))
        fd.append(`isapre_exam_valor_${e.id}`, String(parseNum(e.valor)))
        fd.append(`isapre_exam_valor_pagar_${e.id}`, String(parseNum(e.valorPagar)))
      }
      if (group.idPrevision) fd.append('isapre_prevision_id', String(group.idPrevision))
    } else {
      for (const e of group.exams) {
        fd.append('exam_ids', String(e.id))
      }
    }
  }
}
