# Paso 05 — Catálogos (los 12 `*-table.tsx`)

**Estado: hecho.**

Nota de alcance: los `page.tsx` de estas rutas ya quedaron sobre `PageHeader` en el
paso 02 (rollout adelantado). Este paso es solo el cuerpo: las 12 configs de `DataTable`.

## Qué se hizo

Los 12 archivos (`comunas`, `origenes-contacto`, `residencias`, `tipos-recargos`,
`talleres`, `previsiones`, `examenes`, `procedimientos`, `pacientes`, `enfermeras`,
`cotizaciones`, `visitas`) compartían un bloque de "Estado" (activo/inactivo) **copiado
literalmente en 9 de ellos**, con un literal `oklch(0.6 0.118 184.704 / 12%)` repetido
cada vez:

```tsx
<span className="rounded-full px-2 py-0.5 text-xs font-medium" style={
  row.original.activo
    ? { backgroundColor: 'oklch(0.6 0.118 184.704 / 12%)', color: 'oklch(0.45 0.118 184.704)' }
    : { backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }
}>
  {row.original.activo ? 'Activo' : 'Inactivo'}
</span>
```

Reemplazado por `<StatusDot active={row.original.activo}>…</StatusDot>` (primitivo del
paso 03) en `comunas`, `origenes-contacto`, `residencias`, `tipos-recargos`, `talleres`,
`previsiones`, `examenes`, `procedimientos`, `enfermeras` — el punto de color sobrio que
usa el propio mockup DS para "activo/inactivo" en catálogos (`Catalogo Examenes DS.html`),
en vez de una píldora de color.

`cotizaciones-table.tsx` y `visitas-table.tsx` ya tenían su propio badge de **estado del
ciclo de vida** (no activo/inactivo) construido a mano leyendo `ESTADO_COTIZACION_STYLES`
/ `ESTADO_VISITA_STYLES` de `src/lib/estado-colors.ts`. Como esos mapas ya exponen
`badgeClass` desde el paso 01, se reemplazaron por `<Badge badgeClass={cfg.badgeClass}>`
(primitivo del paso 03) — mismo dato, menos código, y ahora el color de cada estado vive
en un solo lugar (`estado-colors.ts`) en vez de repetirse en cada archivo.

Otros reemplazos aplicados donde correspondía:
- Columnas de código (`examenes`, `talleres`, `procedimientos`, y el `N°` de
  `cotizaciones`, antes `COT-00001` en texto mono a mano) → `<Chip>` (`.hl-chip`).
- Columnas de precio/total/costo (`examenes`, `tipos-recargos`, `procedimientos`,
  `cotizaciones`, `visitas`) → `className="hl-tnum block text-right"`, para que el número
  quede alineado a la derecha con tabular-nums, como en el mockup (`<td class="hl-num">`
  — no se tocó `data-table.tsx` para agregar alineación por columna al motor genérico;
  se resuelve por celda, que es donde ya vivía el criterio de formato).
- `extraRowActions` de `pacientes-table.tsx` y `cotizaciones-table.tsx` (links con
  `rounded p-1.5 hover:opacity-80` + `var(--muted-foreground)` a mano) → `Button
  variant="ghost" size="icon" asChild`, igual que las acciones de fila que ya usa
  `data-table.tsx` desde el paso 04. El link "Ver visita" de `cotizaciones-table.tsx`
  tenía un literal `oklch(0.45 0.13 145)` para pintarlo verde — pasó a `var(--ok-fg)`.
- Los pocos `var(--muted-foreground)` / `var(--foreground)` sueltos que quedaban en estos
  12 archivos se repuntaron a `var(--color-fg-muted)` (sin cambio de valor, son alias
  equivalentes desde el paso 01 — es solo higiene, para que estos archivos usen ya el
  nombre DS en vez del alias de compatibilidad).

`pacientes-table.tsx` no tiene columna de estado (los pacientes no tienen `activo`) —
sin cambios ahí más allá de las acciones de fila.

## Verificación realizada

- `pnpm build` — sin errores de TS.
- `pnpm dev` + `agent-browser`: `/visitas` (badges Realizada/Completada/Cancelada/
  Programada con los tonos del DS, costo alineado a la derecha), `/examenes` (chips de
  código, precio alineado, status dot verde "Activo" — visualmente equivalente al mockup
  `Catalogo Examenes DS.html`), `/cotizaciones` (badges de estado, chip `COT-00409`,
  iconos ghost), `/pacientes` (4 acciones de fila como botones ghost consistentes).
- `pnpm test` (vitest): 164/164.
- `pnpm test:e2e` no se corrió — este paso no está en la lista de checkpoints e2e del
  plan (02/04/07) y no toca estructura de página ni selectores, solo el contenido de
  columnas dentro de `DataTable`, ya cubierto por el paso 04.

## Nota para pasos siguientes

`pagos-enfermeras-table.tsx` y `precios-visitas-table.tsx` son tablas hechas a mano (no
usan el `DataTable` genérico) y no se tocaron acá — quedan agrupadas con el resto de
"operación" en el paso 11, junto con `pagos-enfermeras/[enfermeraId]/page.tsx` (cuya
cabecera ya se hizo en el paso 02, falta el cuerpo).
