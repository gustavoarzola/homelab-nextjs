# Paso 11 — Operación

**Estado: hecho.**

Sin mockup dedicado — "extender el DS por analogía". 8 archivos: `asignacion-board.tsx`,
`asignacion-card.tsx`, `asignacion-map.tsx`, `asignacion-envio-correos.tsx`,
`pagos-enfermeras-table.tsx`, `pagos-enfermeras/[enfermeraId]/page.tsx`,
`precios-visitas-table.tsx`, `reportes-visitas.tsx`.

**Desviación del flujo estándar**: dos intentos de delegar este paso a un `fork` (`Agent`
con `subagent_type: "fork"`) fallaron de forma idéntica — el sub-agente terminaba tras
exactamente 1 tool call en 15-20s devolviendo una respuesta que imitaba mi propia voz de
"lancé una tarea en background, espero notificación" en vez de ejecutar la directiva.
`git status --short` confirmó árbol limpio (cero archivos tocados) ambas veces. En vez de
un tercer intento, se hizo el paso directamente, archivo por archivo, con verificación
incremental temprana sobre el riesgo más alto (drag-and-drop) antes de seguir con el resto.

## Qué se hizo

- **`asignacion-card.tsx`**: conservado `useDraggable`, `data-testid="asignacion-card"`,
  `data-visita-id` y el `style` dinámico (`transform`/`opacity`/`cursor`) intactos —
  crítico para `e2e/asignacion.spec.ts`. Badge `#id` → `<Chip>`; chips de
  procedimientos/exámenes → `<Tag tone="blue">`/`<Tag tone="green">`; borde/fondo →
  `var(--color-surface)`/`var(--color-border)`/`var(--radius-md)`.
- **`asignacion-map.tsx`**: solo el contenedor (`var(--border)` → `var(--color-border)`,
  `rounded-lg` → `var(--radius-md)` inline). Lógica de Google Maps/marcadores intacta.
- **`asignacion-board.tsx`**: `DropZone` conserva `useDroppable` y
  `data-testid={`dropzone-${id}`}` exactos; fondo/borde ahora
  `isOver ? 'var(--brand-blue-soft)' : 'var(--color-surface-muted)'` /
  `isOver ? 'var(--brand-blue)' : 'var(--color-border)'`. `DndContext`,
  `handleDragStart/End`, `handleSave` y todos los hooks intactos; header con
  `<Button onClick={handleSave}>` reemplazando un `<button>` crudo; labels de sección →
  `.hl-label`; badge de comuna → `<Tag noDot>`.
  **Checkpoint temprano**: verificado con `pnpm build` + `pnpm test:e2e --grep "asigna"`
  (2/2) antes de continuar con el resto de los archivos, por ser el de mayor riesgo
  (drag-and-drop con selectores estructurales frágiles en el e2e).
- **`asignacion-envio-correos.tsx`**: quitado el wrapper `p-8` redundante (mismo patrón de
  doble padding del paso 09 en `historial-paciente.tsx` — la página ya vive dentro del
  padding de `.app-body`). `PageHeader`, card de búsqueda → `.hl-card` + `.hl-fieldgroup`,
  banner de advertencia → `<Callout tone="bad">`, resumen de 3 stats → `<MetaGrid>` +
  `<MetaTile>`, tabla → `.hl-table` en `.hl-card.hl-card--flush`, botones de envío →
  `<Button variant={enfermera.correo ? 'default' : 'secondary'} size="sm">`, estado vacío
  → `<EmptyState>`. Handlers y llamadas a server actions sin tocar.
- **`pagos-enfermeras-table.tsx`**: filtros → `.toolbar` + `SelectCombobox` + `<Button>`;
  tabla → `.hl-table` en `.hl-card.hl-card--flush`, columnas numéricas con `hl-num`/
  `hl-tnum`; `<tfoot>` de totales con padding inline manual (`.hl-table` no alcanza
  `tfoot` — mismo hallazgo que en step 10 pero aplicado aquí por primera vez a un
  `<tfoot>`, documentado como convención). Lógica de filtros/totales intacta.
- **`precios-visitas-table.tsx`**: tenía 3 literales `oklch` — eliminados. Checkbox
  "Precio base sin comuna" y "Mostrar inactivos" migrados al patrón `.hl-checkbox`
  (`role="checkbox"` + `<span className="hl-checkbox" data-checked>`) establecido en
  `data-table.tsx` (paso 04) y reutilizado aquí verbatim. Modal de crear/editar y
  confirmación de toggle → `.hl-backdrop`/`.hl-modal` con la misma estructura
  `__head`/`__body`/`__foot` del paso 04. Estado y handlers intactos.
- **`reportes-visitas.tsx`**: ya usaba primitivos `Card`/`Checkbox` de pasos previos —
  ajuste liviano: labels → `.hl-label`, textos de ayuda → tokens inline, botón de
  descarga envuelto en `<Button asChild><a href=...>`.
- **`pagos-enfermeras/[enfermeraId]/page.tsx`**: grid de 4 stats → `.hl-card` +
  `<MetaGrid>`/`<MetaTile>` con valores en `.hl-tnum`; tabla → `.hl-table` en
  `.hl-card.hl-card--flush`, `<EmptyState>` para el caso vacío, acción de fila →
  `<Button variant="ghost" size="icon" asChild>`; `<tfoot>` con el mismo padding manual
  que `pagos-enfermeras-table.tsx`. Fetch de datos server-side (`getPagoEnfermeraDetalle`,
  `notFound()`) intacto.

## Errores encontrados y corregidos

- **Auto-corrupción de JSX vía `replace_all`** en `reportes-visitas.tsx`: al quitar un
  `disabled={noneSelected}` inválido de `<Button asChild>` (se reenvía a un `<a>`, que no
  soporta `disabled`), un `replace_all` truncó `<a` a `<`, rompiendo el tag. Detectado de
  inmediato con `grep -n -A8 "Button asChild"` antes de compilar y corregido con un
  `Edit` puntual.
- **Chip mal usado para columna de fecha** (autodetectado antes de compilar, no en
  `reportes-visitas.tsx` sino recordado del paso 10 — no se repitió aquí).

## Verificación realizada

- `pnpm build` — sin errores de TS.
- `pnpm test:e2e --grep "asigna"` — 2/2 (checkpoint temprano tras el trío
  board/card/map).
- `pnpm dev` + `agent-browser`, recorrido completo: `/asignacion` (drag board),
  `/asignacion/envio-correos`, `/pagos-enfermeras` (listado), `/pagos-enfermeras/<id>`
  (detalle), `/precios/visitas` (incluyendo abrir el modal "Nuevo precio"), `/reportes`.
  Todo renderiza con estilos del DS, sin regresiones visuales.
- `pnpm test` (vitest): 164/164 (los 4 "failed" de archivos son specs de Playwright
  recogidos por vitest, preexistente, confirmado en el paso 01).
- `pnpm test:e2e` completo: 7/7 (`asignacion`, `cotizacion-a-visita`, `login` x3,
  `visita-con-descuento`).

## Nota para el paso siguiente

`--brand-primary`/`--brand-primary-light` en `globals.css` siguen sin consumidores
(confirmado desde el paso 10) — borrar en el paso 12 junto con el resto del bloque de
alias de compatibilidad.
