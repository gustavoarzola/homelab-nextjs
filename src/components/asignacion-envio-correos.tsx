'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Mail, Loader2, AlertCircle, Calendar, ExternalLink } from 'lucide-react'
import { getVisitasAsignadasPorEnfermera, getVisitasSinAsignarPorFecha, sendScheduledVisitsEmail, sendAllScheduledVisitsEmails } from '@/lib/actions/visitas-asignacion-email'
import type { EnfermeraConVisitas, VisitaSinAsignar } from '@/lib/actions/visitas-asignacion-email'
import { formatDateLong } from '@/lib/format'
import { formatNombre } from '@/lib/paciente'
import { FormDatePicker } from '@/components/form-date-picker'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { MetaGrid, MetaTile } from '@/components/ui/meta'
import { EmptyState } from '@/components/ui/empty-state'
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
    <div className="flex flex-col gap-5">
      <PageHeader title="Envío de Programación" meta="Envíe las programaciones de visitas a las enfermeras por correo" />

      {/* Busqueda */}
      <div className="hl-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="hl-fieldgroup flex-1">
            <label>Seleccione una fecha</label>
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
          <Button onClick={handleBuscar} disabled={loading || isPending}>
            {loading ? <Loader2 className="animate-spin" /> : <Calendar />}
            Buscar
          </Button>
        </div>
      </div>

      {/* Visitas sin asignar */}
      {visitasSinAsignar.length > 0 && (
        <div className="hl-card">
          <Callout tone="bad">
            <div className="flex items-center justify-between gap-4">
              <p style={{ fontWeight: 500 }}>
                {visitasSinAsignar.length} visita(s) confirmada(s) sin enfermera asignada — no se podrán enviar
              </p>
              <Link href="/asignacion" className="flex shrink-0 items-center gap-1 hover:opacity-70" style={{ fontSize: 'var(--text-xs)' }}>
                Ir a asignar <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </Callout>
          <ul className="mt-2" style={{ fontSize: 'var(--text-base)', color: 'var(--color-fg-muted)' }}>
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
        <MetaGrid>
          <MetaTile label="Enfermeras" value={enfermeras.length} />
          <MetaTile label="Visitas" value={totalVisitas} />
          <MetaTile label="Fecha" value={formatDateLong(fechaBuscada)} />
        </MetaGrid>
      )}

      {/* Tabla de enfermeras */}
      {enfermeras.length > 0 ? (
        <div className="hl-card hl-card--flush">
          <div className="overflow-x-auto">
            <table className="hl-table">
              <thead>
                <tr>
                  <th>Enfermera</th>
                  <th>Correo</th>
                  <th style={{ textAlign: 'center' }}>Visitas</th>
                  <th>Pacientes</th>
                  <th style={{ textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {enfermeras.map((enfermera) => (
                  <tr key={enfermera.id}>
                    <td style={{ fontWeight: 500 }}>
                      {formatNombre(enfermera)}
                    </td>
                    <td>
                      {enfermera.correo ? (
                        <a href={`mailto:${enfermera.correo}`} style={{ color: 'var(--color-primary)' }} className="hover:underline">
                          {enfermera.correo}
                        </a>
                      ) : (
                        <span className="flex items-center gap-1" style={{ color: 'var(--color-destructive)' }}>
                          <AlertCircle className="h-4 w-4" />
                          Sin correo
                        </span>
                      )}
                    </td>
                    <td className="hl-tnum" style={{ textAlign: 'center', fontWeight: 600 }}>
                      {enfermera.visitas.length}
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        {enfermera.visitas.map((v) => (
                          <div key={v.id}>
                            {formatNombre(v.paciente)}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Button
                        variant={enfermera.correo ? 'default' : 'secondary'}
                        size="sm"
                        onClick={() => handleEnviarUnica(enfermera)}
                        disabled={!enfermera.correo || isPending}
                      >
                        {isPending ? <Loader2 className="animate-spin" /> : <Mail />}
                        Enviar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="hl-card">
          <EmptyState title="Seleccione una fecha para ver las visitas asignadas" />
        </div>
      )}

      {/* Botón enviar a todos */}
      {enfermeras.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleEnviarTodos} disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : <Mail />}
            Enviar a todos ({enfermeras.length})
          </Button>
        </div>
      )}
    </div>
  )
}
