export const EXAM_GRUPOS = ['imalab', 'imalab fonasa 3', 'integramédica', 'imalab isapre'] as const
export type ExamGrupo = typeof EXAM_GRUPOS[number]

export const EXAM_GRUPO_META: Record<ExamGrupo, {
  label: string
  tipo: 'catalogo' | 'isapre'
  bg: string
  color: string
}> = {
  'imalab':          { label: 'Imalab',          tipo: 'catalogo', bg: '#dbeafe', color: '#1e40af' },
  'imalab fonasa 3': { label: 'Imalab Fonasa 3', tipo: 'catalogo', bg: '#d1fae5', color: '#065f46' },
  'integramédica':   { label: 'Integramédica',   tipo: 'catalogo', bg: '#fce7f3', color: '#9d174d' },
  'imalab isapre':   { label: 'Imalab · Isapre', tipo: 'isapre',   bg: '#fef3c7', color: '#92400e' },
}

// Backward-compat
export const EXAM_GRUPO_LABELS: Record<ExamGrupo, string> = Object.fromEntries(
  EXAM_GRUPOS.map((g) => [g, EXAM_GRUPO_META[g].label])
) as Record<ExamGrupo, string>

export const EXAM_GRUPO_COLORS: Record<ExamGrupo, { bg: string; color: string }> = Object.fromEntries(
  EXAM_GRUPOS.map((g) => [g, { bg: EXAM_GRUPO_META[g].bg, color: EXAM_GRUPO_META[g].color }])
) as Record<ExamGrupo, { bg: string; color: string }>
