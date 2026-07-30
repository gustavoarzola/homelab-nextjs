// ─── PRNG determinista (mulberry32) ────────────────────────────────────────
// Se usa en el Paso 2 para generar operación reproducible (pacientes, visitas,
// cotizaciones, etc.) a partir de una semilla fija. Aquí solo se define.

export interface Rng {
  /** Siguiente float pseudo-aleatorio en [0, 1). */
  next(): number
  /** Entero pseudo-aleatorio en [min, max] (ambos inclusive). */
  int(min: number, max: number): number
  /** Elemento pseudo-aleatorio de un array no vacío. */
  pick<T>(arr: T[]): T
  /** true con probabilidad p (0-1). */
  chance(p: number): boolean
  /** Copia del array con orden pseudo-aleatorio (Fisher-Yates). */
  shuffle<T>(arr: T[]): T[]
}

/**
 * mulberry32: PRNG determinista de 32 bits, rápido y suficiente para datos de
 * seed (no criptográfico). Misma semilla ⇒ misma secuencia siempre.
 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0

  function next(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  function int(min: number, max: number): number {
    return Math.floor(next() * (max - min + 1)) + min
  }

  function pick<T>(arr: T[]): T {
    if (arr.length === 0) throw new Error('pick() recibió un array vacío')
    return arr[Math.floor(next() * arr.length)]!
  }

  function chance(p: number): boolean {
    return next() < p
  }

  function shuffle<T>(arr: T[]): T[] {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
    }
    return copy
  }

  return { next, int, pick, chance, shuffle }
}
