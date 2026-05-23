import { EXAM_GRUPO_LABELS, EXAM_GRUPO_COLORS, type ExamGrupo } from '@/lib/exam-grupos'

export function buildExamenOption(e: {
  id: number
  nombre: string
  codigo: string
  grupoExamen: string
}) {
  const grupo = e.grupoExamen as ExamGrupo
  const groupLabel = EXAM_GRUPO_LABELS[grupo] ?? e.grupoExamen
  return {
    id: e.id,
    label: e.nombre,
    code: e.codigo,
    tag: {
      label: groupLabel,
      ...(EXAM_GRUPO_COLORS[grupo] ?? { bg: '#f3f4f6', color: '#374151' }),
    },
  }
}
