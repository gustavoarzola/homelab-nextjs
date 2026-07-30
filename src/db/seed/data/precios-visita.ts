// ─── Precios de visita de enfermería por comuna ────────────────────────────────

export function buildNursingVisitPrices(): Array<{
  comuna: string | null
  precio: number
}> {
  const comunasStgo = [
    'Providencia', 'Las Condes', 'Ñuñoa', 'Santiago', 'La Florida', 'Maipú',
    'Vitacura', 'Lo Barnechea', 'La Reina', 'Peñalolén', 'Macul', 'San Miguel',
    'Independencia', 'Recoleta', 'La Cisterna', 'La Granja', 'Pudahuel',
    'Quilicura', 'Huechuraba', 'Conchalí', 'Cerrillos', 'Estación Central',
    'Puente Alto', 'San Bernardo', 'Colina', 'Lampa',
  ]

  const preciosVisita: Array<{
    comuna: string | null
    precio: number
  }> = [{ comuna: null, precio: 30000 }]

  // Definir precios base según zona
  // Zonas caras (centro/oriente): 40.000-55.000
  // Zonas medias (periférico cercano): 30.000-40.000
  // Zonas lejanas (periférico lejano): 25.000-35.000

  const zonasCaras = ['Providencia', 'Las Condes', 'Vitacura', 'Lo Barnechea', 'La Reina', 'Ñuñoa']
  const zonasMedias = ['Santiago', 'Peñalolén', 'Macul', 'San Miguel', 'Huechuraba', 'Recoleta', 'Independencia']
  const zonasLejanas = [
    'La Florida', 'Maipú', 'La Cisterna', 'La Granja', 'Pudahuel', 'Quilicura',
    'Conchalí', 'Cerrillos', 'Estación Central', 'Puente Alto', 'San Bernardo', 'Colina', 'Lampa'
  ]

  for (let i = 0; i < comunasStgo.length; i++) {
    const comuna = comunasStgo[i]!
    let basePrice = 0

    if (zonasCaras.includes(comuna)) {
      basePrice = 45000 + (i % 5) * 2000 // 45.000 - 53.000
    } else if (zonasMedias.includes(comuna)) {
      basePrice = 32000 + (i % 4) * 1500 // 32.000 - 36.500
    } else {
      basePrice = 28000 + (i % 4) * 1200 // 28.000 - 32.600
    }

    // Redondear a múltiplo de 500
    const precioRedondeado = Math.round(basePrice / 500) * 500

    preciosVisita.push({
      comuna,
      precio: precioRedondeado,
    })
  }

  return preciosVisita
}
