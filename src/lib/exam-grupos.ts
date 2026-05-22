export const EXAM_GRUPOS = ['imalab', 'imalab fonasa 3', 'integramédica'] as const
export type ExamGrupo = typeof EXAM_GRUPOS[number]

export const EXAM_GRUPO_LABELS: Record<ExamGrupo, string> = {
  'imalab':          'Imalab',
  'imalab fonasa 3': 'Imalab Fonasa 3',
  'integramédica':   'Integramédica',
}

export const EXAM_GRUPO_COLORS: Record<ExamGrupo, { bg: string; color: string }> = {
  'imalab':          { bg: '#dbeafe', color: '#1e40af' },
  'imalab fonasa 3': { bg: '#d1fae5', color: '#065f46' },
  'integramédica':   { bg: '#fce7f3', color: '#9d174d' },
}
