'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  User,
  Calendar,
  Clock,
  FileText,
  Pencil,
  ExternalLink,
  ClipboardList,
} from 'lucide-react'
import type { HistorialPaciente as HistorialPacienteType } from '@/lib/actions/pacientes'
import { formatNombre } from '@/lib/paciente'
import { ESTADO_VISITA_STYLES } from '@/lib/estado-colors'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tag } from '@/components/ui/tag'
import { EmptyState } from '@/components/ui/empty-state'

type Props = {
  data: HistorialPacienteType
}

function getEstadoStyle(estado: string) {
  return ESTADO_VISITA_STYLES[estado] ?? ESTADO_VISITA_STYLES.creada!
}

function formatFecha(fecha: string): string {
  const date = new Date(fecha + 'T12:00:00')
  return date.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatHora(hora: string | null): string | null {
  if (!hora) return null
  return hora.slice(0, 5)
}

function formatCosto(costo: number): string {
  return `$${costo.toLocaleString('es-CL')}`
}

export function HistorialPaciente({ data }: Props) {
  const { paciente, visitas } = data
  const [selectedYear, setSelectedYear] = useState<string>('todos')

  const years = [...new Set(visitas.map((v) => v.fecha.slice(0, 4)))].sort((a, b) =>
    b.localeCompare(a),
  )

  const filtered =
    selectedYear === 'todos' ? visitas : visitas.filter((v) => v.fecha.startsWith(selectedYear))

  const totalRealizadas = visitas.filter((v) => v.estado === 'realizada').length
  const totalCanceladas = visitas.filter((v) => v.estado === 'cancelada').length
  const costoTotal = visitas
    .filter((v) => v.estado === 'realizada')
    .reduce((acc, v) => acc + v.costo, 0)

  const nombrePaciente = formatNombre(paciente)

  const groupedByYear: Record<string, typeof filtered> = {}
  for (const v of filtered) {
    const year = v.fecha.slice(0, 4)
    groupedByYear[year] = groupedByYear[year] ?? []
    groupedByYear[year].push(v)
  }
  const sortedYears = Object.keys(groupedByYear).sort((a, b) => b.localeCompare(a))

  return (
    <div className="mx-auto max-w-4xl flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="page-head__crumb">
            <Link href="/pacientes">
              <ArrowLeft className="inline h-3.5 w-3.5" style={{ marginRight: 4 }} />
              Pacientes
            </Link>
            <span className="sep">/</span>
            <span>Historial</span>
          </div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginTop: 4 }}>
            {nombrePaciente}
          </h1>
          <p className="page-head__meta">
            {paciente.identificador && (
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {paciente.identificador}
              </span>
            )}
            {paciente.prevision && <Tag noDot>{paciente.prevision}</Tag>}
            {paciente.comuna && <span>{paciente.comuna}</span>}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild>
            <Link href={`/visitas/nueva?pacienteId=${paciente.id}`}>
              <Calendar />
              Nueva visita
              <ExternalLink className="opacity-60" style={{ width: 12, height: 12 }} />
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href={`/pacientes/${paciente.id}`}>
              <Pencil />
              Editar
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="hl-card grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="text-center">
          <p className="hl-tnum" style={{ fontSize: 'var(--text-2xl)', fontWeight: 600 }}>{visitas.length}</p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>Total visitas</p>
        </div>
        <div className="text-center">
          <p className="hl-tnum" style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--ok-fg)' }}>{totalRealizadas}</p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>Realizadas</p>
        </div>
        <div className="text-center">
          <p className="hl-tnum" style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--color-destructive)' }}>{totalCanceladas}</p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>Canceladas</p>
        </div>
        <div className="text-center">
          <p className="hl-tnum" style={{ fontSize: 'var(--text-2xl)', fontWeight: 600 }}>{formatCosto(costoTotal)}</p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>Costo total</p>
        </div>
      </div>

      {/* Year filter */}
      {years.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={selectedYear === 'todos' ? 'default' : 'secondary'}
            onClick={() => setSelectedYear('todos')}
          >
            Todos
          </Button>
          {years.map((year) => (
            <Button
              key={year}
              size="sm"
              variant={selectedYear === year ? 'default' : 'secondary'}
              onClick={() => setSelectedYear(year)}
            >
              {year}
            </Button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {visitas.length === 0 && (
        <div className="hl-card">
          <EmptyState
            icon={<ClipboardList />}
            title="Sin visitas registradas"
            description="Este paciente no tiene atenciones en el historial"
          />
          <div className="flex justify-center">
            <Button asChild>
              <Link href={`/visitas/nueva?pacienteId=${paciente.id}`}>
                <Calendar />
                Registrar primera visita
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Visit cards grouped by year */}
      {sortedYears.map((year) => (
        <div key={year} className="flex flex-col gap-3">
          <h2 className="hl-label">{year}</h2>
          {(groupedByYear[year] ?? []).map((visita) => {
            const style = getEstadoStyle(visita.estado)
            return (
              <div key={visita.id} className="hl-card hl-card--flush" style={{ borderLeft: `4px solid ${style.border}` }}>
                {/* Card header */}
                <div className="flex items-center justify-between" style={{ padding: '16px 16px 12px' }}>
                  <div>
                    <p style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>{formatFecha(visita.fecha)}</p>
                    {visita.hora && (
                      <p className="flex items-center gap-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>
                        <Clock style={{ width: 12, height: 12 }} />
                        {formatHora(visita.hora)}
                      </p>
                    )}
                  </div>
                  <Badge badgeClass={style.badgeClass} className="capitalize">{visita.estado}</Badge>
                </div>

                <div style={{ height: 1, background: 'var(--color-border)', margin: '0 16px' }} />

                {/* Card body */}
                <div className="flex flex-col gap-3" style={{ padding: '12px 16px' }}>
                  {visita.enfermera && (
                    <p className="flex items-center gap-1.5" style={{ fontSize: 'var(--text-base)', color: 'var(--color-fg-muted)' }}>
                      <User className="shrink-0" style={{ width: 14, height: 14 }} />
                      {visita.enfermera}
                    </p>
                  )}

                  {visita.procedimientos.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>Procedimientos:</span>
                      {visita.procedimientos.map((p, i) => (
                        <Tag key={i} tone={p.categoria === 'curaciones' ? 'amber' : 'neutral'}>{p.nombre}</Tag>
                      ))}
                    </div>
                  )}

                  {visita.examenes.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>Exámenes:</span>
                      {visita.examenes.map((e, i) => (
                        <Tag key={i} tone="violet">{e.nombre}</Tag>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ height: 1, background: 'var(--color-border)', margin: '0 16px' }} />

                {/* Card footer */}
                <div className="flex items-center justify-between" style={{ padding: '12px 16px' }}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="hl-tnum" style={{ fontSize: 'var(--text-base)', fontWeight: 500 }}>{formatCosto(visita.costo)}</span>
                    {visita.numeroBoleta && (
                      <span className="flex items-center gap-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>
                        <FileText style={{ width: 12, height: 12 }} />
                        {visita.tipoDocumento ? `${visita.tipoDocumento} ` : ''}
                        {visita.numeroBoleta}
                      </span>
                    )}
                    {visita.informacionAdicional && (
                      <span
                        className="max-w-xs truncate"
                        style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}
                        title={visita.informacionAdicional}
                      >
                        {visita.informacionAdicional}
                      </span>
                    )}
                  </div>
                  <Link href={`/visitas/${visita.id}`} className="flex items-center gap-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-fg-muted)' }}>
                    <Pencil style={{ width: 12, height: 12 }} />
                    Editar
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
