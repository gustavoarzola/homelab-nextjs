import { describe, it, expect } from 'vitest'
import { canAccessPath, isAdmin } from '@/lib/permissions'

describe('isAdmin', () => {
  it('solo el rol admin es admin', () => {
    expect(isAdmin('admin')).toBe(true)
    expect(isAdmin('ejecutivo')).toBe(false)
    expect(isAdmin('usuario')).toBe(false)
    expect(isAdmin(undefined)).toBe(false)
    expect(isAdmin(null)).toBe(false)
  })
})

describe('canAccessPath', () => {
  const restringidas = [
    '/examenes',
    '/procedimientos',
    '/talleres',
    '/tipos-recargos',
    '/precios/visitas',
    '/reportes',
    '/api/reportes/visitas/export',
  ]

  it('admin accede a todo', () => {
    for (const path of restringidas) expect(canAccessPath('admin', path)).toBe(true)
  })

  it('un rol no-admin (o sin rol) no accede a las secciones restringidas', () => {
    for (const role of ['ejecutivo', 'usuario', undefined]) {
      for (const path of restringidas) expect(canAccessPath(role, path)).toBe(false)
    }
  })

  it('un rol no-admin accede al resto', () => {
    for (const path of ['/dashboard', '/visitas', '/visitas/12/editar', '/pacientes', '/comunas', '/previsiones', '/api/visitas/export', '/api/upload']) {
      expect(canAccessPath('ejecutivo', path)).toBe(true)
    }
  })

  it('no confunde prefijos parciales', () => {
    expect(canAccessPath('ejecutivo', '/reportesx')).toBe(true)
    expect(canAccessPath('ejecutivo', '/talleres-extra')).toBe(true)
  })
})
