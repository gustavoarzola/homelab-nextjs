# Paso 09 — Pacientes (formulario, historial, file-upload)

**Estado: hecho.**

Sin mockup dedicado en el proyecto de diseño — "extender el DS por analogía" (ver
`00-overview.md`). Hecho directamente en esta sesión (sin fork), por ser de menor tamaño
que los pasos 06–08 (1215 líneas combinadas) y no requerir investigación de un mockup
nuevo.

## Qué se hizo

### `paciente-form.tsx` (700 líneas)

Misma lógica (`useState`, `handleSubmit`, el loader de Google Maps de `MapPreview` y
`AddressAutocomplete`, construcción de `FormData`) intacta — solo cambia el render.

- Nuevo `src/components/paciente-form.css`: solo una clase, `.pac-bar` (header sticky con
  blur), mismo lenguaje visual que `.edit-bar` (visita-form.css) / `.form-bar`
  (cotizacion-form.css) pero con nombre propio — no hay mockup del que copiar, así que se
  construyó por analogía directa con esos dos, siguiendo el mismo criterio de "sin CSS
  compartido entre stylesheets page-specific" que los pasos 07/08 establecieron.
- Las 4 secciones (Datos personales, Dirección, Documento de identificación, Teléfonos)
  pasan de `rounded-xl border` a mano → `.hl-card`, con títulos `.hl-label` en vez de
  clases de texto ad-hoc repetidas (`sectionTitleClass`/`sectionTitleStyle`, que se
  eliminaron por completo).
- Los `input`/`label` repetidos ~15 veces con `inputClass`/`inputStyle`/`labelClass`
  compartidos (constantes a nivel de módulo) → `.hl-fieldgroup` + `.hl-input` por campo.
- Pantalla de éxito (`createdId !== null`) → `.hl-card` centrada + `Button`.
- `MapPreview`: solo se tokenizó el borde del contenedor (`var(--border)` →
  `var(--color-border)`), la lógica del mapa (Google Maps loader, marker) no se tocó.

### `historial-paciente.tsx` (379 líneas)

Página de solo lectura (con un filtro de año, único estado local). Migrada a los
primitivos ya existentes, sin CSS propio:

- Contenedor: se quitó el `min-h-screen p-6 md:p-8` con fondo propio — la página ya vive
  dentro de `.app-body` (padding 28/32/48 desde el paso 02), ese wrapper duplicaba
  padding. Se mantuvo el centrado `max-w-4xl`.
- Header → `.page-head__crumb`/`.page-head__meta` (clases globales de `homelab-shell.css`,
  sin necesidad de armar un `PageHeader` completo porque el layout de este header es
  distinto — título grande + acciones a la derecha, sin `<h1>` dentro de `.page-head`
  estándar).
- Card de estadísticas (4 números) → `.hl-card` con grid, números en `.hl-tnum`. Los
  colores de estado (realizada=verde, cancelada=rojo) pasaron de
  `oklch(0.5 0.15 150)`/`var(--destructive)` sueltos a `var(--ok-fg)`/
  `var(--color-destructive)`.
- Filtro de año: los botones a mano (`background: var(--foreground)` invertido para el
  activo) → `Button` con `variant={selected ? 'default' : 'secondary'}` — **se descartó
  usar `.segm`** (que hubiera sido la opción visualmente más cercana al patrón de otros
  filtros) porque esa clase vive en `visita-form.css`/`cotizacion-form.css`, no en
  `homelab-tokens.css`, y este componente no importa ninguno de esos dos — reusarla habría
  repetido el mismo acoplamiento fantasma que se encontró y corrigió en el paso 08
  (`.ed-dcto`). `Button` es 100% autocontenido, sin ese riesgo.
- Tarjetas de visita agrupadas por año → `.hl-card.hl-card--flush` con el borde izquierdo
  de 4px coloreado por estado (`style.border`, ya venía de `estado-colors.ts`) — separadores
  internos con `height:1px` en vez de `<hr>` a mano, sin cambios de comportamiento. Badge
  de estado → `Badge` (`ESTADO_VISITA_STYLES[estado].badgeClass`). Chips de
  procedimiento/examen (antes `oklch(...)` por categoría) → `Tag` (`tone="amber"` para
  curaciones, `"violet"` para exámenes, matching los tonos ya usados en pasos 05/06/07/08
  para las mismas categorías).
- Estado vacío → primitivo `EmptyState` (`ui/empty-state.tsx`).

### `file-upload.tsx` (136 líneas)

Sin cambios de lógica (`handleFile`, fetch a `/api/upload`, manejo de preview). Solo
tokens: `var(--muted)`/`var(--border)`/`var(--foreground)` → sus equivalentes DS, botón
"Reemplazar" → `Button variant="secondary" size="sm"`. El botón "Subir archivo" (estado
vacío) se dejó como `<button>` a mano con borde punteado — no hay una variante `Button`
para "dashed", y crear una solo para este único uso no se justificaba.

## Verificación realizada

- `pnpm build` — sin errores de TS, compiló limpio en el primer intento.
- `pnpm dev` + `agent-browser`: `/pacientes/[id]` (editar) con todos los campos
  poblados y el mapa de Google renderizando correctamente; `/pacientes/[id]/historial`
  con las 3 tarjetas de visita, badges de estado (Realizada/Completada) en los tonos
  correctos, tags de procedimientos/exámenes, estadísticas y borde izquierdo por color de
  estado.
- `pnpm test` (vitest): 164/164.
- `pnpm test:e2e` no se corrió — no es uno de los checkpoints obligatorios del plan
  (02/04/07) y ningún spec existente ejercita el formulario de paciente o el historial.

## Nota para pasos siguientes

Ninguna — este paso no introdujo deuda ni acoplamientos nuevos (a diferencia del 07/08,
que sí generaron notas de seguimiento).
