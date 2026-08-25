// ─── Exámenes de laboratorio y diagnóstico (desde examenes.csv) ──────────────

import { readFileSync } from 'fs'
import { join } from 'path'

type ExamRow = { codigo: string; nombre: string; precio: number; grupoExamen: string }

const csvPath = join(process.cwd(), 'examenes.csv')
const csvLines = readFileSync(csvPath, 'utf-8').trim().split('\n').slice(1) // skip header

export const examenesDataWithPrices: ExamRow[] = csvLines
  .map((line) => {
    const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g) ?? line.split(',')
    const [codigo, nombre, precio, laboratorio] = cols.map((c) => c.replace(/^"|"$/g, '').trim())
    if (!codigo || !nombre || !precio) return null
    return {
      codigo,
      nombre,
      precio: parseInt(precio, 10),
      grupoExamen: laboratorio ?? 'imalab',
    }
  })
  .filter((row): row is ExamRow => row !== null)

/** Misma lista que `imalab fonasa 3`, sin precio de catálogo (se carga en la visita). */
export const examenesIsapreData: ExamRow[] = (() => {
  const seen = new Set<string>()
  const rows: ExamRow[] = []
  for (const exam of examenesDataWithPrices) {
    if (exam.grupoExamen !== 'imalab fonasa 3') continue
    const key = `${exam.codigo}\0${exam.nombre}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ codigo: exam.codigo, nombre: exam.nombre, precio: 0, grupoExamen: 'imalab isapre' })
  }
  return rows
})()
