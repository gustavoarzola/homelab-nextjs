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

type Props = {
  data: HistorialPacienteType
}

const ESTADO_COLORS: Record<string, { border: string; badge: string; badgeText: string; opacity?: string }> = {
  creada: {
    border: 'var(--border)',
    badge: 'oklch(0.92 0 0 / 60%)',
    badgeText: 'var(--muted-foreground)',
  },
  confirmada: {
    border: 'oklch(0.6 0.15 240)',
    badge: 'oklch(0.6 0.15 240 / 15%)',
    badgeText: 'oklch(0.45 0.15 240)',
  },
  realizada: {
    border: 'oklch(0.55 0.15 150)',
    badge: 'oklch(0.55 0.15 150 / 15%)',
    badgeText: 'oklch(0.4 0.15 150)',
  },
  cancelada: {
    border: 'var(--destructive)',
    badge: 'oklch(0.55 0.2 25 / 15%)',
    badgeText: 'var(--destructive)',
    opacity: '0.6',
  },
}

function getEstadoStyle(estado: string) {
  return (ESTADO_COLORS[estado] ?? ESTADO_COLORS.creada)!
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
    <div className="min-h-screen p-6 md:p-8" style={{ background: 'var(--background)' }}>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              <Link
                href="/pacientes"
                className="flex items-center gap-1 hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Pacientes
              </Link>
              <span>/</span>
              <span>Historial</span>
            </div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
              {nombrePaciente}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {paciente.identificador && (
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {paciente.identificador}
                </span>
              )}
              {paciente.prevision && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                >
                  {paciente.prevision}
                </span>
              )}
              {paciente.comuna && (
                <span className="text-xs">{paciente.comuna}</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link
              href={`/visitas/nueva?pacienteId=${paciente.id}`}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              <Calendar className="h-3.5 w-3.5" />
              Nueva visita
              <ExternalLink className="h-3 w-3 opacity-60" />
            </Link>
            <Link
              href={`/pacientes/${paciente.id}`}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div
          className="grid grid-cols-2 gap-3 rounded-xl p-4 sm:grid-cols-4"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="text-center">
            <p className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
              {visitas.length}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Total visitas
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold" style={{ color: 'oklch(0.5 0.15 150)' }}>
              {totalRealizadas}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Realizadas
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold" style={{ color: 'var(--destructive)' }}>
              {totalCanceladas}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Canceladas
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
              {formatCosto(costoTotal)}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Costo total
            </p>
          </div>
        </div>

        {/* Year filter */}
        {years.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedYear('todos')}
              className="rounded-full px-3 py-1 text-sm font-medium transition-colors"
              style={
                selectedYear === 'todos'
                  ? { background: 'var(--foreground)', color: 'var(--background)' }
                  : { background: 'var(--muted)', color: 'var(--muted-foreground)' }
              }
            >
              Todos
            </button>
            {years.map((year) => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className="rounded-full px-3 py-1 text-sm font-medium transition-colors"
                style={
                  selectedYear === year
                    ? { background: 'var(--foreground)', color: 'var(--background)' }
                    : { background: 'var(--muted)', color: 'var(--muted-foreground)' }
                }
              >
                {year}
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {visitas.length === 0 && (
          <div
            className="flex flex-col items-center gap-4 rounded-xl py-16 text-center"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <ClipboardList className="h-10 w-10 opacity-30" style={{ color: 'var(--muted-foreground)' }} />
            <div>
              <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                Sin visitas registradas
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Este paciente no tiene atenciones en el historial
              </p>
            </div>
            <Link
              href={`/visitas/nueva?pacienteId=${paciente.id}`}
              className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              <Calendar className="h-3.5 w-3.5" />
              Registrar primera visita
            </Link>
          </div>
        )}

        {/* Visit cards grouped by year */}
        {sortedYears.map((year) => (
          <div key={year} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
              {year}
            </h2>
<<<<<<< HEAD
            {(groupedByYear[year] ?? []).map((visita) => {
=======
            {groupedByYear[year]?.map((visita) => {
>>>>>>> 33aa8ea (funcionalidades financieras: cotización, pagos, resultados y dashboard)
              const style = getEstadoStyle(visita.estado)
              return (
                <div
                  key={visita.id}
                  className="rounded-xl"
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderLeft: `4px solid ${style?.border ?? 'var(--border)'}`,
                    opacity: style?.opacity ?? '1',
                  }}
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between px-4 pt-4 pb-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                          {formatFecha(visita.fecha)}
                        </p>
                        {visita.hora && (
                          <p className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            <Clock className="h-3 w-3" />
                            {formatHora(visita.hora)}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
                      style={{ background: style?.badge, color: style?.badgeText }}
                    >
                      {visita.estado}
                    </span>
                  </div>

                  <div
                    className="mx-4"
                    style={{ height: '1px', background: 'var(--border)' }}
                  />

                  {/* Card body */}
                  <div className="space-y-3 px-4 py-3">
                    {visita.enfermera && (
                      <p className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        <User className="h-3.5 w-3.5 shrink-0" />
                        {visita.enfermera}
                      </p>
                    )}

                    {visita.procedimientos.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          Procedimientos:
                        </span>
                        {visita.procedimientos.map((p, i) => (
                          <span
                            key={i}
                            className="rounded-full px-2 py-0.5 text-xs font-medium"
                            style={
                              p.categoria === 'curaciones'
                                ? {
                                    background: 'oklch(0.85 0.1 70 / 20%)',
                                    color: 'oklch(0.5 0.1 70)',
                                  }
                                : {
                                    background: 'var(--muted)',
                                    color: 'var(--muted-foreground)',
                                  }
                            }
                          >
                            {p.nombre}
                          </span>
                        ))}
                      </div>
                    )}

                    {visita.examenes.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          Exámenes:
                        </span>
                        {visita.examenes.map((e, i) => (
                          <span
                            key={i}
                            className="rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{
                              background: 'oklch(0.85 0.08 290 / 20%)',
                              color: 'oklch(0.5 0.1 290)',
                            }}
                          >
                            {e.nombre}
                            {e.sucursal && (
                              <span className="opacity-70"> · {e.sucursal}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div
                    className="mx-4"
                    style={{ height: '1px', background: 'var(--border)' }}
                  />

                  {/* Card footer */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        {formatCosto(visita.costo)}
                      </span>
                      {visita.numeroBoleta && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          <FileText className="h-3 w-3" />
                          {visita.tipoDocumento ? `${visita.tipoDocumento} ` : ''}
                          {visita.numeroBoleta}
                        </span>
                      )}
                      {visita.informacionAdicional && (
                        <span
                          className="max-w-xs truncate text-xs"
                          style={{ color: 'var(--muted-foreground)' }}
                          title={visita.informacionAdicional}
                        >
                          {visita.informacionAdicional}
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/visitas/${visita.id}`}
                      className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      <Pencil className="h-3 w-3" />
                      Editar
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
