'use client'

import { useState } from 'react'
import { CatalogSection } from '@/components/catalog-section'

type Item = {
  id: number
  nombre: string
  codigo?: string | null
  activo: boolean
}

type Result = { success: boolean; error?: string }

type Props = {
  procedimientos: Item[]
  examenes: Item[]
  previsiones: Item[]
  residencias: Item[]
  actions: {
    createProcedimiento: (fd: FormData) => Promise<Result>
    updateProcedimiento: (fd: FormData) => Promise<Result>
    toggleProcedimiento: (id: number, activo: boolean) => Promise<Result>
    createExamen: (fd: FormData) => Promise<Result>
    updateExamen: (fd: FormData) => Promise<Result>
    toggleExamen: (id: number, activo: boolean) => Promise<Result>
    createPrevision: (fd: FormData) => Promise<Result>
    updatePrevision: (fd: FormData) => Promise<Result>
    togglePrevision: (id: number, activo: boolean) => Promise<Result>
    createResidencia: (fd: FormData) => Promise<Result>
    updateResidencia: (fd: FormData) => Promise<Result>
    toggleResidencia: (id: number, activo: boolean) => Promise<Result>
  }
}

type Tab = 'procedimientos' | 'examenes' | 'previsiones' | 'residencias'

const TABS: { id: Tab; label: string; count: (p: Props) => number }[] = [
  { id: 'procedimientos', label: 'Procedimientos', count: (p) => p.procedimientos.length },
  { id: 'examenes', label: 'Exámenes', count: (p) => p.examenes.length },
  { id: 'previsiones', label: 'Previsiones de Salud', count: (p) => p.previsiones.length },
  { id: 'residencias', label: 'Residencias', count: (p) => p.residencias.length },
]

export function CatalogosPage(props: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('procedimientos')
  const { actions } = props

  return (
    <div>
      {/* Tabs */}
      <div
        className="mb-6 flex gap-1 rounded-xl p-1"
        style={{ backgroundColor: 'var(--muted)' }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={
              activeTab === tab.id
                ? {
                    backgroundColor: 'var(--card)',
                    color: 'var(--foreground)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  }
                : {
                    color: 'var(--muted-foreground)',
                  }
            }
          >
            {tab.label}
            <span
              className="rounded-full px-1.5 py-0.5 text-xs"
              style={
                activeTab === tab.id
                  ? { backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }
                  : { backgroundColor: 'var(--background)', color: 'var(--muted-foreground)' }
              }
            >
              {tab.count(props)}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'procedimientos' && (
        <CatalogSection
          items={props.procedimientos}
          hasCode
          entityLabel="Procedimiento"
          onCreate={actions.createProcedimiento}
          onUpdate={actions.updateProcedimiento}
          onToggle={actions.toggleProcedimiento}
        />
      )}
      {activeTab === 'examenes' && (
        <CatalogSection
          items={props.examenes}
          hasCode
          entityLabel="Examen"
          onCreate={actions.createExamen}
          onUpdate={actions.updateExamen}
          onToggle={actions.toggleExamen}
        />
      )}
      {activeTab === 'previsiones' && (
        <CatalogSection
          items={props.previsiones}
          entityLabel="Previsión"
          onCreate={actions.createPrevision}
          onUpdate={actions.updatePrevision}
          onToggle={actions.togglePrevision}
        />
      )}
      {activeTab === 'residencias' && (
        <CatalogSection
          items={props.residencias}
          entityLabel="Residencia"
          onCreate={actions.createResidencia}
          onUpdate={actions.updateResidencia}
          onToggle={actions.toggleResidencia}
        />
      )}
    </div>
  )
}
