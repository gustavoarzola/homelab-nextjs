'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { SelectCombobox } from '@/components/select-combobox'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { guardarGastosMensuales, type GastoMensualFormRow } from '@/lib/actions/gastos-mensuales'

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
].map((label, i) => ({ id: i + 1, label }))

const CLP = (n: number) => '$' + (n || 0).toLocaleString('es-CL')

type Props = {
  rows: GastoMensualFormRow[]
  month: number
  year: number
  isAdmin: boolean
}

type Draft = Record<number, { monto: string; notas: string }>

function toDraft(rows: GastoMensualFormRow[]): Draft {
  return Object.fromEntries(
    rows.map((r) => [r.idCategoria, { monto: r.monto ? String(r.monto) : '', notas: r.notas }]),
  )
}

export function GastosMensualesForm({ rows, month, year, isAdmin }: Props) {
  const router = useRouter()
  const [selectedMonth, setSelectedMonth] = React.useState<number | null>(month)
  const [selectedYear, setSelectedYear] = React.useState<number | null>(year)
  const [draft, setDraft] = React.useState<Draft>(() => toDraft(rows))
  const [isNavigating, startNavigation] = React.useTransition()
  const [isSaving, startSaving] = React.useTransition()

  const years = React.useMemo(() => {
    const current = new Date().getFullYear()
    const out: { id: number; label: string }[] = []
    for (let y = Math.max(year, current) + 1; y >= Math.min(year, current) - 3; y--) out.push({ id: y, label: String(y) })
    return out
  }, [year])

  const montoDe = (id: number) => Number((draft[id]?.monto ?? '').replace(/[^\d]/g, '')) || 0
  // Las filas ya vienen ordenadas por grupo → categoría (getGastosMensuales).
  const grupos = rows.reduce<{ grupo: string; items: GastoMensualFormRow[] }[]>((acc, r) => {
    const last = acc[acc.length - 1]
    if (last && last.grupo === r.grupo) last.items.push(r)
    else acc.push({ grupo: r.grupo, items: [r] })
    return acc
  }, [])
  const total = rows.reduce((acc, r) => acc + montoDe(r.idCategoria), 0)
  const dirty = rows.some((r) => montoDe(r.idCategoria) !== r.monto || (draft[r.idCategoria]?.notas ?? '') !== r.notas)

  function goTo() {
    if (!selectedMonth || !selectedYear) return
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Cambiar de mes igual?')) return
    startNavigation(() => router.push(`/gastos-mensuales?month=${selectedMonth}&year=${selectedYear}`))
  }

  function setField(id: number, field: 'monto' | 'notas', value: string) {
    setDraft((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { monto: '', notas: '' }), [field]: value } }))
  }

  function handleSave() {
    startSaving(async () => {
      const result = await guardarGastosMensuales({
        anio: year,
        mes: month,
        items: rows.map((r) => ({
          idCategoria: r.idCategoria,
          monto: montoDe(r.idCategoria),
          notas: draft[r.idCategoria]?.notas ?? '',
        })),
      })
      if (result.success) {
        toast.success(`Gastos de ${MONTHS[month - 1]!.label} ${year} guardados`)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="toolbar">
        <div className="toolbar__field">
          <label className="hl-label">Mes</label>
          <div className="w-[200px] min-w-0">
            <SelectCombobox mode="single" options={MONTHS} selected={selectedMonth} onChange={setSelectedMonth} placeholder="Mes" clearable={false} />
          </div>
        </div>
        <div className="toolbar__field">
          <label className="hl-label">Año</label>
          <div className="w-[140px] min-w-0">
            <SelectCombobox mode="single" options={years} selected={selectedYear} onChange={setSelectedYear} placeholder="Año" clearable={false} />
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={goTo}
          disabled={isNavigating || !selectedMonth || !selectedYear || (selectedMonth === month && selectedYear === year)}
        >
          Ver mes
        </Button>
      </div>

      <div className="hl-card hl-card--flush">
        <div className="overflow-x-auto">
          <table className="hl-table">
            <thead>
              <tr>
                <th>Categoría</th>
                <th className="hl-num" style={{ width: 200 }}>Monto</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3}>
                    <EmptyState
                      title="No hay categorías de gasto activas"
                      description={
                        isAdmin
                          ? <>Créalas en <Link href="/categorias-gastos" style={{ color: 'var(--color-primary)' }}>Categorías de gastos</Link>.</>
                          : 'Pídele a un administrador que cree las categorías de gasto.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                grupos.flatMap(({ grupo, items }) => [
                  <tr key={`g-${grupo}`} style={{ background: 'var(--color-surface-muted)' }}>
                    <td style={{ fontWeight: 600 }}>{grupo}</td>
                    <td className="hl-num hl-tnum" style={{ fontWeight: 600 }}>
                      {CLP(items.reduce((acc, r) => acc + montoDe(r.idCategoria), 0))}
                    </td>
                    <td />
                  </tr>,
                  ...items.map((r) => (
                  <tr key={r.idCategoria}>
                    <td style={{ fontWeight: 500, paddingLeft: 'calc(var(--cell-px) * 2)' }}>
                      {r.categoria}
                      {!r.activo && (
                        <span style={{ color: 'var(--color-fg-muted)', fontWeight: 400 }}> (inactiva)</span>
                      )}
                    </td>
                    <td className="hl-num">
                      <div className="hl-input">
                        <span className="hl-affix" style={{ width: 'auto', height: 'auto' }}>$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label={`Monto ${r.categoria}`}
                          className="hl-tnum"
                          style={{ textAlign: 'right' }}
                          value={draft[r.idCategoria]?.monto ? Number(draft[r.idCategoria]!.monto.replace(/[^\d]/g, '') || 0).toLocaleString('es-CL') : ''}
                          onChange={(e) => setField(r.idCategoria, 'monto', e.target.value.replace(/[^\d]/g, ''))}
                          placeholder="0"
                        />
                      </div>
                    </td>
                    <td>
                      <div className="hl-input">
                        <input
                          type="text"
                          aria-label={`Notas ${r.categoria}`}
                          value={draft[r.idCategoria]?.notas ?? ''}
                          onChange={(e) => setField(r.idCategoria, 'notas', e.target.value)}
                          placeholder="Opcional (n° factura, detalle…)"
                          maxLength={1000}
                        />
                      </div>
                    </td>
                  </tr>
                  )),
                ])
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--color-surface-muted)', borderTop: '1px solid var(--color-border)' }}>
                  <td style={{ padding: 'var(--row-py) var(--cell-px)', fontWeight: 600 }}>Total del mes</td>
                  <td className="hl-num hl-tnum" style={{ padding: 'var(--row-py) var(--cell-px)', fontWeight: 600 }}>{CLP(total)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="flex items-center justify-end gap-3">
          {dirty && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>Cambios sin guardar</span>}
          <Button onClick={handleSave} disabled={isSaving || !dirty}>
            {isSaving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      )}
    </div>
  )
}
