# Plan: aplicar el Design System HomeLab

## Contexto

El proyecto tiene hoy tres dialectos de estilo conviviendo:

1. **Dominante (~90%)**: Tailwind para geometría + `style={{ color: 'var(--muted-foreground)' }}`
   inline para todo color. 56 de 82 `.tsx`. Los peores: `visita-lifecycle-view.tsx` (171
   inline styles), `visita-form.tsx` (125), `cotizacion-form.tsx` (117),
   `cotizacion-lifecycle-view.tsx` (101), `data-table.tsx` (53).
2. **shadcn/Tailwind semántico**: solo dentro de `src/components/ui/*`. `ui/button.tsx`
   se importa **una sola vez** en todo el repo (`date-picker.tsx:10`).
3. **Glassmorphism hardcodeado**: solo el dashboard.

Existe un design system diseñado en Claude Design (proyecto
`f20b3901-7c86-452d-854e-3c51dd890562`): `homelab-tokens.css` (tokens + ~40 clases
`.hl-*`), `homelab-shell.css` (shell y page-head), y mockups aplicados para catálogos,
ciclo de vida de visita, cierre de visita, y ciclo/edición de cotización.

## Objetivo

Una sola fuente de verdad visual: tokens del DS reemplazan hardcodes, primitivos `.hl-*`
reemplazan elementos hechos a mano, azul de marca reemplaza al negro, densidad de
backoffice (13px, controles 36px) parametrizada en un solo lugar (`data-density`).

## Decisiones tomadas

- **Solo modo claro** — se elimina `next-themes`, el toggle y `.dark`.
- **Extender el DS por analogía** a vistas sin mockup (dashboard, asignación, pacientes,
  enfermeras, pagos, reportes, login).
- **Densidad global**: 13px base, `data-density="medium"` en `<html>`, toda la app.
- **Migrar todos los inline styles a clases** (no dejar híbrido).

## Restricción explícita

Solo cambio visual, **cero cambio funcional**. El mockup `Visita Ciclo de Vida DS.html`
fusiona edición dentro del ciclo de vida como "modo" — **eso NO se implementa**. Se
mantienen las rutas actuales `/visitas/[id]` (lifecycle) y `/visitas/[id]/editar` (form).
La vista de cierre/completitud se reestiliza pero su lógica queda intacta (el usuario la
aborda después).

## Arquitectura de tokens (decisión crítica)

El DS usa los namespaces de Tailwind 4 (`--color-*`, `--text-*`, `--radius-*`, `--shadow-*`,
`--font-*`), que chocan con el `@theme inline` shadcn de `globals.css:7-30`. Aliasear mal
(`--primary: var(--color-primary)` + `--color-primary: var(--primary)`) crea una
referencia circular que CSS descarta en silencio.

**Solución**: el bloque de tokens del DS se declara como `@theme` (no `:root`). Tailwind
emite todo a `:root` (las clases `.hl-*` siguen funcionando) y además genera utilidades:
`bg-surface`, `text-fg-muted`, `border-border-strong`, `text-base` (13px), `rounded-lg`
(10px), `shadow-sm`, `font-mono`.

**Alias de compatibilidad** (temporales, se borran en el paso 12): en `:root` se
redefinen los nombres shadcn (`--background`, `--card`, `--primary`, …) apuntando a
**primitivos** del DS (`--neutral-*`, `--brand-*`), nunca a los semánticos `--color-*` —
así el rebranding completo ocurre en el paso 01 sin tocar componentes.

Trampas a manejar en el paso 01:
- `--color-accent` del DS es **naranjo**; `hover:bg-accent` de `ui/button.tsx` se
  corrige al reescribir el botón (paso 03).
- Los `--radius-*` actuales coinciden con la escala del DS; se eliminan del bloque viejo.

## Pasos

| Archivo | Alcance | Estado |
|---|---|---|
| `01-fundaciones.md` | tokens CSS, fuentes, logo, solo-claro, alias de compatibilidad | **hecho** |
| `02-shell.md` | `(admin)/layout.tsx`, `sidebar.tsx`, `PageHeader`, `login/` | **hecho** |
| `03-primitivos.md` | `src/components/ui/*` | pendiente |
| `04-data-table.md` | `data-table.tsx` completo | pendiente |
| `05-catalogos.md` | Los 12 `*-table.tsx` + sus `page.tsx` | pendiente |
| `06-visita-ciclo.md` | `visita-lifecycle-view.tsx` + `visitas/[id]/page.tsx` | pendiente |
| `07-visita-form.md` | `visita-form.tsx`, `exam-grupo-block.tsx`, páginas nueva/editar | pendiente |
| `08-cotizaciones.md` | `cotizacion-lifecycle-view.tsx`, `cotizacion-form.tsx` | pendiente |
| `09-pacientes.md` | `paciente-form.tsx`, `historial-paciente.tsx`, `file-upload.tsx` | pendiente |
| `10-dashboard.md` | Sacar glassmorphism; cards y gráficos desde tokens DS | pendiente |
| `11-operacion.md` | `asignacion-*`, `pagos-enfermeras`, `reportes-visitas` | pendiente |
| `12-limpieza.md` | Alias de compatibilidad, `.dark`, `tailwind.config.ts`, oklch sueltos | pendiente |

Se implementa **un paso a la vez**, commiteando al cerrar cada uno. Este directorio es el
estado persistente del avance — si la sesión se corta, se retoma leyendo el estado de
cada archivo.

## Verificación (por paso)

1. `pnpm build` — sin errores de TS.
2. `pnpm dev` + recorrer las pantallas del paso. Checklist visual: azul en acciones
   primarias, naranjo solo en énfasis puntual, 13px de cuerpo, tabular-nums en montos,
   foco visible con anillo azul.
3. `pnpm test` (vitest) — no debería verse afectado, es lógica pura.
4. **`pnpm test:e2e` después de los pasos 02, 04 y 07.** Selectores estructurales frágiles
   a vigilar: `e2e/utils.ts:26` (`ul.max-h-52.overflow-y-auto li`), `e2e/utils.ts:50`
   (`.rdp-caption_label`), `e2e/visita-con-descuento.spec.ts:28,34,52`. Se conservan
   textos/`label`/`name`/`id`/`data-testid`; si un selector estructural se rompe, se
   ajusta el test, no el diseño.
5. Al cerrar todos los pasos, comparar contra los mockups del proyecto de diseño.

## Referencia — proyecto de diseño

Claude Design, projectId `f20b3901-7c86-452d-854e-3c51dd890562`. Archivos clave:
`homelab-tokens.css`, `homelab-shell.css`, `HomeLab Design System.html` (documentación
viva), `Catalogo Examenes DS.html`, `Visita Ciclo de Vida DS.html`, `Visita Cierre DS.html`,
`Cotizacion Ciclo de Vida DS.html`, `Cotizacion Edicion DS.html`, `assets/homelab-logo.png`.
Leer con `DesignSync` (`get_file`) al empezar cada paso relevante.
