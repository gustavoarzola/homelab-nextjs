'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createTasaRetencion, type TasaRetencionRow } from '@/lib/actions/tasas-retencion'
import { formatDate } from '@/lib/format'

type Props = { tasas: TasaRetencionRow[] }

export function TasasRetencionCard({ tasas }: Props) {
  const router = useRouter()
  const [vigenteDesde, setVigenteDesde] = React.useState('')
  const [porcentaje, setPorcentaje] = React.useState('')
  const [isPending, startTransition] = React.useTransition()

  const submit = () => {
    const fd = new FormData()
    fd.set('vigenteDesde', vigenteDesde)
    fd.set('porcentaje', porcentaje.replace(',', '.'))
    startTransition(async () => {
      const res = await createTasaRetencion(fd)
      if (!res.success) return void toast.error(res.error)
      toast.success('Tasa guardada')
      setVigenteDesde('')
      setPorcentaje('')
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-fg-muted)' }}>
        Retención de las boletas de honorarios. Cada tasa rige desde su fecha hasta la siguiente; no se editan las anteriores, así los meses
        ya reportados no cambian.
      </p>
      <div className="hl-card hl-card--flush">
        <table className="hl-table">
          <thead>
            <tr>
              <th>Vigente desde</th>
              <th className="hl-num">Retención</th>
            </tr>
          </thead>
          <tbody>
            {tasas.map((t) => (
              <tr key={t.id}>
                <td>{formatDate(t.vigenteDesde)}</td>
                <td className="hl-num hl-tnum">{t.porcentaje.toLocaleString('es-CL')} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="toolbar">
        <div className="toolbar__field">
          <label className="hl-label" htmlFor="tasa-desde">Vigente desde</label>
          <Input id="tasa-desde" type="date" value={vigenteDesde} onChange={(e) => setVigenteDesde(e.target.value)} />
        </div>
        <div className="toolbar__field">
          <label className="hl-label" htmlFor="tasa-pct">Retención (%)</label>
          <Input id="tasa-pct" inputMode="decimal" placeholder="ej: 15,25" value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} />
        </div>
        <Button onClick={submit} disabled={isPending || !vigenteDesde || !porcentaje}>
          Agregar tasa
        </Button>
      </div>
    </div>
  )
}
