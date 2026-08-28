# Paso 07 — Formulario de visita (crear/editar)

**Estado: hecho.**

`src/components/visita-form.tsx` (1387 líneas, el segundo archivo con más inline styles
del repo: 125 `style={{}}`) reescrito por completo — misma lógica (todos los
`useState`/`useMemo`/`useRef`/`useEffect`, el loader de Google Maps de `MapPreview`, la
construcción del `FormData` en `handleSubmit`, todas las llamadas a server actions
sobreviven byte-idénticas), solo cambia el render. Sirve tanto a `/visitas/nueva` como a
`/visitas/[id]/editar` (mismo componente, `isEdit = !!visita`). Las dos páginas que lo
envuelven (`visitas/nueva/page.tsx`, `visitas/[id]/editar/page.tsx`) no tenían markup
propio — no se tocaron.

## Qué se hizo

1. **Nuevo `src/components/visita-form.css`**: subconjunto de la sección "Modo edición"
   del `<style>` de `Visita Ciclo de Vida DS.html` (mismo proyecto de diseño) —
   `.edit-bar`, `.fcard*`, `.ed-grid3`, `.segm`, `.ed-tabs`, `.ed-items`/`.ed-item*`,
   `.ed-dcto*`, `.ed-neg`, `.rail-g*`. El "dirty-dot" del mockup (indicador de cambios
   sin guardar) no se incluyó: este formulario no tiene guardado incremental por
   sección como el acordeón de cierre del paso 06 — se envía completo de una vez, no
   hay noción de "sucio" que mostrar.
2. **`EstadoBadge`** (duplicado del que ya se había eliminado en el paso 06) → `Badge`
   directo con `ESTADO_VISITA_STYLES[estado].badgeClass`.
3. **`ProcedimientoPriceWarning`/`ExamenPriceWarning`**: los dos boxes de aviso
   (oklch(0.97 0.05 75) / oklch(0.85 0.12 75) literales) → clases `.hl-callout
   .hl-callout--warn` con children a medida (dos botones), en vez del primitivo
   `Callout` — ese primitivo solo acepta un bloque de children, no encajaba con el
   layout de dos columnas (texto + botones) sin forzarlo.
4. **`PacienteCard`** → `.dcard` + `MetaGrid`/`MetaTile` (reemplaza el `<dl
   className="grid grid-cols-2">` a mano) + `Button` para "Editar datos". El mapa de
   Google (`MapPreview`) no se tocó — solo su contenedor.
5. **`SummaryGroup`** (usada en el rail): el mapa `dotColor` de oklch literales por tono
   → `var(--tag-${tone}-dot)` directo (mismo fix que el paso 06 aplicó a `SvcGroup`).
   Reescrita sobre `.rail-g`/`.rail-g__head`/`.rail-g__item`.
6. **Header sticky** → `.edit-bar` (blur + sticky top, margen negativo para ir
   edge-to-edge del padding de `.app-body`, mismo truco que el paso 06 usó para el
   `.lifebar` y que ya usaba el dashboard). Botones → `Button` (Cancelar=ghost,
   Cotización PDF=secondary, submit=primary con `form="visita-form"` — atributo
   preservado tal cual, el botón vive fuera del `<form>` en el DOM).
7. **Banner de error** → clases `.hl-callout .hl-callout--bad` a mano (no el primitivo
   `Callout`) porque necesita el `ref` de `errorRef` para el `scrollIntoView` — el
   primitivo no reenvía ref.
8. **Sección Agenda**: → `.fcard` + `FieldGroup` (`ui/field.tsx`) por cada campo,
   reemplazando el `<label>+<div>` a mano repetido 4 veces. Grid de 4 campos
   (`gridTemplateColumns:'1fr 1fr 1fr 1fr'` con `col-span-2`) → `.ed-grid3`
   (`repeat(auto-fit,minmax(160px,1fr))` del mockup) — el reflow no es idéntico
   (antes siempre 2 por fila, ahora hasta 4 según ancho disponible) pero es el
   comportamiento que el propio mockup define para grillas de campos cortos.
