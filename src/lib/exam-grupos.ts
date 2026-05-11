export const EXAM_GRUPOS = ['imalab', 'imalab_fonasa_3', 'integramedica'] as const
export type ExamGrupo = typeof EXAM_GRUPOS[number]

export const EXAM_GRUPO_LABELS: Record<ExamGrupo, string> = {
  imalab: 'Imalab',
  imalab_fonasa_3: 'Imalab Fonasa 3',
  integramedica: 'Integramédica',
}
