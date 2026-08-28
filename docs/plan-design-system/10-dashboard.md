# Paso 10 — Dashboard

**Estado: hecho.**

Sin mockup dedicado — "extender el DS por analogía". Hecho directamente en esta sesión
(574 líneas combinadas entre 6 archivos, alcance acotado). Este era el único rincón del
repo con un dialecto visual propio (glassmorphism: gradientes `rgba(...)`, sombras
`shadow-[0_12px_30px_-20px_...]`, bordes `border-black/5`) que nunca convergió con el
resto de la app ni siquiera antes de este plan — ver `CLAUDE.md`, sección de convenciones.

## Qué se hizo

- **`dashboard/page.tsx`**: eliminado el wrapper `-m-8 bg-[radial-gradient(...),linear-gradient(...)]`
  y la card de header con `border-black/5 bg-white/90 shadow-[...] backdrop-blur-sm` — la
  página ahora vive dentro del flujo normal de `.app-body` como cualquier otra, con
  `PageHeader` (título "Visitas del mes", meta = nombre del usuario, acciones = filtros)
  igual que el resto del admin. Se sacaron los `relative z-0`/`z-20` de cada sección (solo
  existían para el apilamiento del glassmorphism, sin motivo con fondo plano).
- **`dashboard-filters.tsx`**: el botón "Filtrar" (`rounded-full` a mano con
  `hover:bg-[var(--accent)]` y bordes/color del alias `--primary`) → `Button
  variant="secondary"`.
- **`dashboard-finance-card.tsx`** / **`dashboard-ranking-card.tsx`** /
  **`dashboard-pending-table.tsx`** / **`dashboard-visits-chart.tsx`**: los 4 `<Card
  className="border-black/5 bg-[linear-gradient(...)] shadow-[...]">` repetidos
  perdieron el className extra — `Card` ya renderiza `.hl-card` por defecto desde el
  paso 03, así que alcanza con no pisarlo.
  - Ícono circular de "Cobros pendientes" (antes `oklch(0.65 0.18 25 / 10%)` a mano) →
    `var(--color-destructive-soft)`/`var(--color-destructive)`.
  - Ícono circular de ranking (antes `rgba(44,95,158,0.08)` + `text-[var(--primary)]`) →
    `var(--brand-blue-soft)`/`var(--brand-blue-fg)`.
  - Barra de progreso del ranking (`bg-black/[0.05]` + gradiente `--brand-primary`/
    `--brand-primary-light`, alias legacy) → `.hl-progress` + gradiente directo
    `var(--brand-blue)`/`var(--brand-blue-strong)`. Estado vacío → primitivo
    `EmptyState`.
  - Tablas de pendientes: `<table>` a mano con `<thead style={{backgroundColor:'var(--muted)'}}>`
    → `.hl-table` envuelta en un contenedor con borde/radio (mismo patrón que el resto
    del repo usa dentro de una card con padding, en vez de `.hl-card--flush`). Fecha en
    `.hl-mono` con `white-space:nowrap` (se rompía a dos líneas al angostar la columna
    con el nuevo padding de celda — detectado y corregido en la verificación visual).
    Monto en rojo (`oklch(0.55 0.18 25)`) → `var(--color-destructive)`. Ícono de enlace
    → `Button variant="ghost" size="icon"`. `EmptyState` compartido reemplaza el
    `function EmptyState()` local del archivo (duplicado en dos funciones del mismo
    archivo).
  - Gráfico (Recharts): grid `rgba(148,163,184,0.2)` → `var(--color-border)`; cursor del
    tooltip `rgba(44,95,158,0.18)` → `var(--brand-blue)` con `strokeOpacity`; pills de
    "Total"/"Promedio" (antes `bg-black/[0.04]`) → `var(--color-surface-muted)`; footer
    con `border-black/5` → `var(--color-border)`. El color de la serie
    (`chartConfig.visits.color`) pasó del alias legacy `--brand-primary` a
    `var(--brand-blue)` directo — con este cambio, `--brand-primary`/`--brand-primary-light`
    (definidas en `globals.css` desde el paso 01 con el comentario "solo
    dashboard-ranking-card lo usa") ya no tienen ningún consumidor en el repo, quedan
    confirmadas como candidatas a borrar en el paso 12.

## Verificación realizada

- `pnpm build` — sin errores de TS.
- `pnpm dev` + `agent-browser`: `/dashboard` completo — header sin glassmorphism,
  gráfico con línea azul de marca y grid gris neutro, card de ranking con barras de
  progreso azules, card de cobros pendientes con ícono rojo, ambas tablas con
  `.hl-table` y fechas en una sola línea tras el fix.
- `pnpm test` (vitest): 164/164.
- `pnpm test:e2e` no se corrió — no es checkpoint obligatorio (02/04/07) y ningún spec
  visita el dashboard.

## Nota para pasos siguientes

`--brand-primary`/`--brand-primary-light` en `globals.css` ya no tienen consumidores —
confirmar y borrar junto con el resto del bloque de alias de compatibilidad en el
paso 12.
