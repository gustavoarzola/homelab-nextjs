---
name: verify
description: Build/launch/drive recipe for verifying changes in this Next.js app end-to-end through the real UI.
---

# Verifying homelab-nextjs end-to-end

## Setup
- Env vars live in `.env.local`. For any one-off script or CLI tool that needs DB access, either
  `set -a; source .env.local; set +a` before running, or use `npx tsx --env-file=.env.local <script>`.
- Run a throwaway script from the **project root** (not the scratchpad dir) so `postgres`/other
  deps resolve — `tsx` needs `node_modules` in scope. Delete the file when done.
- Local DB is already migrated; `pnpm drizzle-kit migrate` (with env sourced) applies new
  migrations. `pnpm drizzle-kit generate` also needs env vars sourced (it only reads config, no
  live connection, but the config file throws if the URL var is unset).
- Dev server: `pnpm dev` respects `PORT` env var — do NOT pass `-- -p <port>`, the `dev` script has
  no passthrough separator wired and `next dev -p` misparses. Use `PORT=3457 pnpm dev`.

## Login
- Admin user seeded: `admin@homelab.cl` / `admin123` (see `src/db/seed.ts`).
- Login form fields are `#correo` and `#contrasena` (Spanish names), not `email`/`password`.

## Driving the UI with Playwright
`@playwright/test` / `playwright` are already devDependencies — write a throwaway `.mjs` script at
repo root (not scratchpad) and `node script.mjs` it; no need for the test runner.

Gotchas specific to this component library:
- **FormDatePicker**: click the `button:has-text("Seleccionar fecha")` trigger, then
  `.rdp-day_button:not([disabled])` for a day, then `Escape` to close — otherwise the popover
  overlays and intercepts later clicks.
- **SelectCombobox** (procedimientos/exámenes/enfermera/etc.): the visible placeholder text is a
  `pointer-events-none` `<span>` absolutely positioned over a same-size `<input placeholder="">`.
  Locating by `getByText(...)` and clicking a resolved `<input>` via `.locator('xpath=..').locator('input')`
  is flaky (span disappears once `selectedOptions.length > 0`, breaking re-lookups after the first
  pick). Reliable pattern: grab the placeholder span's `boundingBox()` **once**, then
  `page.mouse.click(box.x + 10, box.y + box.height/2)` — the box position doesn't move as items get
  selected, so it's safe to reuse for opening the dropdown again on the 2nd/3rd pick. Click
  `li:has-text("<option label>")` to pick an option; click somewhere neutral like `(50, 50)` to
  close the dropdown afterward (Escape doesn't reliably close it here).
- Per-row numeric inputs with a `max` attribute (e.g. procedure discount inputs, capped to the
  line's price) are a reliable, unambiguous locator: `input[type="number"][max]`. Plain amount
  inputs like "monto de insumos" have no `max`, so this filter cleanly separates them.

## Flows worth driving
- **Visita creation w/ discounts**: `/visitas/nueva?pacienteId=<id>` → fill fecha → pick enfermera
  → pick 2 procedimientos → fill `Desc. $` per row → toggle "afecta el pago de la enfermera" →
  submit → lands on `/visitas/<id>` (lifecycle view). Confirms client preview math live.
- **Persistence**: query `visitas` (`monto_descuento_procedimientos`,
  `descuento_procedimientos_afecta_pago_enfermera`) and `procedimientos_visitas` (`descuento` per
  row) directly via a throwaway tsx script.
- **Printable quotation**: `GET /api/cotizacion/<visitaId>` renders inline HTML — screenshot or
  `textContent('body')` to check for expected labels/amounts.
- **State transitions**: on the visit lifecycle page, `button:has-text("Confirmar visita")` then
  `button:has-text("Marcar como realizada")` moves `programada → confirmada → realizada`. A
  `realizada` visit is still editable (only `completada`/`cancelada`/`no_realizada` are locked in
  `updateVisita`).
- **Pagos a enfermeras**: `/pagos-enfermeras/<enfermeraId>?month=<m>&year=<y>` shows the per-visit
  breakdown (fee visita / procedimientos / recargos / base / pago estimado) — the fastest way to
  confirm a nurse-payment calculation change without re-deriving the SQL by hand.

## Cleanup
Any test visita/cotización created during verification should be deleted afterward (cascade
deletes its pivot rows) — this app has no test-data flag, so leftover rows show up in real lists.
