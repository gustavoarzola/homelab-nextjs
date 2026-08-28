# Paso 08 — Cotizaciones (ciclo de vida + formulario)

**Estado: hecho.**

`src/components/cotizacion-lifecycle-view.tsx` (864 líneas) y
`src/components/cotizacion-form.tsx` (1327 líneas) reescritos por completo — misma
lógica (todos los `useState`/`useTransition`/`useMemo`, validaciones, construcción de
`FormData` en `handleSubmit`, llamadas a server actions sobreviven byte-idénticas), solo
cambia el render. `cotizacion-form.tsx` sirve tanto a `/cotizaciones/nueva` como a
`/cotizaciones/[id]/editar` (mismo componente, `isEdit = !!cotizacion`, mismo patrón que
`visita-form.tsx` del paso 07).

## Qué se hizo

### `cotizacion-lifecycle-view.tsx`

Mockup de referencia: `Cotizacion Ciclo de Vida DS.html`. A diferencia de la visita
(paso 06), este mockup casi no necesita CSS propio — se arma con primitivos ya
existentes en `homelab-tokens.css`/`homelab-shell.css`. Nuevo
`src/components/cotizacion-lifecycle-view.css` con solo 3 clases page-specific
(`.stepbar`, `.item-line*`, `.sect-title`) + `.wfull` (utilidad que cada paso repite en
su propio archivo, no se promovió a `homelab-tokens.css`, mismo criterio que pasos 06/07).

- **`EstadoBadge`** → `Badge` (`ui/badge.tsx`) con `ESTADO_COTIZACION_STYLES[estado].badgeClass`,
  con fallback a `is-cot-rechazada` + "Inválido: x" si el estado no matchea (el código
  original tenía este mismo caso de borde).
- **Stepper**: reconstruido con los primitivos `Step`/`Pipe` (`ui/stepper.tsx`). A
  diferencia del fork de 3 vías de la visita (paso 06), acá es un fork de 2 vías
  (Aceptada | Rechazada) separadas por un "o" — igual que el propio `renderStepper()` del
  mockup, que muestra ambos pendientes con una "o" entre ellos hasta que el estado se
  resuelve, y entonces solo muestra el que ganó (no un fork de pills como en visita).
- **`QuoteSummary`**: `.hl-card` para Destinatario y Notas (se mantienen como cards
  separadas, igual que el código original — no se fusionó todo en una sola card flush
  como hace el mockup, mismo criterio conservador que el paso 06 aplicó a sus `.dcard`).
  Servicios + Cargos adicionales sí se unificaron en una única `.hl-card.hl-card--flush`
  con `.sect-title`/`.item-line` por sección, calcando el mockup literal (ahí el mockup
  es explícito con una sola card, y no había ninguna razón para divergir). Dots de
  categoría (antes `oklch(...)` por tono) → `var(--tag-*-dot)`.
- **Rail**: `.hl-rail__card` + `MetaGrid`/`MetaTile` para Total/Para/Enviada/Servicios
  (reemplaza el `RailMeta` a mano). El bloque de metadata "Creada el / Enviada el" que
  vivía suelto bajo la card del rail se relocalizó a `page-head__meta` (mismo dato,
  mismo `cot.createdAt`/`cot.fechaEnvio`, solo cambia dónde se muestra — el mockup pone
  la fecha de creación ahí).
- **Paneles de acción** (`PanelCreada`/`PanelEnviada`/`PanelAceptada`/`PanelRechazada`):
  banners → `Callout` (`info`/`warn`/`ok`/`bad` según el `ACTIONS` del mockup). Botones
  → `Button`. Los toggles "Aceptada"/"Rechazada" de `PanelEnviada` son un acordeón
  inline (no un modal — el código real nunca usó `.hl-modal` para esto, a pesar de que
  el mockup sí lo hace; se mantuvo el patrón inline existente, ver nota de alcance más
  abajo).

### `cotizacion-form.tsx`

