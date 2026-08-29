# Paso 13 — Homologación visita-form / cotizacion-form

**Estado: hecho.**

Fuera del plan de migración original (01-12, cerrado en el paso 12) — este paso corrige
una divergencia que el propio plan había introducido a propósito.

## Contexto

Los pasos 07 y 08 migraron `visita-form.tsx` y `cotizacion-form.tsx` por separado, cada
uno calcando su propio mockup (`Visita Ciclo de Vida DS.html` / `Cotizacion Edicion
DS.html`). El paso 08 declaró explícitamente que **no** compartiría nombres de clase con
el paso 07, aunque el patrón visual fuera análogo (`cotizacion-form.css:1-13`: `.form-bar`
vs `.edit-bar`, `.tabs` vs `.ed-tabs`, `.picked` vs `.ed-items`, `.rail-group` vs
`.rail-g`) — precedente sentado en `07-visita-form.md` para no compartir CSS
page-specific.

El resultado: dos formularios que hacen exactamente lo mismo (mismo estado, mismos
campos, mismas server actions) pero se veían distinto, y la implementación de visitas
había quedado mejor — usa primitivos (`Button`, `FieldGroup`) donde cotización repite
`style={{}}` inline, y el motor de precios (`calcularCostoVisitaPreview`) donde
cotización recalcula todo a mano.

## Qué se hizo

Homologada toda la parte **común** de ambos formularios: sección Servicios (tabs +
filas de ítem + estados vacíos), Cargos adicionales, header sticky y rail de resumen de
costos. Lo propio de cotización (Destinatario, selector de comuna, estado/lifecycle,
Notas, Imprimir, vigencia) no se tocó.

Esta vez, a diferencia de los pasos 07/08, se homologó con **componentes y CSS
compartidos** en vez de copiar markup — así ambos formularios no pueden volver a
divergir en silencio:

- **`src/components/form-shared.css`** (nuevo) reemplaza `visita-form.css` y
  `cotizacion-form.css` (ambos borrados). Contiene `.edit-bar`, `.fcard*`, `.segm`,
  `.ed-tabs`, `.ed-items`/`.ed-item*`, `.ed-dcto`, `.ed-empty`, `.rail-g*` — todas tal
  como estaban en `visita-form.css` (el que ganó la comparación) — más un `.fpanel`
  nuevo (reemplaza el objeto de estilo inline `{ borderRadius, padding, background,
  border }` que ambos formularios repetían en cada panel de "Cargos adicionales":
  3 veces en cotización, 3 en visita) y `.rail-total*` (solo lo usa cotización, vive acá
  para no reintroducir una hoja page-specific por un único bloque).
- **`src/components/form-servicios.tsx`** (nuevo): primitivos presentacionales
  extraídos del render de `visita-form.tsx` — `ServiceTabs`, `ServiceItems`/`ServiceItem`,
  `DiscountInput`/`PriceInput`, `ServiceEmpty`, `Segmented`, `SummaryGroup`, y el helper
  `CLP`. Sin lógica de negocio: cada formulario les sigue pasando su propio estado
  (selección, mapas de descuento/precio) por props.
- **`cotizacion-form.tsx`**: reescrito para consumir esos primitivos. Se borraron los
  sub-componentes locales `ServiceTabContent`/`TalleresTabContent`/`SummaryGroup`
  (duplicaban `ServiceItem`/`SummaryGroup`). Cambios visibles: header pasa de `.form-bar`
  (dos filas) a `.edit-bar` (una fila con `__spacer`, como visitas, con `ChevronRight` en
  el crumb); el estado pasa de `<Chip>{estado}</Chip>` crudo a
  `<Badge badgeClass={ESTADO_COTIZACION_STYLES[...].badgeClass}>`, igual que visitas con
  `ESTADO_VISITA_STYLES`; el tab strip pasa de subrayado full-bleed (fuera de
  `.fcard__body`) a pill/segmentado (dentro, como visitas); el precio de taller pasa de
  un `.hl-input` de 110×32px a la misma pill `.ed-dcto` con `$` que usa visitas; los tres
  paneles de "Cargos adicionales" y el toggle Monto fijo/Porcentaje ahora usan
  `.fpanel`/`Segmented`.
- **`visita-form.tsx`**: mismo refactor en la otra dirección — el JSX inline de
  tabs/procedimientos/talleres/recargos se reemplazó por los primitivos compartidos
  (mismo markup resultante, cero cambio visual); se borró el `SummaryGroup` local.
