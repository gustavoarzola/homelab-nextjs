# Paso 06 — Ciclo de vida de visita

**Estado: hecho.**

`src/components/visita-lifecycle-view.tsx` era el archivo con más inline styles del
repo (171 `style={{}}`, 1415 líneas). Reescrito por completo — misma lógica (todos los
`useState`/`useTransition`, validaciones, handlers y llamadas a server actions
sobreviven byte-idénticos), solo cambia el render. `src/app/(admin)/visitas/[id]/page.tsx`
no se tocó (ya era un wrapper delgado, sin markup propio).

## Qué se hizo

1. **Nuevo `src/components/visita-lifecycle-view.css`**: subconjunto del `<style>` de
   `Visita Ciclo de Vida DS.html` (proyecto de diseño) — solo las clases que esta
   vista consume (`.lifebar`, `.fork*`, `.dcard*`, `.svcgroup*`/`.svclist*`/`.lineitem`,
   `.act__head`/`.act__body`, `.cs*` del acordeón de cierre, `.chk*` del checklist,
   `.pay-toggle`). Se omitieron a propósito las clases del modo alternativo "cierre en
   la columna principal" del mockup (`.mode-bar`, `.backlink`, `.bulkbar`, `.selbar`,
   `.ex-table`, `.edit-*`) — **ese modo no se implementa**, ver más abajo.
2. **Stepper**: reconstruido sobre `.hl-stepper` + los primitivos `Step`/`Pipe`
   (`ui/stepper.tsx`) para los 3 pasos principales, y el fork terminal
   (completada/no_realizada/cancelada) con las clases `.fork`/`.fork__opt` del mockup.
   Corregí una condición al traducirlo: el mockup activa `.fork.is-live` solo cuando el
   estado ya es terminal (`s>2`), no desde "realizada" — el código viejo lo replicaba
   con `opacity: doneMainStep < 3 && !isActive ? 0.5 : 1`, que es equivalente a
   `is-live` cuando `doneMainStep === 3`. Usé `isTerminal` directamente.