Mockup de referencia: `Cotizacion Edicion DS.html`. Nuevo
`src/components/cotizacion-form.css`, deliberadamente **sin compartir nombres de clase**
con `visita-form.css` aunque el patrón sea análogo (`.form-bar` vs `.edit-bar`, `.tabs`
vs `.ed-tabs`, `.picked` vs `.ed-items`, `.rail-group` vs `.rail-g`) — cada mockup define
sus propias clases y cada paso las respeta tal cual, sin promoverlas a un archivo
compartido (precedente ya sentado en el paso 07).

- Header sticky → `.form-bar` + `Button`s.
- Banner de error → clases `.hl-callout .hl-callout--bad` a mano, no el primitivo
  `Callout` — necesita el `ref` de `errorRef` para el `scrollIntoView`, igual razón que
  el paso 07.
- Destinatario → `.fcard` + `hl-row2`/`hl-fieldgroup`, ficha de paciente seleccionado con
  `.hl-avatar`.
- Servicios → `.fcard` + `.tabs` (con badge de conteo) + `.picked`/`.picked__row` para
  procedimientos/talleres seleccionados (`ServiceTabContent`/`TalleresTabContent`). El
  input de descuento por ítem usa `.ed-dcto` (estructuralmente idéntico al de
  `visita-form.tsx` — `<span>Desc. $</span>` + `<input>` hermanos), duplicada en
  `cotizacion-form.css` (ver corrección de la revisión, más abajo).
- Cargos adicionales: selector Monto fijo/Porcentaje (antes un `<select>` nativo) →
  `.segm` segmentado con dos `<button aria-pressed>` — a diferencia del paso 06 (que usó
  `.segm` para un toggle Boleta/Factura que ya era binario con otro patrón), acá es el
  uso "real" que el propio mockup le da a esa clase. El input de descuento por ítem
  (`.ed-dcto`, `<span>Desc. $</span>` + `<input>` hermanos) se duplicó en
  `cotizacion-form.css` en vez de depender de que `visita-form.css` esté cargado por
  coincidencia — ver corrección más abajo.
- Rail → `.hl-rail` + `.rail-group`/`.rail-total`, con el mismo fix proactivo de
  `min-width:0` en toda la cadena (`.hl-rail__body`, `.rail-group`, `.rail-group__item`)
  que el paso 07 tuvo que descubrir a posteriori para `visita-form.css` — se aplicó
  desde el principio acá. **Confirmado necesario**: sin el fix, un nombre de servicio
  largo (verificado con "Administración tto intramuscular / Sector Nororiente") se
  recorta igual que en el bug original del paso 07; con el fix, trunca con elipsis
  correctamente.

## Nota de alcance: sin modal para aceptar/rechazar

El mockup `Cotizacion Ciclo de Vida DS.html` usa un `.hl-modal` (backdrop + diálogo) para
enviar/aceptar/rechazar. El código real de este proyecto **nunca implementó esa
interacción como modal** — siempre fue un acordeón inline en el rail (dos secciones
`action === 'aceptar' | 'rechazar'` que se expanden en su lugar). Se mantuvo el patrón
inline existente (solo reskineado con `.hl-disclosure`) en vez de migrar a `.hl-modal`,
porque cambiar de "expande en el rail" a "abre un diálogo flotante" es un cambio de
interacción, no solo de estilo — fuera del alcance de "cero cambio funcional" de este plan.

## Bug encontrado y corregido: rol de accesibilidad de los toggles Aceptar/Rechazar

Primer intento: los toggles "Aceptada"/"Rechazada" de `PanelEnviada` se implementaron con
`<details>`/`<summary>` nativos (necesario en apariencia porque `.hl-disclosure > summary`
en `homelab-tokens.css` usa un combinador de hijo directo que exige el tag `<summary>`
literal). Esto rompió `e2e/cotizacion-a-visita.spec.ts`, que hace
`page.getByRole('button', { name: 'Aceptada' })`: un `<summary>` no se expone con rol
`button` en el árbol de accesibilidad de Chromium, aunque tenga `onClick`, así que
Playwright no lo encontraba.

