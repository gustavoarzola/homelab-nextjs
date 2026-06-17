import { describe, expect, it } from 'vitest'
import { ActionError, withAction } from '@/lib/with-action'

describe('withAction', () => {
  it('preserves ActionError messages', async () => {
    const result = await withAction('Error genérico', async () => {
      throw new ActionError('Mensaje específico')
    })

    expect(result).toEqual({ success: false, error: 'Mensaje específico' })
  })

  it('preserves ActionError-shaped messages across runtime boundaries', async () => {
    const result = await withAction('Error genérico', async () => {
      throw { name: 'ActionError', message: 'Mensaje transportado' }
    })

    expect(result).toEqual({ success: false, error: 'Mensaje transportado' })
  })

  it('maps known visit unique constraints to user-facing messages', async () => {
    const result = await withAction('Error genérico', async () => {
      throw { cause: { constraint: 'visitas_numero_boleta_tipo_doc_idx' } }
    })

    expect(result).toEqual({
      success: false,
      error: 'Ya existe una visita con ese número de boleta/factura',
    })
  })
})
