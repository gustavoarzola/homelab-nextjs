// Tipos compartidos entre server actions (`src/lib/**`) y componentes.
// `data-table.tsx` los re-exporta para no romper imports existentes.

export type SearchParams = {
  filters: Record<string, string | boolean>
  sort: { key: string; dir: 'asc' | 'desc' } | null
  page: number
  pageSize: number
}

export type SelectOption = { value: string; label: string }