En vez de parchear con `role="button"` sobre el `<summary>`, se revisó cómo resolvió esto
mismo el paso 06 (`visita-lifecycle-view.tsx`, sección "No realizada" de
`PanelConfirmada`): ese archivo nunca usó `<details>/<summary>` — usa un
`<div className="hl-disclosure">` + `<button>` real, con el padding/cursor que
`.hl-disclosure > summary` habría dado replicados a mano vía `style` inline (porque el
selector `> summary` no aplica a un `<button>`). Se adoptó ese mismo patrón acá,
descartando `<details>` por completo. Resultado: semántica de botón nativa preservada sin
hacks de rol, consistente con el precedente ya establecido, y el test vuelve a pasar.

## Verificación realizada

- `pnpm build` — sin errores de TS.
- `pnpm dev` + `agent-browser`, recorrido funcional completo:
  - Ciclo de vida en las 4 estados (`creada`, `enviada`, `aceptada`, `rechazada`) —
    stepper, badges, callouts y rail correctos en cada uno.
  - Acordeón "Aceptada" en estado `enviada`: expande con chevron rotado, formulario de
    selección de paciente, botón "Aceptar y crear visita" — **ejecutado end-to-end**:
    aceptó una cotización con paciente registrado, creó la visita real vía server action
    y redirigió a `/visitas/<id>` (confirmado con la URL resultante).
  - Formulario de creación (`/cotizaciones/nueva`): tabs, búsqueda de procedimiento con
    dropdown y `Chip` de código, selección actualiza el rail en vivo ($0 → $22.000),
    comuna vía combobox, envío completo del formulario — **creó la cotización real**
    (COT-00449) y redirigió a su vista de ciclo de vida con todos los datos persistidos
    correctamente (destinatario, comuna, procedimiento, tag "Sin paciente asociado").
- `pnpm test` (vitest): 164/164 (mismas 4 fallas preexistentes no relacionadas de
  siempre).
- **`pnpm test:e2e`**: 7/7 tras el fix de accesibilidad descrito arriba (no es uno de los
  checkpoints obligatorios del plan — solo 02/04/07 lo son — pero se corrió igual porque
  `e2e/cotizacion-a-visita.spec.ts` ejercita este flujo de punta a punta; encontró la
  falla real documentada arriba).

## Correcciones de la revisión (parent session, tras el reporte del fork)

- **Regresión funcional real**: el crumb "Cotizaciones" del header de
  `cotizacion-form.tsx` había quedado como `<div>` de texto estático — antes era un
  `<button onClick={() => router.push('/cotizaciones')}>` clickeable (el mockup
  `Cotizacion Edicion DS.html` lo muestra como texto simple porque es una demo estática,
  pero el código real sí navegaba). Restaurado con el mismo patrón que
  `visita-form.tsx` usa para su crumb análogo (`edit-bar__crumb`, paso 07), que sí lo
  había preservado correctamente.
- **Acoplamiento CSS frágil**: `.ed-dcto` se referenciaba en `cotizacion-form.tsx` sin
  que `cotizacion-form.css` la definiera — dependía de que `visita-form.css` estuviera
  cargado por coincidencia (otra ruta del bundle). Corregido duplicando la regla en
  `cotizacion-form.css`, consistente con el criterio de "sin CSS compartido entre
  page-specific stylesheets" que este mismo documento declara para el resto de las
  clases.

Ambas verificadas de nuevo tras el fix: `pnpm build` limpio, crumb clickeable
confirmado con `agent-browser` (aparece como `button`, no `link`/texto), `pnpm test`
164/164, `pnpm test:e2e` 7/7.

## Nota para pasos siguientes

- El patrón `<div className="hl-disclosure"> + <button>` (no `<details>/<summary>`) debe
  ser el default para cualquier acordeón nuevo sobre `.hl-disclosure` en pasos
  siguientes — usar `<details>` rompe roles de accesibilidad que los tests (y lectores
  de pantalla reales) esperan como `button`.
