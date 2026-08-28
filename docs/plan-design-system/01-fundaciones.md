# Paso 01 — Fundaciones

**Estado: hecho.**

## Qué se hizo

1. **`src/app/homelab-tokens.css`** (nuevo) — copia de `homelab-tokens.css` del proyecto
   de diseño Claude Design (`f20b3901-7c86-452d-854e-3c51dd890562`). El bloque `:root`
   inicial se convirtió en `@theme` para que Tailwind 4 emita utilidades directas
   (`bg-surface`, `text-fg-muted`, `border-border-strong`, `text-base` = 13px,
   `rounded-lg` = 10px, `shadow-sm`, `font-mono`, …) además de las custom properties que
   consumen las ~40 clases `.hl-*`. `--font-sans`/`--font-mono` apuntan a
   `var(--font-inter)`/`var(--font-jetbrains)` (ver punto 3).
2. **`src/app/homelab-shell.css`** (nuevo) — copia verbatim de `homelab-shell.css`
   (`.app`, `.app-side`, `.page-head`, `.toolbar`, `.split`). Sin uso todavía (paso 02).
3. **Fuentes**: `next/font/google` Inter + JetBrains_Mono en `src/app/layout.tsx`
   (`variable: '--font-inter'` / `'--font-jetbrains'`), aplicadas en el `className` de
   `<html>`.
4. **Logo**: `public/homelab-logo.png` (no existía `public/`, se creó), bajado del
   proyecto de diseño (`assets/homelab-logo.png`). Sin uso todavía (paso 02 —
   sidebar/login siguen con el placeholder "H").
5. **Solo modo claro**: se quitó `ThemeProvider` de `next-themes` de `layout.tsx`
   (no había ningún toggle de tema en la UI, así que no quedó ningún componente huérfano),
   se borró el bloque `.dark` y `@custom-variant dark` de `globals.css`, y se agregó
   `data-density="medium"` a `<html>`. `NextTopLoader` pasó de `#18181b` a `#1F7AB8`
   (azul de marca). `next-themes` se desinstala recién en el paso 12 (sigue en
   `package.json`, ya no se importa).
6. **`src/lib/estado-colors.ts`**: `ESTADO_VISITA_STYLES` / `ESTADO_COTIZACION_STYLES`
   repuntados a los tokens DS (`--estado-*`, `--cot-*`) en vez de `--state-visita-*` /
   `--state-cot-*`. Se agregó el campo `badgeClass` (`is-creada`, `is-cot-aceptada`, …)
   para cuando los consumidores migren a `.hl-badge` (pasos 05+). El estado
   **"completada"** de visita reutiliza el badge verde `cot-aceptada` — así lo hace el
   propio mockup del DS (`ESTADOS.completada.cls = 'is-cot-aceptada'` en
   `Visita Ciclo de Vida DS.html`), porque el DS no define un token `--estado-completada`
   separado.
7. Bug fix de paso: `outline-color: rgb(var(--ring) / 50%)` en el `@layer base` era
   inválido (`--ring` es `oklch(...)`, no componentes rgb) y se descartaba en silencio.
   Ahora es `outline-color: var(--color-ring)`.

## Arquitectura de tokens — cómo quedó `globals.css`

`globals.css` importa `homelab-tokens.css` (que declara `@theme` con toda la escala DS)
y luego define un **bloque de alias de compatibilidad**: los nombres shadcn de siempre
(`--background`, `--card`, `--primary`, `--muted-foreground`, `--border`, …) se
re-apuntan a primitivos DS (`--neutral-*`, `--brand-*`), nunca a los semánticos
`--color-*` de la escala DS — eso es lo que evita una referencia circular (`--color-primary:
var(--primary)` + `--primary: var(--color-primary)` se resolvería como inválido).

Efecto: **los ~56 archivos con `style={{ color: 'var(--muted-foreground)' }}` ya se ven
con la paleta DS sin que se les haya tocado una línea.** Se confirmó visualmente en
`/dashboard`, `/examenes`, `/visitas` y `/visitas/[id]` (el archivo con más inline styles
del repo, `visita-lifecycle-view.tsx`, ya sale rebrandeado).

Se conserva también el antiguo `@theme inline` (recortado — sin las claves que ahora
vienen de la escala DS: `--color-primary`, `--color-accent`, `--color-destructive`,
`--color-border`, `--color-ring`, `--radius-*`) para que `src/components/ui/*` (que hoy
usa clases Tailwind semánticas tipo `bg-card`, `border-input`) siga funcionando hasta que
se reescriba en el paso 03.

**Trampa activa hasta el paso 03**: `--color-accent` en la escala DS es *naranjo*
(`--brand-orange`), no el gris de hover shadcn. `ui/button.tsx` usa `hover:bg-accent` —
ese botón (usado hoy solo en `date-picker.tsx`) hará hover naranjo hasta que se reescriba
en el paso 03. Los usos vía el alias `var(--accent)` (sidebar, `dashboard-filters.tsx`)
están bien porque el alias fue apuntado a `--brand-blue-soft`, no a la escala DS.

Todo el bloque de alias (incluyendo `--state-visita-*` / `--state-cot-*`, que
`visita-lifecycle-view.tsx` sigue consumiendo directamente en varios puntos) se retira en
el paso 12, una vez que ningún componente dependa de los nombres shadcn.

## Verificación realizada

- `pnpm build` — sin errores de TS ni CSS.
- `pnpm dev` + `agent-browser`: `/login`, `/dashboard`, `/examenes`, `/visitas`,
  `/visitas/[id]` — todo azul de marca, radios de 10px, densidad reducida, badges de
  estado con los nuevos tonos (verde/celeste/gris/azul), sin regresiones visuales
  evidentes. Screenshots no se conservan (verificación ad-hoc).
- `pnpm test` (vitest): 164/164 tests pasan (igual que en `main` antes del cambio — las 4
  fallas de archivos `e2e/*.spec.ts` son un problema preexistente de configuración de
  vitest recogiendo specs de Playwright, no relacionado con este paso).
- `pnpm test:e2e` — no se corrió en este paso (el plan solo lo pide después de los pasos
  02, 04 y 07, que son los que tocan estructura/selectores).

## Nota para el siguiente paso (02 — shell)

El logo real y el placeholder "H" conviven: `public/homelab-logo.png` ya existe pero
`sidebar.tsx` y `login/page.tsx` todavía no lo usan. Eso es intencional — el paso 02
reemplaza el shell (sidebar, layout admin, login, `PageHeader`) y ahí corresponde
enchufar el logo.
