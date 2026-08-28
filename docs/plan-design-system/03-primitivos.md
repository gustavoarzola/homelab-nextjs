# Paso 03 — Primitivos (`src/components/ui/`)

**Estado: hecho.**

## Qué se hizo

Cada primitivo envuelve la clase `.hl-*` correspondiente de `homelab-tokens.css`; el CSS
vive en el token file, el componente solo compone clases con `cn()`.

### Reescritos (con consumidores reales hoy)

| Archivo | Antes | Ahora | Consumidores |
|---|---|---|---|
| `button.tsx` | shadcn `cva` (`bg-primary`, `ring-offset-background`…) | `cva` sobre `.hl-btn` — `default→primary, destructive→destructive, outline/secondary→secondary, ghost→ghost, link→ghost+underline`; `size`: `sm→hl-btn--sm`, `icon→hl-btn--icon` | `date-picker.tsx` (sin consumidores en la app hoy — ver nota) |
| `card.tsx` | `rounded-2xl border bg-card shadow-sm`, `p-6` | `.hl-card` (radio 10px, `--card-p`); `CardTitle`/`CardDescription` con la escala tipográfica DS | 5 archivos del dashboard/reportes |
| `checkbox.tsx` | Radix + Tailwind (`border-primary`, `data-[state=checked]:bg-primary`) | Radix + `.hl-checkbox`; el estado marcado ahora lo pinta un selector nuevo `.hl-checkbox[data-state="checked"]` (ver más abajo) | `visita-form.tsx`, `cotizacion-form.tsx`, `reportes-visitas.tsx` |
| `popover.tsx` | `rounded-md border bg-popover shadow-md` | `.hl-popover` (radio 10px, `--shadow-lg`) | `simple-date-picker.tsx`, `form-date-picker.tsx`, `date-picker.tsx` |

**Nota sobre `button.tsx`**: es el único consumidor de `ui/button` hoy es `date-picker.tsx`,
que a su vez **no tiene ningún consumidor en la app** (ni páginas ni otros componentes lo
importan — es código muerto, no listado en el inventario de `CLAUDE.md`). No se pudo
verificar visualmente el `Button` reescrito en la app corriendo por esta razón; se
verificó por lectura de código + que el build/typecheck pasan. Si en algún paso futuro se
detecta que `date-picker.tsx` tampoco se usará, es candidato a limpieza en el paso 12.

### Nuevos (compat Radix)

Se agregó al final de `homelab-tokens.css` una sección **"COMPAT RADIX"**: los mockups
vanilla-JS del DS togglean estado con `data-checked`/`data-on` (atributos inventados por
el propio mockup), pero Radix Checkbox usa `data-state="checked"|"unchecked"|"indeterminate"`.
Se agregaron selectores `.hl-checkbox[data-state="checked"]` y
`.hl-checkbox[data-state="indeterminate"]` con los mismos tokens que ya usaba
`[data-checked]`, más una clase `.hl-popover` (el DS no traía una — se construyó con los
mismos tokens que usa `.hl-modal`: `--radius-lg`, `--shadow-lg`, `--color-surface`).

### Nuevos (sin consumidores todavía — infraestructura para pasos 05+)

`input.tsx`, `field.tsx` (`FieldGroup`/`FieldRow`), `badge.tsx`, `tag.tsx`, `chip.tsx`,
`status-dot.tsx`, `avatar.tsx`, `callout.tsx`, `meta.tsx` (`MetaGrid`/`MetaTile`),
`switch.tsx`, `empty-state.tsx`, `stepper.tsx` (`Step`/`Pipe`), `timeline.tsx`,
`progress.tsx`, `disclosure.tsx`. Cada uno es un wrapper delgado (10–30 líneas) sobre una
clase `.hl-*` ya existente en `homelab-tokens.css` desde el paso 01 — no se inventó CSS
nuevo para estos. Se crearon ahora (en vez de sobre la marcha en cada paso futuro) porque
son triviales y evitan que los pasos 05–11 tengan que redefinir el mismo patrón cada vez.

`badge.tsx` usa el campo `badgeClass` que `estado-colors.ts` ya expone desde el paso 01
(`is-creada`, `is-cot-aceptada`, …).

`stepper.tsx` expone piezas (`Step`, `Pipe`), no un stepper completo armado: la visita y
la cotización tienen forks terminales distintos (visita: completada/no_realizada/cancelada;
cotización: aceptada/rechazada), así que cada ciclo de vida compone su propio layout con
estas piezas en los pasos 06/08, en vez de forzar una única forma genérica.

### Toast (sonner)

`src/app/layout.tsx`: se quitó `richColors` (sus fondos verde/rojo sólidos no coinciden
con el `.hl-toast` del DS, que es fondo oscuro + icono de color) y se agregó
`toastOptions.style` con los tokens DS (`--neutral-900`, `--radius-md`, `--shadow-lg`).

## Bug de paso: warning de aspect-ratio en el logo

Al revisar la consola del navegador durante la verificación apareció:
`Image with src "/homelab-logo.png" has either width or height modified, but not the
other.` Los usos en `sidebar.tsx` y `login/page.tsx` (pasos 02) pasaban
`style={{ width: 'auto' }}` junto a `width`/`height` numéricos — next/image lo interpreta
como una anulación parcial que puede distorsionar la imagen. Se quitaron esos overrides
(el `width`/`height` numérico ya define el aspect ratio correctamente: 104×54 y 124×64,
ambos ≈ 1.93, igual al PNG real de 537×278).

## Verificación realizada

- `pnpm build` — sin errores de TS (dos vueltas: `input.tsx` inicialmente rompía el tipo
  porque `prefix` colisiona con `InputHTMLAttributes['prefix']`; se renombró a
  `startAdornment`/`endAdornment`).
- `pnpm dev` + `agent-browser`:
  - `/reportes` — checkboxes de columnas marcados en azul (`.hl-checkbox` + compat Radix
    funcionando), popover del selector de rango de fechas con radio/sombra DS y flechas
    de navegación en azul de marca.
  - `/dashboard` — las 3 cards (`ui/card.tsx`) con el radio y padding del DS, sin
    regresión visual.
- `pnpm test` (vitest): 164/164 (mismo resultado que en pasos anteriores).
- `pnpm test:e2e` no se corrió en este paso (no toca estructura de páginas ni
  selectores — el plan solo lo exige después de 02/04/07, ya cubierto en 02).

## Nota para pasos siguientes

Los primitivos "sin consumidores" quedan disponibles para que 05 (catálogos), 06/08
(ciclos de vida) y 07/09 (formularios) los importen directamente en vez de recrear el
patrón `.hl-*` a mano.