- **`src/components/exam-label.tsx`** — borrado. Solo lo usaba `SummaryGroup` de
  cotización, en una rama (`'code' in item ? <ExamLabel .../> : ...`) a la que ningún
  caller pasaba nunca ese shape de ítem — código muerto desde que se escribió en el
  paso 08. El rail de cotización ahora muestra los exámenes con nombre simple, igual que
  visitas (decisión explícita: uniformar en vez de llevar `ExamLabel` a ambos rails, que
  son angostos — 340px).

## Bugs latentes encontrados (del paso 08, no de este)

- **`.segm` roto en cotización en cold-load**: `cotizacion-form.tsx` usaba
  `className="segm"` para el toggle Monto fijo/Porcentaje, pero `.segm` solo estaba
  definida en `visita-form.css`, que cotización nunca importaba. Si `/cotizaciones/nueva`
  era la primera página cargada en la sesión (sin haber pasado antes por una página de
  visita), el control salía sin estilo — dos `<button>` pelados. Mismo tipo de
  acoplamiento que el propio paso 08 dice haber corregido para `.ed-dcto`
  (`cotizacion-form.css:52`), pero `.segm` se pasó por alto. Se resuelve solo al mover
  todo a `form-shared.css`.
- **`ExamLabel` muerto** — ver arriba.
- **`.subtot`** (`cotizacion-form.css:50`) definida y nunca usada — no se migró a
  `form-shared.css`.
- **Inconsistencia interna en `cotizacion-form.tsx`**: `ServiceTabContent` ponía
  `<Chip>` dentro de `.picked__name`; `TalleresTabContent` lo ponía fuera. Ya no aplica:
  ambos casos pasan por el mismo `ServiceItem`.

## Cambio funcional deliberado (fuera del "cero cambio visual" habitual de este plan)

`visita-form.tsx` ofrecía talleres inactivos en el selector (`talleres.map(...)`, sin
filtrar `activo`); `cotizacion-form.tsx` sí filtraba (`talleres.filter(t => t.activo)`).
Se adoptó el filtro de cotización en visitas — un taller desactivado no debería poder
seleccionarse en una visita nueva. Único cambio de comportamiento de este paso; el resto
es puramente visual.

## Adenda: filas de examen seleccionado (`exam-grupo-block.tsx`)

El refactor original dejó fuera la tab de Exámenes a propósito: `ExamenesPorGrupo`
(`src/components/exam-grupo-block.tsx`) es compartida por ambos formularios pero nunca
se tocó en los pasos 07/08 — el paso 07 la auditó y la dejó igual porque sus clases
Tailwind ya resolvían contra los tokens DS. El resultado: las filas de examen
seleccionado se veían distinto de las de procedimiento/taller — más grandes (`px-3.5
py-2.5` vs el `padding: 10px 0` de `.ed-item`), con su propio badge de código
(`text-[10.5px]`, sin borde) en vez de `Chip`, y envueltas en una caja con borde propia
(`rounded-lg border border-border`) que ni Procedimientos ni Talleres tienen.

Se homologaron **solo las filas de examen seleccionado** dentro de cada
`GrupoLabBlock` a los mismos primitivos de `form-servicios.tsx` (`ServiceItems`,
`ServiceItem`, `ServiceEmpty`) — mismo padding, mismo `Chip` de código, mismo botón de
borrado. Los exámenes catálogo pasan el precio como texto (`price={formatCLP(e.precio)}`);
los isapre pasan `price={null}` y los dos `MoneyField` (Valor examen / Valor a pagar)
como `children`, igual patrón que ya usaba `PriceInput` en Talleres.

**Lo que se preservó a propósito** (pedido explícito): la caja de color por
laboratorio/grupo (`GrupoLabBlock`, header con `meta.bg`/`meta.color` — ya venía de
tokens `--tag-*` desde el paso 07) sigue igual — es la pieza de UX que agrupa
visualmente los exámenes por origen y no es parte de la fila individual. Tampoco se
tocaron `ExamPicker`, `IsapreSelector` ni `AddGroupMenu` (los dropdowns): el pedido era
homologar las listas de ítems seleccionados, no el resto del componente.

### Bug encontrado durante la verificación: overlap en filas de examen isapre

