'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { SelectCombobox } from '@/components/select-combobox'

const MONTHS = [
  { id: 1, label: 'Enero' },
  { id: 2, label: 'Febrero' },
  { id: 3, label: 'Marzo' },
  { id: 4, label: 'Abril' },
  { id: 5, label: 'Mayo' },
  { id: 6, label: 'Junio' },
  { id: 7, label: 'Julio' },
  { id: 8, label: 'Agosto' },
  { id: 9, label: 'Septiembre' },
  { id: 10, label: 'Octubre' },
  { id: 11, label: 'Noviembre' },
  { id: 12, label: 'Diciembre' },
]

type Props = {
  month: number
  year: number
}

export function DashboardFilters({ month, year }: Props) {
  const router = useRouter()
  const [selectedMonth, setSelectedMonth] = React.useState<number | null>(month)
  const [selectedYear, setSelectedYear] = React.useState<number | null>(year)
  const [isPending, startTransition] = React.useTransition()

  const years = React.useMemo(() => {
    const currentYear = new Date().getFullYear()
    const firstYear = Math.min(year, currentYear) - 2
    const lastYear = Math.max(year, currentYear) + 1
    const options: { id: number; label: string }[] = []

    for (let current = lastYear; current >= firstYear; current -= 1) {
      options.push({ id: current, label: String(current) })
    }

    return options
  }, [year])

  const handleApply = () => {
    if (!selectedMonth || !selectedYear) return

    startTransition(() => {
      router.push(`/dashboard?month=${selectedMonth}&year=${selectedYear}`)
    })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-[224px] min-w-0">
        <SelectCombobox
          mode="single"
          options={MONTHS}
          selected={selectedMonth}
          onChange={setSelectedMonth}
          placeholder="Mes"
          clearable={false}
        />
      </div>

      <div className="w-[152px] min-w-0">
        <SelectCombobox
          mode="single"
          options={years}
          selected={selectedYear}
          onChange={setSelectedYear}
          placeholder="Año"
          clearable={false}
        />
      </div>

      <button
        type="button"
        onClick={handleApply}
        disabled={isPending || !selectedMonth || !selectedYear}
        className="h-10 rounded-full border px-6 text-sm font-medium transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          borderColor: 'var(--primary)',
          color: 'var(--primary)',
          backgroundColor: 'var(--background)',
        }}
      >
        Filtrar
      </button>
    </div>
  )
}
