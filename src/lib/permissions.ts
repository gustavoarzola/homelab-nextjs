// Permisos por rol. Modelo simple: acceso sí/no a interfaces completas.
// `admin` tiene acceso total; cualquier otro rol (p.ej. `ejecutivo`) queda
// restringido, así un rol desconocido nunca recibe más acceso del debido.
// Sin dependencias de servidor: se usa desde el proxy, el sidebar y las actions.

export const ROLES = {
  admin: 'admin',
  ejecutivo: 'ejecutivo',
} as const

export function isAdmin(role: string | null | undefined): boolean {
  return role === ROLES.admin
}

// Secciones (páginas y API) solo para admin: afectan valores, tipos de
// servicio o descargan reportes.
export const ADMIN_ONLY_PREFIXES = [
  '/examenes',
  '/procedimientos',
  '/talleres',
  '/tipos-recargos',
  '/precios',
  '/playground',
  '/reportes',
  '/api/reportes',
] as const

export function canAccessPath(role: string | null | undefined, pathname: string): boolean {
  if (isAdmin(role)) return true
  return !ADMIN_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))
}
