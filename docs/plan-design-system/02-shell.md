# Paso 02 — Shell

**Estado: hecho.**

## Qué se hizo

1. **`src/app/(admin)/layout.tsx`**: `flex h-screen overflow-hidden` + `p-8` inline →
   estructura `.app` / `.app-main` / `.app-body` de `homelab-shell.css` (grid
   sidebar+contenido, padding 28/32/48, sidebar `sticky`).
2. **`src/components/sidebar.tsx`** (reescrito):
   - Logo real (`public/homelab-logo.png`) vía `.app-side__logo`, reemplaza el placeholder
     "H".
   - Nav dividido en `navItems` (8, sin cambios) + `catalogItems` (10) bajo un
     `.app-side__group` "Catálogos" — antes era una sola lista plana de 18.
   - Estado activo pasa de un ternario `style={}` (`var(--accent)`/`var(--accent-foreground)`)
     a la clase `.active` de `homelab-shell.css` (tinte azul).
   - `initials()` + `.hl-avatar` para el bloque de usuario, en vez de solo texto.
   - Detección de ruta activa simplificada: de un `.some()` anidado sobre 18 items
     (O(n²) en cada render de cada link) a una función `isActive()` que solo compara
     contra la lista completa una vez por link — mismo comportamiento (evita que
     `/asignacion` quede "activo" estando en `/asignacion/envio-correos`), menos trabajo.
   - **Se retiró el colapso del sidebar** (botón +/- que reducía el ancho a 16px/w-60).
     Es una decisión deliberada, no un descuido: `homelab-shell.css` (verbatim del DS)
     define `.app` con `grid-template-columns: 232px 1fr` fijo — el shell del DS no
     contempla un sidebar colapsable en ningún mockup. Añadirlo de vuelta habría
     significado inventar CSS no validado por el DS para una funcionalidad puramente
     cosmética (no hay lógica de negocio, ningún test la cubre). Se prioriza fidelidad al
     DS. Si se quiere recuperar, es un paso aparte y debe diseñarse contra el DS, no
     contra el shell viejo.
3. **`src/components/page-header.tsx`** (nuevo): `{ crumb?, title, meta?, actions? }` sobre
   `.page-head`. Se aplicó de inmediato a los **16 archivos** que tenían el bloque
   `<div className="mb-6"><h1…><p…></div>` copiado literalmente (más de lo que pedía el
   texto original del paso, que solo mencionaba crear el componente — se hizo el rollout
   completo ahora porque el cambio es mecánico y de bajísimo riesgo, y evita revisitar
   estos mismos archivos en pasos futuros):
   `cotizaciones`, `comunas`, `enfermeras`, `pacientes`, `examenes`, `pagos-enfermeras`
   (listado y detalle — el detalle solo en su cabecera, con `crumb` de vuelta; el resto de
   esa página de 224 líneas queda para el paso 11), `origenes-contacto`, `procedimientos`,
   `reportes`, `previsiones`, `residencias`, `talleres`, `tipos-recargos`, `visitas`,
   `precios/visitas`. `visitas/[id]/page.tsx` (con su propio `page-head` a medida) queda
   para el paso 06.
4. **`src/app/login/page.tsx`** + `submit-button.tsx`: `.hl-card`, `.hl-fieldgroup` +
   `.hl-input`, `.hl-btn--primary`, banner de error con `.hl-callout--bad` (reemplaza el
   `oklch(...)` literal inline), logo real. Labels/`name`/`id` intactos
   (`e2e/login.spec.ts` usa `getByLabel`).

## Bug encontrado y corregido: `src/proxy.ts`

Al enchufar el logo real, `/login` (página sin sesión) rompía la imagen: `GET
/homelab-logo.png` devolvía `307` hacia `/login` en vez de sires. El matcher de
`src/proxy.ts` solo excluía `_next/static`, `_next/image` y `favicon.ico` — cualquier
otro archivo de `public/` quedaba atrapado por el guard de sesión y se redirigía. Esto
ya era un bug preexistente (afectaba a cualquier asset público servido sin sesión), pero
quedaba invisible porque no había ningún asset de `public/` en uso antes de este paso.
Se corrigió el matcher para excluir extensiones de archivo estático comunes
(`png|jpg|jpeg|gif|webp|svg|ico|css|js|map`), no solo el logo puntual — así cualquier
asset público futuro funciona sin este mismo problema.

## Verificación realizada

- `pnpm build` — sin errores de TS.
- `pnpm dev` + `agent-browser`: `/login` (logo real render OK), `/dashboard` (sidebar con
  grupo "Catálogos", avatar "A", logo), `/examenes` (nuevo `.page-head`),
  `/pagos-enfermeras/[enfermeraId]` (crumb + título + meta), `/visitas/[id]` (sin
  regresión del paso 01) — capturas no se conservan (verificación ad-hoc).
- `pnpm test` (vitest): 164/164 (mismo resultado que en `main`, mismas 4 fallas
  preexistentes de specs Playwright recogidas por vitest — no relacionado).
- **`pnpm test:e2e`**: 7/7 tests pasan, incluidos los de selectores frágiles
  identificados en el paso 00 (`login.spec.ts` ×3, `visita-con-descuento.spec.ts`,
  `cotizacion-a-visita.spec.ts`, `asignacion.spec.ts`). Sin ajustes de test necesarios.

## Nota para pasos siguientes

- El paso 05 (catálogos) ya no necesita tocar los headers de página — solo el cuerpo de
  las tablas (`*-table.tsx`).
- El paso 11 (operación) hereda `pagos-enfermeras/[enfermeraId]/page.tsx` con la cabecera
  ya lista; falta el cuerpo (tarjeta resumen + tabla hecha a mano, ~34 `style={{}}`).