9. **Sección Servicios**: tabs → `.ed-tabs` con badge de conteo (mismo patrón visual que
   el mockup, incluye el punto de aviso naranjo cuando hay `hasWarning`). Filas de
   procedimiento/taller seleccionado → `.ed-items`/`.ed-item*`, código → `Chip`, input
   de descuento → `.ed-dcto` (mismo `<span>Desc. $</span>` + `<input>` como hermanos
   directos — necesario para el selector e2e, ver más abajo). El tab de Exámenes sigue
   delegando en `ExamenesPorGrupo` (`exam-grupo-block.tsx`) sin cambios de esa parte.
10. **Cargos adicionales**: el `<select>` nativo Monto fijo/Porcentaje → `.segm`
    (segmented control genuino, no el uso "vacío" que el paso 06 le dio a esa misma
    clase en el toggle Boleta/Factura — acá sí se apoya en el estilo real de `.segm`,
    mismo comportamiento, solo cambia de `<select>` a dos `<button aria-pressed>`).
    Inputs con prefijo `$`/`%` → `.hl-input` + `.hl-affix` (el mismo patrón usado desde
    el paso 04). Checkboxes sin cambios (ya eran el primitivo `Checkbox` desde el
    paso 03).
11. **Orden médica / Información adicional** → `.fcard`, textarea envuelto en
    `.hl-input`.
12. **Rail derecho**: `.hl-rail__card` (genérico, de `homelab-tokens.css`, no
    `.act__head`/`.act__body` que es específico del panel de acción del ciclo de
    vida — semánticamente esto es un resumen, no una acción de estado). Fecha/Hora/
    Enfermera → `.hl-kv`. Badge de progreso "Resultados de exámenes" (ok/warn según
    ratio enviados/total) → clases `.hl-badge.is-ok`/`.is-warn` directas (no hay
    variante genérica en el primitivo `Badge` para esto).
13. **`src/lib/exam-grupos.ts`**: los 4 colores de grupo de examen (hex hardcodeados:
    `#dbeafe`/`#1e40af`, etc.) → tokens de tag del DS (`var(--tag-blue-bg)`,
    `var(--tag-green-bg)`, `var(--tag-violet-bg)`, `var(--tag-amber-bg)` y sus `-fg`).
    Este archivo lo consumen también `exam-grupo-block.tsx` y `exam-label.tsx`
    (usado en `cotizacion-form.tsx`, paso 08) — el fix se propaga automáticamente a
    ambos sin tocarlos.

## Por qué `exam-grupo-block.tsx` no se tocó

Barrido completo (569 líneas): cero literales `oklch(...)`, y sus clases Tailwind
(`text-muted-foreground`, `bg-card`, `border-border`, etc.) ya resuelven correctamente
contra los tokens DS desde el paso 01 — son nombres semánticos shadcn que Tailwind
genera desde el `@theme inline` de compatibilidad, no estilos inline con colores
hardcodeados. Los únicos colores dependientes de datos eran `EXAM_GRUPO_META[...].bg/color`,
ya corregidos en el paso 3 anterior sin tocar este archivo. Los valores de ancho
arbitrarios (`w-[72px]`, `min-w-[180px]`) son dimensionamiento de UI, no parte del
sistema de color — se dejaron igual que el resto del proyecto deja anchos puntuales sin
tokenizar. Su lógica (dropdowns con click-outside, `MoneyField`, `IsapreSelector`,
`GrupoLabBlock`, `AddGroupMenu`) no se tocó.

## Bug encontrado y corregido: overflow del rail en pantallas angostas

Al verificar visualmente en `/visitas/[id]/editar`, el rail derecho (340px fijo) recortaba
texto a la mitad ("Fecha 11-0", "Enfermera Soto Medina, Dar", "Total visita $26") — **no
era truncado con elipsis, sino literalmente cortado por el borde de la columna**, y el
recorte era idéntico incluso ensanchando el viewport a 1600px, lo que descartó de
inmediato una hipótesis de overflow de página completa.