3. **Header** → `.page-head` (código de visita + `Badge` + costo, botones "Editar
   visita"/"Volver" con el primitivo `Button`). El stepper (`.lifebar`) necesita ir
   edge-to-edge, así que escapa el padding de `.app-body` con el mismo truco de margen
   negativo (`-28px -32px`) que ya usa el dashboard — no hay ninguna clase DS para
   "romper" el padding del layout, es una técnica del proyecto, no del DS.
4. **Body**: `.split` (contenido + rail de 330px sticky) en vez del
   `grid-cols-[1fr_360px]` a mano.
5. **`VisitaSummary`**: cada tarjeta (paciente/programación/cierre/servicios/notas) →
   `.dcard`. Grillas de metadatos (`MetaCell` repetido 12+ veces) → `MetaTile`/`MetaGrid`
   (`ui/meta.tsx`). Códigos de examen/procedimiento → `Chip`. Grupos de servicio
   (`SvcGroup`) → `.svcgroup`/`.svclist`. Los dots de color por categoría
   (procedimientos/exámenes/isapre/talleres) pasaron de literales `oklch(...)` a
   `var(--tag-blue-dot)`/`var(--tag-green-dot)`/`var(--tag-violet-dot)`/`var(--tag-amber-dot)`.
   Total → `.hl-kv.hl-kv--total` (ya existía en `homelab-tokens.css` desde el paso 01,
   no hubo que agregarlo).
6. **`EstadoBadge`** eliminado — sus ~2 usos ahora son `<Badge badgeClass={cfg.badgeClass}>`
   directo (el campo `badgeClass` ya lo expone `estado-colors.ts` desde el paso 01). El
   parámetro `size="lg"` se soltó: `.hl-badge` no tiene variante de tamaño en el DS.
7. **Paneles de acción** (`PanelProgramada`, `PanelConfirmada`, `PanelCompletada`,
   `PanelNoRealizada`, `PanelCancelada`): envueltos en `.act__head`/`.act__body` (la
   clase que usa el propio mockup para el rail, más específica que `.hl-rail__head`/
   `.hl-rail__body` genéricos). CTAs primarios → `Button`. Banners informativos/de
   advertencia (antes `<div>` a mano con `AlertCircle` y `oklch(...)`) → primitivo
   `Callout` (`tone="info"/"warn"/"ok"/"bad"`, ícono automático según tono — por eso el
   import de `AlertCircle` quedó sin uso y se sacó). "Cancelar visita…" y
   `CancelInline` → `.hl-input`/`Button variant="destructive"` (outline rojo, no sólido
   — mismo criterio que el paso 04: es el patrón que usa el propio DS para su acción
   destructiva final, "Confirmar cancelación").
8. **`CompletionSection`** (acordeón de Facturación/Pago/Exámenes): mapeado a las clases
   `.cs`/`.cs__head`/`.cs__num`/`.cs__title`/`.cs__chev`/`.cs__body` del mockup — son
   estructuralmente el mismo acordeón (círculo numerado + título + chevron + cuerpo
   colapsable) que ya tenía el código, así que fue un cambio de clases, no de DOM. Los
   chips de estado "Sin guardar"/"Pendiente"/"Guardado" (sin equivalente en el mockup)
   se quedaron como badges a medida, tokenizados con `--warn-bg/fg`,
   `--color-surface-muted`, `--ok-bg/fg`.
9. El toggle "Marcar como pagada" → clase `.pay-toggle` del mockup (encajaba
   estructuralmente con la card clickeable que ya existía) + `.hl-checkbox` para el
   indicador. El checklist de exámenes reutiliza el mismo patrón `.hl-checkbox` en cada
   fila.

## Decisión explícita: NO se implementa el modo "cierre en columna principal"

El mockup `Visita Ciclo de Vida DS.html` tiene un modo alternativo donde el cierre
(Facturación/Pago/Exámenes) se abre a pantalla completa en la columna principal en vez
de en el rail angosto. **No se implementó.** El usuario fue explícito: la vista de
completitud/cierre la aborda en una sesión futura, después de esta actualización del
DS. Este paso solo re-skinnea el acordeón compacto del rail tal cual está hoy — mismo
DOM, mismo comportamiento, solo tokens y clases nuevas.

## Por qué no hay tarjeta de Historial/Timeline

El mockup incluye una tarjeta de historial (`.hl-timeline`) bajo el rail de acción.
`VisitaLifecycleDetalle` no trae timestamps de cambio de estado — agregar esa tarjeta
requeriría una fuente de datos que hoy no existe (cambio funcional, no visual). Se
dejó fuera; si se quiere en el futuro, es un paso de backend primero.

## Verificación realizada

- `pnpm build` — sin errores de TS (una vuelta: sobró el import de `AlertCircle` tras
  mover los banners a `Callout`, se quitó).
- `pnpm dev` + `agent-browser` sobre una visita en estado `realizada` (la que ejercita
  más superficie: stepper, badges, chips, acordeón de cierre): verificado el flujo
  completo — escribir N° de boleta → el círculo de sección se pone verde y el botón
  pasa a "Guardar y continuar" habilitado → guardar dispara el server action, toast de
  éxito, la sección se colapsa mostrando el resumen y avanza automáticamente a "Pago" →
  recargar la página conserva el valor guardado (`12345`) → togglear "Marcar como
  pagada" muestra el estado `.pay-toggle.is-on` y despliega método/fecha. Toda la
  lógica de dirty-tracking, avance automático entre secciones y persistencia funciona
  igual que antes del reskin.
- `pnpm test` (vitest): 164/164.
- **`pnpm test:e2e`**: 1 falla real → **arreglada**. `e2e/visita-con-descuento.spec.ts:52`
  usaba `page.getByText('Total', { exact: true }).locator('xpath=following-sibling::span')`
  para leer el costo persistido tras guardar una visita — ese "Total" vivía en un
  `<span>` seguido de otro `<span>` en el código viejo; ahora es un `<dt>Total</dt>`
  seguido de `<dd>` dentro de `.hl-kv--total` (el patrón `.hl-kv` del DS, ya usado en
  el resto de la vista). Se corrigió el selector a `page.locator('.hl-kv--total dd')`
  — selector estructural, no texto/label/testid, exactamente el tipo de ajuste que el
  plan anticipaba como aceptable en `00-overview.md`. La otra ocurrencia del mismo
  patrón en la línea 28 (`'Total visita'`, dentro de `visita-form.tsx`) no se tocó —
  ese archivo es el paso 07, todavía no migrado. **7/7 tests pasan** tras el fix.

## Nota para pasos siguientes

- El paso 07 (`visita-form.tsx`) es el próximo en tocar `e2e/visita-con-descuento.spec.ts`
  — cuando se reskinee el formulario de creación, revisar si el selector de la línea 28
  (`'Total visita' + following-sibling::span`) sigue vigente o necesita el mismo
  tratamiento que el de este paso.
- `EstadoBadge` ya no existe como componente local; cualquier vista nueva que necesite
  el badge de estado de visita debe importar `Badge` de `ui/badge.tsx` directamente con
  `ESTADO_VISITA_STYLES[estado].badgeClass`.
