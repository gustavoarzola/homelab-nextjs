// ─── Previsiones de salud ─────────────────────────────────────────────────────
// Distribución aproximada de Chile: ~75% FONASA, ~20% Isapres, ~5% otros

export const previsionesData = [
  // FONASA (pública) – 4 tramos
  { nombre: 'FONASA Tramo A (Gratuito)', categoria: 'fonasa' },
  { nombre: 'FONASA Tramo B', categoria: 'fonasa' },
  { nombre: 'FONASA Tramo C', categoria: 'fonasa' },
  { nombre: 'FONASA Tramo D', categoria: 'fonasa' },
  // Isapres privadas vigentes
  { nombre: 'Isapre Banmédica', categoria: 'isapre' },
  { nombre: 'Isapre Cruz Blanca', categoria: 'isapre' },
  { nombre: 'Isapre Consalud', categoria: 'isapre' },
  { nombre: 'Isapre Colmena Golden Cross', categoria: 'isapre' },
  { nombre: 'Isapre Vida Tres', categoria: 'isapre' },
  { nombre: 'Isapre Nueva Masvida', categoria: 'isapre' },
  { nombre: 'Isapre Esencial', categoria: 'isapre' },
  // Sistemas especiales
  { nombre: 'Dipreca (Fuerzas Armadas)', categoria: 'particular' },
  { nombre: 'Capredena (Carabineros de Chile)', categoria: 'particular' },
  // Sin previsión
  { nombre: 'Particular / Sin previsión', categoria: 'particular' },
]
