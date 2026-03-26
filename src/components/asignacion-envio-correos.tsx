'use client'

import { useState, useTransition } from 'react'
import { Mail, Loader2, AlertCircle, Calendar } from 'lucide-react'
import { getVisitasAsignadasPorEnfermera, sendScheduledVisitsEmail, sendAllScheduledVisitsEmails } from '@/lib/actions/visitas-asignacion-email'
import type { EnfermeraConVisitas } from '@/lib/actions/visitas-asignacion-email'
import { formatDateLong } from '@/lib/format'
import { toast } from 'sonner'

type Props = {
  initialFecha: string
  initialEnfermeras: EnfermeraConVisitas[]
}

export function AsignacionEnvioCorreos({ initialFecha, initialEnfermeras }: Props) {
  const [fecha, setFecha] = useState(initialFecha)
  const [fechaBuscada, setFechaBuscada] = useState(initialFecha)
  const [enfermeras, setEnfermeras] = useState(initialEnfermeras)
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)

  const handleBuscar = () => {
    setLoading(true)
    startTransition(async () => {
      try {
        const result = await getVisitasAsignadasPorEnfermera(fecha)
        setEnfermeras(result)
        setFechaBuscada(fecha)
        if (result.length === 0) {
          toast.info('No hay visitas asignadas para esta fecha')
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
          toast.success(`Correo enviado a ${enfermera.apellidoPaterno}, ${enfermera.nombre}`)
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
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={loading}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--input)',
                color: 'var(--foreground)',
              }}
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
                      {enfermera.apellidoPaterno}, {enfermera.nombre}
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
                            {v.paciente.apellidoPaterno}, {v.paciente.nombres}
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
