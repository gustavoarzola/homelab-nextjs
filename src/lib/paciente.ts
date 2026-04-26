type PersonaNombreInput = {
  nombres?: string | null
  apellidoPaterno?: string | null
  apellidoMaterno?: string | null
}

/**
 * Formatea un nombre como "ApellidoPaterno [ApellidoMaterno], Nombres".
 * Si faltan campos, retorna la mejor combinación disponible.
 */
export function formatNombre(persona: PersonaNombreInput): string {
  const nombres = persona.nombres?.trim() ?? ''
  const apellidos = [persona.apellidoPaterno, persona.apellidoMaterno]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(' ')

  if (apellidos && nombres) return `${apellidos}, ${nombres}`
  if (apellidos) return apellidos
  return nombres
}
