# Paso 12 — Limpieza

**Estado: hecho.**

Último paso del plan: retirar los andamios temporales del paso 01 y confirmar que todo
el árbol consume los tokens del DS directamente.

## Qué se hizo

- **Alias de compatibilidad shadcn → DS** (`globals.css`): antes de borrar el bloque, se
  auditaron los 7 archivos que aún consumían nombres legacy
  (`var(--muted-foreground)`, `var(--card)`, `var(--primary)`, etc.) y no habían sido
  tocados por los pasos 01-11: `playground/page.tsx`, `dashboard-visits-chart.tsx`,
  `enfermeras-table.tsx`, `exam-grupo-block.tsx`, `exam-label.tsx`,
  `select-combobox.tsx`, `time-picker.tsx`. Se migraron uno a uno a los tokens DS
  correspondientes (`--color-fg`, `--color-fg-muted`, `--color-surface`,
  `--color-border`, `--color-border-strong`, `--color-primary`, `--color-primary-fg`,
  `--color-surface-muted`) — con un matiz: `--accent`/`--accent-foreground` del alias
  apuntaban a `--brand-blue-soft`/`--brand-blue-fg` (azul, para estados "seleccionado" de
  listas), **no** al `--color-accent` propio del DS (que es naranjo, uso escaso) — se migró
  a `var(--brand-blue-soft)`/`var(--brand-blue-fg)` directo para preservar el
  comportamiento visual exacto. Confirmado con `grep` que no queda ningún
  `var(--background|foreground|card|popover|primary|secondary|muted|accent|destructive|border|input|ring|radius)`
  en `.tsx`/`.ts` fuera de `globals.css`. Con eso, se eliminó el bloque completo
  `@theme inline` + alias `:root` de `globals.css` (de 119 a 25 líneas), dejando solo el
  import de tokens/shell, `.rdp-root` (repuntado a los tokens DS) y el `@layer base`.
- **`--chart-1..5`** (oklch sin uso desde que el paso 10 migró Recharts a tokens DS
  directos) y **`--brand-primary`/`--brand-primary-light`** (sin consumidores desde el
  paso 10, confirmado otra vez aquí) — eliminados junto con el resto del bloque.
- **`--state-visita-*`/`--state-cot-*`** — alias declarados en el paso 01 pero nunca
  consumidos (`estado-colors.ts` siempre usó `--estado-*`/`--cot-*` directo) — confirmado
  con `grep` en todo `src` y eliminados como dead code.
- **`tailwind.config.ts`** — confirmado que ningún `.css` tiene `@config` apuntándolo
  (Tailwind 4 es CSS-first) → borrado.
- **`next-themes`** — confirmado sin imports en `src` (el `ThemeProvider` ya se había
  quitado en el paso 01) → `pnpm remove next-themes`.
- **`oklch(...)` sueltos en TSX** — `grep` a todo el árbol: cero resultados: ya habían
  sido purgados en pasos anteriores (07, 08, 10, 11).
- **`playground/page.tsx`** — se agregó una sección "Primitivos DS" al inicio (Botones,
  Badge/Tag/Chip/StatusDot/Avatar, Callout, MetaGrid/EmptyState) mostrando los
  primitivos de `src/components/ui/*`, antes de las secciones existentes de date
  pickers/combobox.
- **`CLAUDE.md`**:
  - Tabla de stack: fila "Tema" de `next-themes (dark/light/system)` a
    "HomeLab Design System (…), solo modo claro".
  - Deuda técnica: eliminados 3 ítems ya resueltos —
    `visita-form.tsx.bak` (el archivo ya no existe), "no hay middleware/proxy.ts para
    protección de rutas" (`src/proxy.ts` ya existe y protege rutas — confirmado
    leyendo el archivo), "falta página de configuración" (el link a `/configuracion`
    ya no está en el sidebar, confirmado por `grep`). Lista renumerada.
  - Patrón "Estilos con CSS variables" repuntado a los tokens DS; patrón de
    `<div className="p-8">` por página (obsoleto desde el paso 02) reemplazado por la
    referencia al shell `.app`/`.app-main`/`.app-body`.
  - Nueva subsección "Design System (HomeLab DS)" en Convenciones Técnicas: ubicación
    de tokens/shell, primitivos `ui/*`, solo-claro, densidad parametrizada, origen
    (proyecto Claude Design) y puntero a `docs/plan-design-system/`.

## Verificación realizada

- `grep` repo-wide: cero `var(--<nombre-shadcn>)` fuera de `globals.css`, cero
  `oklch(...)` en `.tsx`, cero referencias a `next-themes`/`tailwind.config` en código
  activo.
- `pnpm build` — sin errores de TS, las 39 rutas compilan.
- `pnpm dev` + `agent-browser`: `/login` (logo + form), `/dashboard` (gráfico Recharts
  con los nuevos `var(--color-surface)` en los dots — línea, área y puntos renderizan
  igual que antes), `/pacientes/nuevo` (abrí el dropdown de "Previsión de salud" —
  `SelectCombobox` con fondo blanco/borde/texto correctos tras la migración de tokens),
  `/playground` (nueva sección de primitivos + todas las secciones preexistentes).
  Sin regresiones visuales en ningún punto.
- `pnpm test` (vitest): 164/164.
- `pnpm test:e2e`: 7/7.

## Resultado

`globals.css` queda en 25 líneas (era 119 al cierre del paso 01), sin ningún alias de
compatibilidad — todo el árbol consume `homelab-tokens.css` / `homelab-shell.css`
directamente. Con este paso se cierra `docs/plan-design-system/` completo (01-12).