`.ed-item` no tenía `flex-wrap`, y `.ed-item__main` usaba `min-width: 0`. Eso nunca fue
un problema en Procedimientos/Talleres porque su contenido lateral (`DiscountInput`/
`PriceInput`) es angosto. Pero un examen isapre trae **dos** `MoneyField` (~300px
combinados); sin espacio para todo en una sola línea, `.ed-item__main` se comprimía
hasta un ancho mínimo casi nulo y el nombre del examen hacía *word-wrap* interno — con
`align-items: center` en la fila, la segunda línea del nombre terminaba superpuesta con
la etiqueta "Valor examen" (confirmado visualmente con `agent-browser`, caso
"HEMOGRAMA COMPLETO").

Fix en `form-shared.css`: `.ed-item` ahora tiene `flex-wrap: wrap` (cuando no cabe todo,
el bloque de la derecha —inputs/precio/borrar— baja de línea completo, en vez de
aplastar el nombre) y `.ed-item__main` pasa de `min-width: 0` a `min-width: 180px`
(mismo valor que el `min-w-[180px]` que tenía el markup original de
`exam-grupo-block.tsx`, ahora como piso real en vez de permitir colapso a 0).
Verificado con `agent-browser`: fila de "HEMOGRAMA COMPLETO" isapre con ambos montos
cargados, sin overlap, "La isapre bonifica…" se sigue viendo bien debajo.

### Verificación

- `pnpm build`, `pnpm test` (164/164), `pnpm test:e2e` (7/7) — sin regresiones.
- `agent-browser`: grupo catálogo (Imalab, 2 exámenes) y grupo isapre (Imalab · Isapre,
  1 examen con ambos montos) en `/visitas/nueva`, comparados lado a lado con la tab
  Procedimientos — mismo alto de fila, mismo `Chip`, mismo botón de borrado.

## Fuera de alcance (documentado, no tocado)

1. **Motor de precios**: cotización sigue calculando los totales a mano
   (`useMemo`s en el propio componente) en vez de usar
   `calcularCostoVisitaPreview()` (`src/lib/pricing/visita-preview.ts`). Unificarlo
   cambiaría montos, no aspecto.
2. **Snapshots de precio**: cotización sigue leyendo el precio vivo del catálogo e
   ignorando `cotizacion.procedurePrices[].precio`/`examPrices[].precio` — por eso no
   tiene avisos de deriva de precio (`ProcedimientoPriceWarning`/`ExamenPriceWarning`
   siguen siendo exclusivos de visitas, vía la prop opcional `warning` de `ServiceItem`).
3. **`PacienteOption.email`/`.telefono`/`.rut`** declarados en el tipo y renderizados en
   la ficha del paciente de cotización, pero `getPacientes()` nunca los devuelve — código
   muerto preexistente, no relacionado con este refactor.

## Verificación realizada

- `pnpm build` — sin errores de TS.
- `pnpm test` (vitest): 164/164 (mismas 4 fallas preexistentes no relacionadas de siempre).
- `pnpm test:e2e`: 7/7, incluyendo `visita-con-descuento.spec.ts` (selector
  `span:text-is("Desc. $") + input[type="number"]`, preservado por `DiscountInput`) y
  `cotizacion-a-visita.spec.ts` (flujo completo crear → aceptar → convertir a visita).
- `pnpm dev` + `agent-browser`, comparando lado a lado:
  - `/visitas/nueva` y `/cotizaciones/nueva`: tabs, filas de ítem, estados vacíos y
    subtotal del header idénticos.
  - Búsqueda de procedimiento con un nombre largo ("Administración tto intramuscular /
    Sector Nororiente") en cotización: el rail trunca con elipsis correctamente (la
    cadena `min-width:0` de `07-visita-form.md` ahora vive una sola vez en
    `form-shared.css`).
  - `/cotizaciones/[id]/editar` (COT-00450, estado "Creada"): header con `Badge` igual
    que visitas, rail con exámenes por nombre simple (sin `ExamLabel`).
  - `/visitas/[id]/editar`: header, Servicios y Cargos adicionales visualmente idénticos
    a cotización salvo lo propio de cada uno (rail con `.hl-kv--total` en visitas vs
    `.rail-total` en cotización, aviso de deriva de precio solo en visitas).

## Nota para pasos siguientes

`form-servicios.tsx`/`form-shared.css` son ahora el lugar correcto para cualquier pieza
nueva de la sección Servicios/Cargos que deba verse igual en ambos formularios — no
volver al patrón "cada mockup define sus propias clases" para estas piezas comunes.
