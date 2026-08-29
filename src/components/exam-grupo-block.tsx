'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trash2, Search, AlertCircle, ChevronDown } from 'lucide-react'
import { EXAM_GRUPO_META, EXAM_GRUPOS } from '@/lib/exam-grupos'
import type { ExamGrupo } from '@/lib/exam-grupos'
import type { ExamenRow } from '@/lib/actions/catalogos'
import type { IsaprePrevisionRow } from '@/lib/actions/catalogos'
import { ServiceItems, ServiceItem, ServiceEmpty } from '@/components/form-servicios'
import './form-shared.css'

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

function useClickOutside(refs: React.RefObject<HTMLElement | null>[], onOut: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (refs.some((r) => r.current?.contains(target))) return
      onOut()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [refs, onOut])
}

function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  return mounted
}

// Los dropdowns de este archivo se portan a document.body (position: fixed) en
// vez de vivir como hijos normales del trigger: el `.fcard` que envuelve el
// formulario de visita/cotización tiene `overflow: hidden` (redondea sus
// esquinas) y clipeaba estos dropdowns al vuelo. Mismo patrón que ya usa
// SelectCombobox.
function useDropdownPosition(triggerRef: React.RefObject<HTMLElement | null>, open: boolean) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const updatePos = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [triggerRef])
  useEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open, updatePos])
  return pos
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
      <span className="text-[11px] text-[var(--color-fg-muted)]">{label}</span>
      <span className="flex items-center gap-1 rounded-md pl-2 pr-1.5 h-8 border border-[var(--color-border)] bg-[var(--color-surface)]">
        <span className="text-[12px] text-[var(--color-fg-muted)]">$</span>
        <input
          value={formatThousands(value)}
          onChange={(e) => onChange(String(parseNum(e.target.value) || ''))}
          placeholder="0"
          inputMode="numeric"
          className="w-[72px] bg-transparent text-right text-[13px] tabular-nums outline-none text-[var(--color-fg)]"
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
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const mounted = useMounted()
  const pos = useDropdownPosition(containerRef, open)
  useClickOutside([containerRef, dropdownRef], () => setOpen(false))

  const meta = EXAM_GRUPO_META[grupoId]
  const groupExams = allExams.filter((e) => e.grupoExamen === grupoId && !takenIds.includes(e.id))
  const ql = q.trim().toLowerCase()
  const list = ql
    ? groupExams.filter((e) => e.nombre.toLowerCase().includes(ql) || e.codigo.toLowerCase().includes(ql))
    : groupExams

  const dropdown = open && mounted ? createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-20 max-h-64 overflow-auto rounded-lg py-1 border border-border bg-[var(--color-surface)] shadow-lg"
      style={{ top: pos.top, left: pos.left, width: pos.width }}
    >
      {list.length === 0 ? (
        <div className="px-3 py-3 text-[12px] text-[var(--color-fg-muted)]">
          {groupExams.length === 0 ? 'No hay exámenes en este grupo.' : 'Sin resultados.'}
        </div>
      ) : (
        list.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => { onPick(e); setQ(''); setOpen(false) }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--neutral-50)] transition-colors"
          >
            <span className="rounded px-1.5 py-0.5 font-mono text-[10.5px] bg-[var(--color-surface-muted)] text-[var(--color-fg-muted)]">{e.codigo}</span>
            <span className="flex-1 text-[13px] text-[var(--color-fg)]">{e.nombre}</span>
            {meta.tipo === 'catalogo' && e.precio > 0 ? (
              <span className="tabular-nums text-[12px] text-[var(--color-fg-muted)]">{formatCLP(e.precio)}</span>
            ) : (
              <span className="text-[11px]" style={{ color: EXAM_GRUPO_META['imalab isapre'].color }}>precio manual</span>
            )}
          </button>
        ))
      )}
    </div>,
    document.body,
  ) : null

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex cursor-text items-center gap-2 rounded-lg px-3 h-9 border border-[var(--color-border)] bg-[var(--color-surface)]"
        onClick={() => setOpen(true)}
      >
        <Search className="h-3.5 w-3.5 text-[var(--color-fg-muted)] shrink-0" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={`Buscar examen en ${meta.label}…`}
          className="flex-1 bg-transparent text-[13px] outline-none text-[var(--color-fg)]"
        />
      </div>
      {dropdown}
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
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const mounted = useMounted()
  const pos = useDropdownPosition(containerRef, open)
  useClickOutside([containerRef, dropdownRef], () => setOpen(false))

  const selected = options.find((o) => o.id === value)

  const dropdown = open && mounted ? createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-20 min-w-[200px] rounded-lg py-1 border border-border bg-[var(--color-surface)] shadow-lg"
      style={{ top: pos.top, left: pos.left }}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => { onChange(o.id); setOpen(false) }}
          className="flex w-full items-center px-3 py-2 text-[13px] text-left hover:bg-[var(--neutral-50)] transition-colors text-[var(--color-fg)]"
        >
          {o.nombre}
        </button>
      ))}
      {value && (
        <button
          type="button"
          onClick={() => { onChange(null); setOpen(false) }}
          className="flex w-full items-center px-3 py-2 text-[12px] text-left hover:bg-[var(--neutral-50)] transition-colors text-[var(--color-fg-muted)] border-t border-border mt-1"
        >
          Quitar selección
        </button>
      )}
    </div>,
    document.body,
  ) : null

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md px-2.5 h-[30px] border text-[13px] bg-[var(--color-surface)]"
        style={{ borderColor: value ? 'var(--color-border-strong)' : EXAM_GRUPO_META['imalab isapre'].color, minWidth: 180 }}
      >
        <span className="flex-1 text-left truncate text-[var(--color-fg)]">
          {selected ? selected.nombre : <span className="text-[var(--color-fg-muted)]">Seleccionar isapre…</span>}
        </span>
        <ChevronDown className="h-3 w-3 text-[var(--color-fg-muted)] shrink-0" />
      </button>
      {dropdown}
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
    <div className="rounded-xl border border-border">
      {/* Header */}
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3 rounded-t-xl"
        style={{ backgroundColor: meta.bg }}
      >
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold" style={{ color: meta.color }}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
          {meta.label}
        </span>
        {isIsapre && (
          <span
            className="rounded px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wide bg-[var(--color-surface)]"
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
        <span className="ml-auto tabular-nums text-[13px] font-semibold text-[var(--color-fg)]">
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
      <div className="space-y-3 p-3.5 bg-[var(--color-surface)] rounded-b-xl">
        <ExamPicker grupoId={group.grupoId} allExams={allExams} takenIds={takenIds} onPick={addExam} />

        {isIsapre && !group.idPrevision && (
          <p className="flex items-center gap-1.5 text-[12px]" style={{ color: meta.color }}>
            <AlertCircle className="h-3 w-3" />
            Indica la isapre del paciente para esta cotización.
          </p>
        )}

        {group.exams.length === 0 ? (
          <ServiceEmpty>
            Busca y agrega exámenes de <strong style={{ color: 'var(--color-fg)' }}>{meta.label}</strong>.
          </ServiceEmpty>
        ) : (
          <ServiceItems>
            {group.exams.map((e) => (
              <ServiceItem
                key={e.id}
                codigo={e.codigo}
                nombre={e.nombre}
                price={e.tipo === 'catalogo' ? formatCLP(e.precio) : null}
                onRemove={() => removeExam(e.id)}
              >
                {e.tipo === 'isapre' && (
                  <div className="flex items-center gap-2.5">
                    <MoneyField
                      label="Valor examen"
                      value={e.valor}
                      onChange={(v) => patchIsapreExam(e.id, { valor: v })}
                    />
                    <MoneyField
                      label="Valor a pagar"
                      value={e.valorPagar}
                      onChange={(v) => patchIsapreExam(e.id, { valorPagar: v })}
                    />
                  </div>
                )}
              </ServiceItem>
            ))}
          </ServiceItems>
        )}

        {isIsapre && bonifica > 0 && (
          <p className="text-[12px] text-[var(--color-fg-muted)]">
            {previsionName ?? 'La isapre'} bonifica{' '}
            <span className="tabular-nums font-medium text-[var(--color-fg)]">{formatCLP(bonifica)}</span>{' '}
            · el paciente paga{' '}
            <span className="tabular-nums font-medium text-[var(--color-fg)]">{formatCLP(subtotal)}</span>
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
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const mounted = useMounted()
  const pos = useDropdownPosition(containerRef, open)
  useClickOutside([containerRef, dropdownRef], () => setOpen(false))

  if (available.length === 0) return null

  const dropdown = open && mounted ? createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-20 w-80 rounded-lg py-1 border border-border bg-[var(--color-surface)] shadow-lg"
      style={
        empty
          ? { top: pos.top, left: pos.left + pos.width / 2, transform: 'translateX(-50%)' }
          : { top: pos.top, left: pos.left }
      }
    >
      {available.map((grupoId) => {
        const m = EXAM_GRUPO_META[grupoId]
        return (
          <button
            key={grupoId}
            type="button"
            onClick={() => { onAdd(grupoId); setOpen(false) }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--neutral-50)] transition-colors"
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: m.color }} />
            <span className="flex-1">
              <span className="block text-[13px] font-medium text-[var(--color-fg)]">{m.label}</span>
              <span className="block text-[11.5px] text-[var(--color-fg-muted)]">
                {m.tipo === 'isapre'
                  ? 'Sin precio de catálogo · valor, copago e isapre manuales'
                  : 'Precios desde el catálogo del laboratorio'}
              </span>
            </span>
          </button>
        )
      })}
    </div>,
    document.body,
  ) : null

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          empty
            ? 'flex w-full flex-col items-center gap-1 rounded-xl border border-dashed py-7 text-center hover:bg-[var(--neutral-50)] transition-colors'
            : 'inline-flex items-center gap-1.5 rounded-lg px-3 h-9 text-[13px] font-medium border border-dashed border-border bg-[var(--color-surface)] hover:bg-[var(--neutral-50)] transition-colors text-[var(--color-fg)]'
        }
      >
        {empty ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[var(--color-fg)]">
              <Plus className="h-3.5 w-3.5" /> Seleccionar laboratorio
            </span>
            <span className="text-[12px] text-[var(--color-fg-muted)]">
              Elige primero un laboratorio para ver y filtrar sus exámenes.
            </span>
          </>
        ) : (
          <>
            <Plus className="h-3.5 w-3.5" /> Agregar grupo-laboratorio
          </>
        )}
      </button>
      {dropdown}
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