Diagnóstico con `agent-browser eval` (inspección directa del DOM): `.hl-rail__body`
(`display:grid`, sin `grid-template-columns`) tenía `scrollWidth` (389px) mayor que su
`width` visible (338px). La causa: `SummaryGroup` renderiza nombres de servicio largos
(p.ej. "Administración tto intramuscular / Sector Nororiente") dentro de un `<span
className="truncate">` — la utilidad `.truncate` de Tailwind aplica `white-space:nowrap`,
que por la regla CSS de "automatic minimum size" de flex/grid vuelve el **min-content**
de ese span igual a su ancho de línea completa (~350px+) a menos que el elemento (o un
ancestro en la cadena flex/grid) tenga `overflow` distinto de `visible`. Sin eso, ese
min-content se propaga hacia arriba por cada nivel flex/grid (`.rail-g__item` →
`.rail-g` → el div "Resumen de costos" → `.hl-rail__body`), forzando la única columna
implícita del grid a expandirse a ~371–389px — más ancha que los 338px disponibles — y
como `.hl-rail__card` tiene `overflow:hidden`, el excedente se recorta en vez de
mostrarse con elipsis.

Fix en `visita-form.css`: `min-width:0` en cada nivel de la cadena
(`.hl-rail__body`, `.rail-g`, `.rail-g__head`, `.rail-g__item`, `.hl-kv` dentro del
rail) + `overflow:hidden;text-overflow:ellipsis;white-space:nowrap` en los elementos que
realmente truncan (`.rail-g__item span:first-child`, `.hl-kv > dd`). Verificado con
`agent-browser eval` antes/después: `scrollWidth` pasó de 389 a 338 (igual al `width`,
cero overflow), y visualmente el nombre largo ahora muestra elipsis correctamente
("Administración tto intramuscular / Se…") en vez de desbordar. Este patrón (rail
angosto + `.hl-kv`/`.rail-g` reutilizados de zonas con más espacio) es un riesgo a
vigilar en cualquier paso futuro que reuse estas clases dentro de un contenedor angosto.

## Verificación realizada

- `pnpm build` — sin errores de TS, compiló limpio en el primer intento tras el rewrite
  completo.
- `pnpm dev` + `agent-browser`, flujo funcional completo en ambos modos:
  - **Editar** (`/visitas/3731/editar`, estado `realizada`): carga con todos los campos
    poblados, mapa de Google renderiza, tabs muestran conteos correctos (2
    procedimientos, 3 exámenes), rail con badge de estado y total correcto ($265.976).
  - **Crear** (`/pacientes` → "Nueva visita" → `/visitas/nueva?pacienteId=...`): estado
    vacío correcto (guiones, $0), se seleccionó un procedimiento del catálogo → subtotal
    y rail se actualizan en vivo a $22.000 → se aplicó un descuento de $2.000 → precio
    tachado + nuevo precio + línea roja "Descuento procedimientos -$2.000" + total del
    rail baja a $20.000 en tiempo real → se cambió a la tab Exámenes → estado vacío
    "Seleccionar laboratorio" de `exam-grupo-block.tsx` (sin tocar) renderiza
    correctamente integrado.
- `pnpm test` (vitest): 164/164.
- **`pnpm test:e2e`: 7/7** (paso designado por el plan junto con 02 y 04). Un ajuste de
  selector necesario en `e2e/visita-con-descuento.spec.ts:28`: `getByText('Total
  visita', {exact:true}).locator('xpath=following-sibling::span')` (asumía dos `<span>`
  hermanos) → `page.locator('.hl-kv--total dd')`, mismo patrón que el paso 06 ya había
  aplicado a la vista de ciclo de vida — sin ambigüedad porque el formulario y la vista
  de ciclo de vida nunca están montados en la misma página. El otro selector de ese
  spec, `span:text-is("Desc. $") + input[type="number"]` (línea 34), **no necesitó
  cambios** — `.ed-dcto` preserva la adyacencia `<span>` seguido de `<input>` tal cual
  estaba.

## Nota para pasos siguientes

- `cotizacion-form.tsx` (paso 08) es estructuralmente un gemelo de este archivo (según
  el inventario original) y probablemente tenga el mismo patrón de warning de
  oklch/tabs/rail — se puede replicar buena parte de este mismo mapeo de clases.
- `exam-label.tsx` (usado en `cotizacion-form.tsx`) ya hereda los tokens de tag nuevos
  vía `EXAM_GRUPO_COLORS` sin haber sido tocado — confirmar visualmente en el paso 08.
- El riesgo de overflow en rails angostos (`min-width:0` en toda la cadena flex/grid)
  aplica a cualquier rail de 300–340px que reuse `.rail-g`/`.hl-kv` con contenido de
  ancho variable (nombres, montos) — repasar si `cotizacion-form.tsx` tiene un rail
  similar.
