'use client'

import { EXAM_GRUPO_LABELS, EXAM_GRUPO_COLORS, type ExamGrupo } from '@/lib/exam-grupos'

export function ExamLabel({
  codigo,
  nombre,
  grupoExamen,
}: {
  codigo: string
  nombre: string
  grupoExamen: string
}) {
  const grupo = grupoExamen as ExamGrupo
  const groupLabel = EXAM_GRUPO_LABELS[grupo] ?? grupoExamen
  const colors = EXAM_GRUPO_COLORS[grupo] ?? { bg: 'var(--muted)', color: 'var(--muted-foreground)' }

  return (
    <div className="flex items-center gap-2">
      <span
        className="shrink-0 flex items-center justify-center rounded px-1.5 py-0.5 font-mono text-[11px] overflow-hidden text-ellipsis whitespace-nowrap"
        style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', width: '10ch' }}
      >
        {codigo}
      </span>
      <span
        className="shrink-0 flex items-center justify-center rounded px-1.5 py-0.5 font-mono text-[11px] overflow-hidden text-ellipsis whitespace-nowrap"
        style={{ backgroundColor: colors.bg, color: colors.color, width: '17ch' }}
      >
        {groupLabel}
      </span>
      <span style={{ color: 'var(--foreground)' }}>{nombre}</span>
    </div>
  )
}
