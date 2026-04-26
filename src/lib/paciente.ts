type PacienteNombreInput = {
  nombres?: string | null
  apellidoPaterno?: string | null
  apellidoMaterno?: string | null
}

type FormatPacienteNombreOptions = {
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
export function formatPacienteNombre(
  paciente: PacienteNombreInput,
  options: FormatPacienteNombreOptions = {},
): string {
  const { firstNameOnly = true } = options
  const nombresRaw = paciente.nombres?.trim() ?? ''
  const nombre = firstNameOnly ? firstWord(nombresRaw) : nombresRaw
  const apellidos = [paciente.apellidoPaterno, paciente.apellidoMaterno]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ')

  if (apellidos && nombre) return `${apellidos}, ${nombre}`
  if (apellidos) return apellidos
  return nombre
}
