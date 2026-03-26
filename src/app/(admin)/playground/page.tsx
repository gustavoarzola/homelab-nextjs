'use client'

import { useState } from 'react'
import { type DateRange } from 'react-day-picker'
import { SelectCombobox } from '@/components/select-combobox'
import { TimePicker } from '@/components/time-picker'
import { DatePicker, DateRangePicker } from '@/components/date-picker'

const EXAMENES = [
  { id: 1,  label: 'Hemograma completo' },
  { id: 2,  label: 'Perfil bioquímico' },
  { id: 3,  label: 'Glicemia en ayunas' },
  { id: 4,  label: 'Hemoglobina glicosilada (HbA1c)' },
  { id: 5,  label: 'Perfil lipídico' },
  { id: 6,  label: 'TSH (hormona tiroestimulante)' },
  { id: 7,  label: 'Creatinina y BUN' },
  { id: 8,  label: 'Orina completa' },
  { id: 9,  label: 'Proteína C reactiva (PCR)' },
  { id: 10, label: 'Tiempo de protrombina (TP/INR)' },
  { id: 11, label: 'Ferritina y hierro sérico' },
  { id: 12, label: 'Vitamina D (25-OH)' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-3" style={{ gridTemplateColumns: '160px 1fr' }}>
      <span className="pt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
      <div className="max-w-sm">{children}</div>
    </div>
  )
}

export default function PlaygroundPage() {
  const [multiSelected, setMultiSelected] = useState<number[]>([1, 3])
  const [singleSelected, setSingleSelected] = useState<number | null>(2)
  const [time, setTime] = useState<string | null>('09:00')
  const [timeEmpty, setTimeEmpty] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [pickerDate, setPickerDate] = useState<Date | undefined>(new Date())
  const [pickerRange, setPickerRange] = useState<DateRange | undefined>(undefined)

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <h1 className="mb-1 text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
        Playground
      </h1>
      <p className="mb-10 text-sm" style={{ color: 'var(--muted-foreground)' }}>
        Prueba de componentes UI
      </p>

      <div className="flex flex-col gap-10">

        {/* SelectCombobox */}
        <Section title="SelectCombobox">
          <Row label="Multi-selección">
            <SelectCombobox
              options={EXAMENES}
              selected={multiSelected}
              onChange={setMultiSelected}
              placeholder="Buscar examen…"
            />
            <p className="mt-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Seleccionados: {multiSelected.length > 0
                ? multiSelected.map(id => EXAMENES.find(e => e.id === id)?.label).join(', ')
                : '—'}
            </p>
          </Row>
          <Row label="Selección única">
            <SelectCombobox
              mode="single"
              options={EXAMENES}
              selected={singleSelected}
              onChange={setSingleSelected}
              placeholder="Buscar examen…"
            />
            <p className="mt-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Seleccionado: {singleSelected ? EXAMENES.find(e => e.id === singleSelected)?.label : '—'}
            </p>
          </Row>
          <Row label="Deshabilitado">
            <SelectCombobox
              options={EXAMENES}
              selected={[1, 5]}
              onChange={() => {}}
              placeholder="Buscar examen…"
              disabled
            />
          </Row>
        </Section>

        {/* TimePicker */}
        <Section title="TimePicker">
          <Row label="Con valor">
            <TimePicker value={time} onChange={setTime} className="w-full" />
            <p className="mt-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Valor: {time ?? '—'}
            </p>
          </Row>
          <Row label="Sin valor">
            <TimePicker value={timeEmpty} onChange={setTimeEmpty} className="w-full" />
          </Row>
          <Row label="Deshabilitado">
            <TimePicker value="14:30" onChange={() => {}} disabled className="w-full" />
          </Row>
        </Section>

        {/* DatePicker shadcn */}
        <Section title="DatePicker (shadcn)">
          <Row label="Fecha simple">
            <DatePicker value={pickerDate} onChange={setPickerDate} className="w-full" />
            <p className="mt-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Valor: {pickerDate?.toLocaleDateString('es-CL') ?? '—'}
            </p>
          </Row>
          <Row label="Sin valor">
            <DatePicker value={undefined} onChange={() => {}} className="w-full" />
          </Row>
          <Row label="Rango (2 meses)">
            <DateRangePicker value={pickerRange} onChange={setPickerRange} className="w-full" />
            <p className="mt-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Desde: {pickerRange?.from?.toLocaleDateString('es-CL') ?? '—'} · Hasta: {pickerRange?.to?.toLocaleDateString('es-CL') ?? '—'}
            </p>
          </Row>
          <Row label="Deshabilitado">
            <DatePicker value={new Date()} onChange={() => {}} disabled className="w-full" />
          </Row>
        </Section>

        {/* Input date nativo */}
        <Section title="Input date (nativo)">
          <Row label="Fecha simple">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ backgroundColor: 'var(--background)', border: '1px solid var(--input)', color: 'var(--foreground)' }}
            />
          </Row>
          <Row label="Rango">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--input)', color: 'var(--foreground)' }}
              />
              <span className="text-xs shrink-0" style={{ color: 'var(--muted-foreground)' }}>→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                style={{ backgroundColor: 'var(--background)', border: '1px solid var(--input)', color: 'var(--foreground)' }}
              />
            </div>
            <p className="mt-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {dateFrom || '—'} → {dateTo || '—'}
            </p>
          </Row>
        </Section>

      </div>
    </div>
  )
}
