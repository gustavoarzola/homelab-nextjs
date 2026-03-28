'use client'

import { useState } from 'react'
import { es } from 'date-fns/locale'
import { type DateRange } from 'react-day-picker'
import { SelectCombobox } from '@/components/select-combobox'
import { TimePicker } from '@/components/time-picker'
import { SimpleCalendar } from '@/components/simple-calendar'
import { SimpleDatePicker } from '@/components/simple-date-picker'
import { BirthDatePicker } from '@/components/birth-date-picker'
import { FormDatePicker } from '@/components/form-date-picker'

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
  const today = new Date()
  const [multiSelected, setMultiSelected] = useState<number[]>([1, 3])
  const [singleSelected, setSingleSelected] = useState<number | null>(2)
  const [time, setTime] = useState<string | null>('09:00')
  const [timeEmpty, setTimeEmpty] = useState<string | null>(null)
  const [simpleSingleEmpty, setSimpleSingleEmpty] = useState<Date | undefined>(undefined)
  const [simpleSingleSelected, setSimpleSingleSelected] = useState<Date | undefined>(
    new Date(2026, 3, 8),
  )
  const [simpleRange, setSimpleRange] = useState<DateRange | undefined>(undefined)
  const [formSingle, setFormSingle] = useState<string | undefined>(undefined)
  const [formRange, setFormRange] = useState<{ from?: string; to?: string } | undefined>(undefined)
  const [birthDate, setBirthDate] = useState<string | undefined>(undefined)
  const [birthDatePreset, setBirthDatePreset] = useState<string | undefined>('1988-04-23')

  return (
    <div className="mx-auto max-w-2xl px-8 pt-10 pb-[410px]">
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

        <Section title="SimpleCalendar">
          <Row label="Single vacío">
            <SimpleCalendar
              animate
              mode="single"
              weekStartsOn={1}
              locale={es}
              today={today}
              selected={simpleSingleEmpty}
              onSelect={setSimpleSingleEmpty}
            />
          </Row>
          <Row label="Single con fecha">
            <SimpleCalendar
              animate
              mode="single"
              weekStartsOn={1}
              locale={es}
              today={today}
              selected={simpleSingleSelected}
              onSelect={setSimpleSingleSelected}
            />
          </Row>
          <Row label="Docs config">
            <SimpleCalendar
              animate
              mode="range"
              weekStartsOn={1}
              locale={es}
              today={today}
              selected={simpleRange}
              onSelect={setSimpleRange}
            />
          </Row>
        </Section>

        <Section title="SimpleDatePicker">
          <Row label="Single">
            <SimpleDatePicker
              animate
              mode="single"
              weekStartsOn={1}
              locale={es}
              today={today}
              placeholder="Seleccionar fecha"
            />
          </Row>
          <Row label="Range">
            <SimpleDatePicker
              animate
              mode="range"
              weekStartsOn={1}
              locale={es}
              today={today}
              placeholder="Seleccionar rango"
            />
          </Row>
        </Section>

        <Section title="FormDatePicker">
          <Row label="Single">
            <FormDatePicker
              mode="single"
              value={formSingle}
              onChange={setFormSingle}
              weekStartsOn={1}
              locale={es}
              today={today}
              name="fecha"
              placeholder="Seleccionar fecha"
            />
            <p className="mt-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Valor real: {formSingle ?? '—'}
            </p>
          </Row>
          <Row label="Range">
            <FormDatePicker
              mode="range"
              value={formRange}
              onChange={setFormRange}
              weekStartsOn={1}
              locale={es}
              today={today}
              nameFrom="fechaInicio"
              nameTo="fechaFin"
              placeholder="Seleccionar rango"
            />
            <p className="mt-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Desde: {formRange?.from ?? '—'} · Hasta: {formRange?.to ?? '—'}
            </p>
          </Row>
        </Section>

        <Section title="BirthDatePicker">
          <Row label="Vacío">
            <BirthDatePicker
              value={birthDate}
              onChange={setBirthDate}
              name="fechaNacimiento"
            />
            <p className="mt-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Valor real: {birthDate ?? '—'}
            </p>
          </Row>
          <Row label="Con valor">
            <BirthDatePicker
              value={birthDatePreset}
              onChange={setBirthDatePreset}
            />
            <p className="mt-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Valor real: {birthDatePreset ?? '—'}
            </p>
          </Row>
        </Section>

      </div>
    </div>
  )
}
