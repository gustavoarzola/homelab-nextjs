type PersonaNombreInput = {
  nombres?: string | null
  apellidoPaterno?: string | null
  apellidoMaterno?: string | null
}

type FormatNombreOptions = {
  firstNameOnly?: boolean
}

function firstWord(value: string): string {
  return value.trim().split(/\s+/)[0] ?? ''
}

/**
 * Formatea el nombre de paciente como:
 * "ApellidoPaterno ApellidoMaterno, PrimerNombre".
 * Si faltan apellidos o nombres, retorna la mejor combinación disponible.
 */
function formatNombrePersona(
  persona: PersonaNombreInput,
  options: FormatNombreOptions = {},
): string {
  const { firstNameOnly = true } = options
  const nombresRaw = persona.nombres?.trim() ?? ''
  const nombre = firstNameOnly ? firstWord(nombresRaw) : nombresRaw
  const apellidos = [persona.apellidoPaterno, persona.apellidoMaterno]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ')

  if (apellidos && nombre) return `${apellidos}, ${nombre}`
  if (apellidos) return apellidos
  return nombre
}

export function formatPacienteNombre(
  paciente: PersonaNombreInput,
  options: FormatNombreOptions = {},
): string {
  return formatNombrePersona(paciente, { firstNameOnly: true, ...options })
}

/**
 * Formatea el nombre de enfermera como:
 * "ApellidoPaterno ApellidoMaterno, Nombres".
 */
export function formatEnfermeraNombre(enfermera: PersonaNombreInput): string {
  return formatNombrePersona(enfermera, { firstNameOnly: false })
}
