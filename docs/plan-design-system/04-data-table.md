# Paso 04 — DataTable

**Estado: hecho.**

## Qué se hizo

`src/components/data-table.tsx` (848 líneas, backend de 12+ catálogos) reescrito por
completo — misma lógica (`ModalState<T>`, `useTransition`, `initFilters`, `toOurSort`,
`buildExportQuery`, todos los handlers), solo cambia el render:

- **Toolbar de filtros**: contenedor pasó de card bordeada a `.toolbar` (fila sin borde,
  como en el mockup). Texto → `.hl-input`; select nativo → `.hl-input.hl-input--select` +
  `ChevronDown`; checkbox → span `.hl-checkbox` con `data-checked` controlado por React
  (no hay Radix acá, es un filtro simple: `role="checkbox"` + `aria-checked` + teclado, el
  mismo patrón que usa el propio mockup vanilla-JS del DS). `SelectCombobox` y
  `FormDatePicker` (componentes propios, fuera de este paso) quedan intactos. Botones
  Aplicar/Limpiar → `Button` (`ui/button.tsx`, paso 03).
- **Tabla**: `<table>` → `.hl-table` (ya trae thead uppercase, hover de fila,
  `--row-py`/`--cell-px`). Estado vacío → `.hl-empty` con ícono `Inbox`.
- **Contenedor**: `.hl-card.hl-card--flush` (antes `rounded-xl border` a mano).
- **Acciones de fila** (editar/toggle/eliminar): `Button variant="ghost" size="icon"`
  (antes `<button>`/`<Link>` con `hover:opacity-80` a mano).
- **Paginación**: `.hl-pager`/`.hl-pager__nums`, con el selector de tamaño de página
  (`10/20/50` — funcionalidad real, no está en el mockup) integrado a la izquierda del
  pager en vez de en un footer aparte. `getPageNumbers()` se reutiliza sin cambios.
- **Modal** (crear/editar): `.hl-backdrop` + `.hl-modal` (`__head`/`__body`/`__foot`).
  Como el `<form>` tiene que envolver tanto los campos como el footer (el botón submit
  vive dentro del form), se le puso `flex flex-1 min-h-0 flex-col` al `<form>` para que
  `.hl-modal__body` (que trae `overflow-y:auto`) siga scrolleando de forma independiente
  del `.hl-modal__foot` fijo — el mockup no necesitaba esto porque no tiene un `<form>`
  real envolviendo body+foot.
- **Confirmaciones** (activar/desactivar, eliminar): mismo `.hl-modal`, achicado a
  `maxWidth: 400`. El DS no trae un mockup específico de confirm-dialog, así que se
  reusó el modal genérico. El botón de acción destructiva usa `variant="destructive"` de
  `ui/button.tsx` — que en el DS es un botón *outline* rojo (fondo transparente, borde,
  texto rojo), no un botón sólido. Es intencional y consistente con el propio DS: el
  mockup `Visita Cierre DS.html` usa exactamente esa clase (`hl-btn--destructive`) para
  "Confirmar cancelación", su acción destructiva final. No es una regresión visual, es
  seguir el patrón que el DS ya estableció en vez de recrear el botón sólido que tenía el
  código shadcn anterior.

## Verificación realizada

- `pnpm build` — sin errores de TS.
- `pnpm dev` + `agent-browser` en `/examenes`, ejercitando el ciclo completo:
  - Crear examen (`Nuevo examen` → modal → llenar → `Crear`) — toast de éxito con el
    nuevo estilo oscuro, contador de filas actualizado (3093→3094).
  - Buscar el registro creado, abrir el modal de confirmación de desactivar, confirmarlo
    — el registro desaparece del listado (filtro "Mostrar inactivos" apagado) y aparece
    `.hl-empty` con "Sin resultados."
  - Pager con números, elipsis y página activa en azul — visualmente igual al mockup.
- `pnpm test` (vitest): 164/164.
- **`pnpm test:e2e`: 7/7** (paso designado por el plan para correr e2e, junto con 02 y
  07). Incluye `asignacion.spec.ts` (drag-and-drop sobre `data-testid`) y
  `cotizacion-a-visita.spec.ts`/`visita-con-descuento.spec.ts` (ambos pasan por
  `DataTable` en algún punto del flujo) — sin ajustes de test necesarios.

## Nota para pasos siguientes

Los 12 archivos `*-table.tsx` (configs de `DataTable`: columnas, filtros, campos de
formulario) siguen sin tocar — eso es el paso 05. Sus `extraRowActions` (links/botones
custom fuera del control de `DataTable`) usan la receta antigua
(`rounded p-1.5 hover:opacity-80` + `var(--muted-foreground)`), que ya hereda los colores
DS vía los alias del paso 01 pero no usa `.hl-btn--icon` — se homogeniza en el paso 05.
