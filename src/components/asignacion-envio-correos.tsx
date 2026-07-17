'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Mail, Loader2, AlertCircle, Calendar, ExternalLink } from 'lucide-react'
import { getVisitasAsignadasPorEnfermera, getVisitasSinAsignarPorFecha, sendScheduledVisitsEmail, sendAllScheduledVisitsEmails } from '@/lib/actions/visitas-asignacion-email'
import type { EnfermeraConVisitas, VisitaSinAsignar } from '@/lib/actions/visitas-asignacion-email'
import { formatDateLong } from '@/lib/format'
import { formatNombre } from '@/lib/paciente'
import { FormDatePicker } from '@/components/form-date-picker'
import { toast } from 'sonner'

type Props = {
  initialFecha: string
  initialEnfermeras: EnfermeraConVisitas[]
  initialVisitasSinAsignar: VisitaSinAsignar[]
}

export function AsignacionEnvioCorreos({ initialFecha, initialEnfermeras, initialVisitasSinAsignar }: Props) {
  const [fecha, setFecha] = useState(initialFecha)
  const [fechaBuscada, setFechaBuscada] = useState(initialFecha)
  const [enfermeras, setEnfermeras] = useState(initialEnfermeras)
  const [visitasSinAsignar, setVisitasSinAsignar] = useState(initialVisitasSinAsignar)
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)

  const handleBuscar = () => {
    setLoading(true)
    startTransition(async () => {
      try {
        const [result, sinAsignar] = await Promise.all([
          getVisitasAsignadasPorEnfermera(fecha),
          getVisitasSinAsignarPorFecha(fecha),
        ])
        setEnfermeras(result)
        setVisitasSinAsignar(sinAsignar)
        setFechaBuscada(fecha)
        if (result.length === 0 && sinAsignar.length === 0) {
          toast.info('No hay visitas para esta fecha')
        }
      } catch (error) {
        toast.error('Error al buscar visitas')
      } finally {
        setLoading(false)
      }
    })
  }

  const handleEnviarUnica = (enfermera: EnfermeraConVisitas) => {
    startTransition(async () => {
      try {
        const result = await sendScheduledVisitsEmail(enfermera)
        if (result.success) {
          toast.success(`Correo enviado a ${formatNombre(enfermera)}`)
        } else {
          toast.error(result.error || 'Error al enviar correo')
        }
      } catch (error) {
        toast.error('Error al enviar correo')
      }
    })
  }

  const handleEnviarTodos = () => {
    if (enfermeras.length === 0) {
      toast.warning('No hay enfermeras con visitas para enviar')
      return
    }

    startTransition(async () => {
      try {
        const result = await sendAllScheduledVisitsEmails(enfermeras)
        if (result.success) {
          toast.success(`Correos enviados a ${enfermeras.length} enfermera(s)`)
        }
        if (result.error) {
          toast.info(result.error)
        }
      } catch (error) {
        toast.error('Error al enviar correos')
      }
    })
  }

  const totalVisitas = enfermeras.reduce((sum, e) => sum + e.visitas.length, 0)

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Envío de Programación
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Envíe las programaciones de visitas a las enfermeras por correo
        </p>
      </div>

      {/* Busqueda */}
      <div
        className="rounded-lg border p-6"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
              Seleccione una fecha
            </label>
            <FormDatePicker
              mode="single"
              value={fecha}
              onChange={(value) => setFecha(value ?? '')}
              disabled={loading}
              weekStartsOn={1}
              placeholder="Seleccionar fecha"
              className="w-full"
            />
          </div>
          <button
            onClick={handleBuscar}
            disabled={loading || isPending}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
            Buscar
          </button>
        </div>
      </div>

      {/* Visitas sin asignar */}
      {visitasSinAsignar.length > 0 && (
        <div
          className="rounded-lg border p-4"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--destructive)' }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2" style={{ color: 'var(--destructive)' }}>
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="text-sm font-medium">
                {visitasSinAsignar.length} visita(s) confirmada(s) sin enfermera asignada — no se podrán enviar
              </p>
            </div>
            <Link
              href="/asignacion"
              className="flex shrink-0 items-center gap-1 text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--primary)' }}
            >
              Ir a asignar <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <ul className="mt-2 space-y-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {visitasSinAsignar.map((v) => (
              <li key={v.id}>
                {v.hora ? `${v.hora} — ` : ''}{v.pacienteNombre}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Resumen */}
      {enfermeras.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div
            className="rounded-lg border p-4"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
              Enfermeras
            </p>
            <p className="mt-1 text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
              {enfermeras.length}
            </p>
          </div>
          <div
            className="rounded-lg border p-4"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
              Visitas
            </p>
            <p className="mt-1 text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
              {totalVisitas}
            </p>
          </div>
          <div
            className="rounded-lg border p-4"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
              Fecha
            </p>
            <p
              className="mt-1 text-sm font-semibold"
              style={{ color: 'var(--foreground)' }}
            >
              {formatDateLong(fechaBuscada)}
            </p>
          </div>
        </div>
      )}

      {/* Tabla de enfermeras */}
      {enfermeras.length > 0 ? (
        <div
          className="rounded-lg border overflow-hidden"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: 'var(--muted)' }}>
                  <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    Enfermera
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    Correo
                  </th>
                  <th className="px-6 py-3 text-center text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    Visitas
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    Pacientes
                  </th>
                  <th className="px-6 py-3 text-center text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {enfermeras.map((enfermera, idx) => (
                  <tr
                    key={enfermera.id}
                    style={{
                      backgroundColor: idx % 2 === 0 ? 'var(--card)' : 'var(--muted)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {formatNombre(enfermera)}
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      {enfermera.correo ? (
                        <a
                          href={`mailto:${enfermera.correo}`}
                          style={{ color: 'var(--primary)' }}
                          className="hover:underline"
                        >
                          {enfermera.correo}
                        </a>
                      ) : (
                        <span className="flex items-center gap-1" style={{ color: 'var(--destructive)' }}>
                          <AlertCircle className="h-4 w-4" />
                          Sin correo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                      {enfermera.visitas.length}
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      <div className="space-y-1">
                        {enfermera.visitas.map((v) => (
                          <div key={v.id}>
                            {formatNombre(v.paciente)}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleEnviarUnica(enfermera)}
                        disabled={!enfermera.correo || isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-30"
                        style={{
                          backgroundColor: enfermera.correo ? 'var(--primary)' : 'var(--muted)',
                          color: enfermera.correo ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                        }}
                      >
                        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                        Enviar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div
          className="rounded-lg border p-8 text-center"
          style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
        >
          <p style={{ color: 'var(--muted-foreground)' }}>
            Seleccione una fecha para ver las visitas asignadas
          </p>
        </div>
      )}

      {/* Botón enviar a todos */}
      {enfermeras.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleEnviarTodos}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Enviar a todos ({enfermeras.length})
          </button>
        </div>
      )}
    </div>
  )
}
