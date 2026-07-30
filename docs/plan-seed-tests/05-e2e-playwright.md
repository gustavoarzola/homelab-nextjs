# Paso 5 — E2E Playwright (desde cero)

> Contexto compartido: ver `00-overview.md`. Depende del paso 3 (BD de test sembrada).
> `@playwright/test` y `playwright` ya están instalados; NO existe config aún.

## Objetivo
Montar la infraestructura E2E: `playwright.config.ts`, `webServer` contra la BD de test
sembrada, login con `storageState`, y specs de los flujos críticos.

## Tareas
1. **`playwright.config.ts`**:
   - `webServer`: levantar la app apuntando a la BD de test, p.ej.
     `command: 'HOMELAB_DATABASE_URL=$HOMELAB_TEST_DATABASE_URL pnpm build && pnpm start'`
     (o `next dev`), `url: 'http://localhost:3000'`, `reuseExistingServer: !CI`.
   - `baseURL`, proyecto `chromium`, `use: { storageState: 'e2e/.auth/user.json' }`.
   - `globalSetup`: migrar + sembrar la BD de test (reutilizar `src/test/global-setup.ts`
     o un wrapper que llame `seedCatalogos` + `seedOperacion({now:'2026-03-15',seed:42})`).
   - Nota: `(admin)/layout.tsx` redirige a `/login` sin sesión → el `storageState` es imprescindible.
2. **`e2e/auth.setup.ts`** (project de setup): navegar a `/login`, autenticar con
   `admin@homelab.cl` / `admin123` (del seed) y guardar `storageState` en `e2e/.auth/user.json`.
   Encadenar con `dependencies: ['setup']` en el proyecto chromium.
3. **Specs de flujos críticos** en `e2e/`:
   - `login.spec.ts` — login OK y credenciales inválidas.
   - `visita-con-descuento.spec.ts` — crear visita con descuento + insumos y validar el
     costo mostrado en el formulario/preview y tras guardar.
   - `cotizacion-a-visita.spec.ts` — crear cotización y convertirla a visita.
   - `asignacion.spec.ts` — board de asignación: arrastrar una visita **sin enfermera** a
     una enfermera y guardar (`@dnd-kit`; usar drag manual con mouse si el helper de PW no
     dispara el DnD).
   - (Opcional) `visitas-listado.spec.ts` — filtros + export `.xlsx`.
4. **Scripts** `package.json`: `"test:e2e": "playwright test"`. Añadir `e2e/.auth/` a `.gitignore`.

## Verificación
- `pnpm exec playwright install` (navegadores) si hace falta.
- `pnpm test:e2e` verde en local.
- La app bajo test corre contra `homelab_test`, no contra dev.

## Definition of done
- `playwright.config.ts` + `auth.setup.ts` + specs de los flujos críticos.
- `pnpm test:e2e` verde; sesión reutilizada vía `storageState`; BD de test aislada.
