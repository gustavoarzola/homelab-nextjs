import { describe, expect, it, vi, beforeEach } from 'vitest'

const { getR2Object } = vi.hoisted(() => ({ getR2Object: vi.fn() }))
vi.mock('@/lib/r2', () => ({ getR2Object }))

import { buildVisitAttachments } from '@/lib/actions/visitas-asignacion-email'

describe('buildVisitAttachments', () => {
  beforeEach(() => {
    getR2Object.mockReset()
    getR2Object.mockImplementation(async (key: string) => ({
      buffer: Buffer.from(key),
      contentType: 'image/jpeg',
    }))
  })

  it('descarga cada key una sola vez aunque se repita entre visitas', async () => {
    const visitas = [
      { archivos: [{ key: 'visitas/v1_ana_perez_1.jpg', contentType: 'image/jpeg' }] },
      { archivos: [{ key: 'visitas/v1_ana_perez_1.jpg', contentType: 'image/jpeg' }] },
    ]
    const attachments = await buildVisitAttachments(visitas)
    expect(getR2Object).toHaveBeenCalledTimes(1)
    expect(attachments).toEqual([
      {
        filename: 'v1_ana_perez_1.jpg',
        content: Buffer.from('visitas/v1_ana_perez_1.jpg'),
        contentType: 'image/jpeg',
      },
    ])
  })

  it('omite un adjunto cuyo objeto no existe en R2, sin romper el resto', async () => {
    getR2Object.mockImplementation(async (key: string) => {
      if (key.endsWith('_2.jpg')) throw new Error('NoSuchKey')
      return { buffer: Buffer.from(key), contentType: 'image/jpeg' }
    })
    const visitas = [
      {
        archivos: [
          { key: 'visitas/v1_ana_perez_1.jpg', contentType: 'image/jpeg' },
          { key: 'visitas/v1_ana_perez_2.jpg', contentType: 'image/jpeg' },
        ],
      },
    ]
    const attachments = await buildVisitAttachments(visitas)
    expect(attachments.map((a) => a.filename)).toEqual(['v1_ana_perez_1.jpg'])
  })
})
