# Paso 14 — Superficies de filtro y alineación de controles

**Estado: hecho.**

Fuera del plan de migración original (01–12, cerrado en el paso 12; el 13 homologó los
formularios). Este paso corrige cuatro defectos visuales que quedaron en las páginas de
listado tras la migración.

## Contexto

1. **Botones y checkboxes de las barras de filtro subían ~8px respecto de los inputs.**
   `.toolbar` usaba `align-items: center` con hijos de dos alturas: los campos son una
   pila `label + control` (~53px) y `<Button>` / el `<label>` del checkbox van sueltos
   (36px / 18px). Al centrar contra la pila completa, el control suelto quedaba arriba.

2. **Las barras de filtro flotaban sobre el fondo** — `.toolbar` era un flex row pelado,
   mientras que la tabla que le sigue vive en `.hl-card`.

3. **Cabeceras de tabla y MetaTiles no se distinguían del fondo** — `--color-surface-muted`
   y `--color-bg` eran el mismo valor (`var(--neutral-100)`). Todo lo pintado con
   `surface-muted` (`.hl-table thead th`, `.hl-meta`) era literalmente el color de página.

   > **Reemplazado por el paso 15.** El §3 de abajo oscurecía `--color-bg` a `--neutral-150`
   > para forzar el contraste. El paso 15 (brief de Claude Design) resuelve la misma
   > separación de otra forma —cabecera de tabla en blanco + borde marcado, fondo con
   > croma frío, elevación de cards— y **revierte** la oscurecida (`--color-bg` y el
   > `--neutral-150`, tanto en `homelab-tokens.css` como en `brand.ts`). Los §1, §2 y §4 de
   > este paso siguen vigentes. Ver `15-fondo-y-elevacion.md`.

4. **El formulario de envío de correos se veía distinto y al 100%** — era la única barra
   de filtro que no usaba `.toolbar`: iba en `.hl-card` con `hl-fieldgroup flex-1` +
   `w-full` en el `FormDatePicker`, así que el control se estiraba de borde a borde.

## Qué se hizo

- **`homelab-tokens.css`**: nuevo escalón `--neutral-150: oklch(0.945 0 0)` y
  `--color-bg` pasa de `neutral-100` a `neutral-150`. `--color-surface-muted` queda igual
  (`neutral-100`) — ahora sí contrasta contra la página. Comentario en el token dejando
  dicho que **no** deben volver a igualarse. `src/lib/brand.ts` (`DOC_TOKENS_CSS`, espejo
  declarado de los tokens) replica ambos cambios; solo afecta el fondo del preview de la
  cotización imprimible, la hoja del documento sigue en `--color-surface`.

- **`homelab-shell.css` · `.toolbar`**: ahora es un panel con superficie
  (`background: var(--color-surface)`, borde, `border-radius: var(--radius-lg)`, `padding:
  var(--space-4)`), `align-items: flex-end` (los controles sueltos quedan a ras de la fila
  de inputs). Dos clases nuevas: `.toolbar__field` (pila label+control, reemplaza el
  `flex flex-col gap-1` hand-rolled) y `.toolbar__check` (checkbox suelto con
  `min-height: var(--control-h)` para centrar su contenido a la altura del input).

- **Consumidores** migrados a `.toolbar__field` / `.toolbar__check`:
  `data-table.tsx` (la rama de checkbox se sacó del wrapper de pila y ahora renderiza el
  `<label className="toolbar__check">` directo; guarda nueva: si `filterDefs` está vacío no
  se renderiza el panel), `precios-visitas-table.tsx`, `pagos-enfermeras-table.tsx`. En los
  dos últimos, el wrapper externo pasó de `flex flex-col gap-4` a `<div>` pelado — el
  `gap-4` sumaba 32px con el `margin-bottom: 16px` de `.toolbar`.

- **`asignacion-envio-correos.tsx`**: la barra de búsqueda pasa al patrón `.toolbar`
  estándar (`.toolbar__field` + `.hl-label` en mayúsculas + `FormDatePicker` en contenedor
  de `208px` + `<Button>`). El `<MetaGrid>` del resumen se envuelve en `<div className="hl-card">`
  (patrón ya usado en `pagos-enfermeras/[enfermeraId]/page.tsx`) — era el único `MetaGrid`
  suelto sobre la página. Root `gap-5` → `gap-4`.

## Verificación

- `pnpm build` — OK. `pnpm exec tsc --noEmit` — OK.
- `pnpm test` — 165/165 (los 4 "test files failed" de siempre son los `e2e/*.spec.ts` que
  vitest recoge y no puede ejecutar; sin relación).
- `pnpm dev` + Playwright, capturas comparadas con el reporte del pedido:
  - `/pagos-enfermeras`, `/origenes-contacto`, `/precios/visitas`: barra de filtro como
    panel blanco, botón/checkbox a ras del borde inferior de los inputs, cabecera de tabla
    legible como franja dentro de la card y card despegada del fondo.
  - `/asignacion/envio-correos`: barra de fecha idéntica al resto (ancho fijo, label en
    mayúsculas), resumen dentro de una card.
  - `/dashboard`, `/playground`, modal de catálogo: nada roto con el fondo más oscuro;
    todo lo que usa `--color-surface-muted` (tooltip del chart, `.hl-modal__foot`, zebra,
    tablas "pendientes") sigue legible.
  - Sin errores de consola en ninguna de las páginas anteriores.

## Nota

`dashboard-filters.tsx` sigue con su propio patrón (`flex flex-wrap items-end gap-3` dentro
de `PageHeader actions`, sin labels ni panel) — es una decisión previa (filtros en el
header, no sobre el contenido) y no se tocó.
