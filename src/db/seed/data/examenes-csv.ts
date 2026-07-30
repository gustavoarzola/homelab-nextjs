// ─── Exámenes de laboratorio y diagnóstico (desde examenes.csv) ──────────────

import { readFileSync } from 'fs'
import { join } from 'path'

const csvPath = join(process.cwd(), 'examenes.csv')
const csvLines = readFileSync(csvPath, 'utf-8').trim().split('\n').slice(1) // skip header

export const examenesDataWithPrices = csvLines
  .map(line => {
    const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g) ?? line.split(',')
    const [codigo, nombre, precio, laboratorio] = cols.map(c => c.replace(/^"|"$/g, '').trim())
    if (!codigo || !nombre || !precio) return null
    return {
      codigo,
      nombre,
      precio: parseInt(precio, 10),
      grupoExamen: laboratorio ?? 'imalab',
    }
  })
  .filter(Boolean) as { codigo: string; nombre: string; precio: number; grupoExamen: string }[]
