# Paso 15 — Fondo con tinte frío y elevación del backoffice

**Estado: hecho.**

Fuera del plan de migración original. Brief acotado de Claude Design: el fondo gris era
acromático (croma 0) y todas las superficies pesaban igual, así que la pantalla se veía
apagada.

**Reemplaza el §3 del paso 14** (que oscurecía `--color-bg` a `--neutral-150` para separar
la cabecera de tabla del fondo). Acá la separación se logra con la cabecera en blanco +
borde marcado, y `--color-bg` se revierte. Los §1, §2 y §4 del paso 14 (alineación de
controles y panel `.toolbar`, homologación del filtro de envío de correos) siguen vigentes.

## Qué se hizo

### Tinte frío en 4 tokens (`homelab-tokens.css`, `@theme`)

Croma mínimo en hue 250 — imperceptible como "azul", saca el gris de la ceniza. Estos 4
dejan de derivarse de la escala neutral (acromática por diseño) y pasan a literal oklch:

| Token | Valor | Antes |
|---|---|---|
| `--color-bg` | `oklch(0.968 0.005 250)` | `var(--neutral-150)` (paso 14) |
| `--color-surface-muted` | `oklch(0.976 0.004 250)` | `var(--neutral-100)` |
| `--color-border` | `oklch(0.918 0.006 250)` | `var(--neutral-200)` |
| `--color-border-strong` | `oklch(0.868 0.008 250)` | `var(--neutral-300)` |

`--color-surface` se queda en blanco puro (`--neutral-0`). Se eliminó `--neutral-150` (lo
agregó el paso 14, quedó sin uso). `--color-surface-muted` sube en luminancia (0.970 →
0.976): la zebra, los MetaTiles, `.fpanel` y el pie del modal quedan más sutiles, no más
oscuros. El divisor `* { border-color: var(--color-border) }` de `globals.css:17` propaga
el cambio de borde a todos los divisores internos — sub-perceptible (Δ 0.004).

### Elevación de cards — token `--shadow-card`

Nuevo token (único agregado; evita repetir un literal de 2 partes en 6 selectores):

```css
--shadow-card: 0 1px 2px oklch(0.3 0.02 250 / 0.05), 0 2px 6px oklch(0.3 0.02 250 / 0.045);
```

`box-shadow: var(--shadow-card)` **junto al borde** (no lo reemplaza) en las superficies de
nivel página: `.hl-card` (`homelab-tokens.css` — cubre todo `<Card>` de shadcn),
`.hl-rail__card`, `.fcard` (`form-shared.css`), `.dcard` (`visita-lifecycle-view.css`),
`.toolbar` (`homelab-shell.css`). Exclusión: `.hl-rail__card .dcard { box-shadow: none }`
(las `.dcard` anidadas en los paneles de estado final del rail). Se actualizó el comentario
de la sección "9 · Elevación" que decía "las cards usan borde, no sombra".

No llevan sombra: `.hl-modal`/`.hl-popover`/toast (ya tienen `--shadow-lg`); `.fpanel`,
`.hl-meta`, `.ed-tabs`, `.segm`, `.lineitem`, `.hl-disclosure`, `.ed-empty` (anidadas o
controles); `.edit-bar`/`.pac-bar`/`.stepbar`/`.lifebar`/`.sect-title` (barras sticky
full-bleed).

### Patrón de puntos en el contenido (`homelab-shell.css`, `.app-body`)

```css
background-image: radial-gradient(oklch(0.55 0.04 250 / 0.13) 1px, transparent 1px);
background-size: 22px 22px;
background-position: -1px -1px;
```

Solo en `.app-body` (nunca body, sidebar, cards). El board de asignación
(`.app:has(.page-full) .app-body`) lo hereda pero el board lo cubre casi entero.

### Sidebar como plano superior (`homelab-shell.css`, `.app-side`)

`border-right: 0` + `box-shadow: 1px 0 0 var(--color-border), 4px 0 16px oklch(0.3 0.02 250 / 0.03)`
(la hairline reemplaza el borde; la segunda capa es la elevación).

### Cabecera de tabla en blanco (`homelab-tokens.css`, `.hl-table thead th`)

`background: var(--color-surface)` (antes `--color-surface-muted`) +
`border-bottom: 1px solid var(--color-border-strong)` (antes `--color-border`). Sin cambios
en el texto (color/tamaño/tracking/uppercase). Elimina la tercera banda gris dentro de una
card blanca.

### `brand.ts` — revertido

`DOC_TOKENS_CSS` vuelve a su estado previo al paso 14 (`--color-bg: var(--neutral-100)`, sin
`--neutral-150`). El documento imprimible **no** lleva el tinte frío de pantalla — se anotó
como excepción deliberada en el comentario del archivo.

## Verificación

- `pnpm build` + `pnpm exec tsc --noEmit` — OK.
- `pnpm test` — 165/165 (los 4 "test files failed" de siempre son los `e2e/*.spec.ts`).
- `pnpm dev` + Playwright: `/procedimientos`, `/pagos-enfermeras`, `/asignacion/envio-correos`,
  `/dashboard`, `/playground`, `/visitas/<id>` (lifecycle). Cards y `.toolbar` despegadas
  del fondo por sombra; cabecera de tabla blanca sin doble gris; rail y `.dcard` con sombra
  sutil, sin "card dentro de card" en los paneles de estado; sidebar como plano superior;
  puntos apenas visibles a 22px. Sin errores de consola (salvo un aviso de hidratación
  transitorio en `/asignacion/envio-correos` por correr `pnpm build` contra el `next dev`
  vivo — se resuelve reiniciando el dev server; no es un bug de código).
- No hay modo oscuro en el proyecto — N/A.
