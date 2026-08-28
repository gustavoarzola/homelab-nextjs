export const EXAM_GRUPOS = ['imalab', 'imalab fonasa 3', 'integramédica', 'imalab isapre'] as const
export type ExamGrupo = typeof EXAM_GRUPOS[number]

export const EXAM_GRUPO_META: Record<ExamGrupo, {
  label: string
  tipo: 'catalogo' | 'isapre'
  bg: string
  color: string
}> = {
  'imalab':          { label: 'Imalab',          tipo: 'catalogo', bg: 'var(--tag-blue-bg)',   color: 'var(--tag-blue-fg)' },
  'imalab fonasa 3': { label: 'Imalab Fonasa 3', tipo: 'catalogo', bg: 'var(--tag-green-bg)',  color: 'var(--tag-green-fg)' },
  'integramédica':   { label: 'Integramédica',   tipo: 'catalogo', bg: 'var(--tag-violet-bg)', color: 'var(--tag-violet-fg)' },
  'imalab isapre':   { label: 'Imalab · Isapre', tipo: 'isapre',   bg: 'var(--tag-amber-bg)',  color: 'var(--tag-amber-fg)' },
}

// Backward-compat
export const EXAM_GRUPO_LABELS: Record<ExamGrupo, string> = Object.fromEntries(
  EXAM_GRUPOS.map((g) => [g, EXAM_GRUPO_META[g].label])
) as Record<ExamGrupo, string>

export const EXAM_GRUPO_COLORS: Record<ExamGrupo, { bg: string; color: string }> = Object.fromEntries(
  EXAM_GRUPOS.map((g) => [g, { bg: EXAM_GRUPO_META[g].bg, color: EXAM_GRUPO_META[g].color }])
) as Record<ExamGrupo, { bg: string; color: string }>
