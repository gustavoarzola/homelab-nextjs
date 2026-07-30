# Paso 4 — Tests de integración Vitest (reusan el seed)

> Contexto compartido: ver `00-overview.md` (fórmula, columnas, claves FormData).
> Depende del paso 3 (BD de test sembrada determinista).

## Objetivo
Cubrir las funcionalidades críticas hoy sin tests (deuda técnica #9), reusando el seed
determinista como fixture y afirmando contra valores conocidos. Complementa (no reemplaza)
los mutation-tests existentes.

## Fixtures conocidos
Con `seedOperacion({ now:'2026-03-15', seed:42 })`, los datos son reproducibles. Estrategia:
- **Read-only**: consultar el seed y afirmar invariantes/valores. Para no acoplar a números
  frágiles, preferir **invariantes** (ver abajo) y algunos conteos/valores anclados que se
  fijan la primera vez que se corre (snapshot manual).
- **Mutación**: seguir el patrón actual (`__tests__/helpers.ts` `P`/`fd`, create-and-cleanup
  con `afterEach`), ahora contra la BD de test.

## Tests a crear (en `src/lib/actions/__tests__/`)
1. **`dashboard.test.ts`** — `getDashboardFinanciero` / `getDashboardVisitsByDay` para
   marzo 2026: afirmar que los totales facturados **reflejan descuentos e insumos** y que el
   pago a enfermeras usa la fórmula de `nurse-payment.ts` (base excluye exámenes/talleres/
   insumos; revierte `montoDescuento` si `descuentoAfectaPagoEnfermera=false`).
2. **`visitas.test.ts`** — `createVisita`/`updateVisita`/`getVisita`:
   - Crear visita con descuento de visita (`monto` y `porcentaje`), descuento por
     procedimiento (`procedimiento_descuento_${id}`) e `montoInsumos`.
   - Afirmar que `costo`, `montoDescuento`, `montoVisitaOriginal`,
     `montoDescuentoProcedimientos` persisten según `calcularCostoVisitaPersistida`.
   - (Consultar `src/lib/actions/visitas.ts` + `validation.ts` para los nombres exactos de
     los campos FormData de nivel visita.)
3. **`cotizaciones.test.ts`** — CRUD + `convertirCotizacionAVisita`: verificar que copia
   items y campos de descuento/insumos a la visita resultante y setea `idVisita`.
4. **Ampliar `pagos-enfermeras.test.ts`** — caso combinado: descuento de visita +
   descuento de procedimiento, con y sin `afectaPagoEnfermera`, sobre datos sembrados.
   Mantener el invariante existente `base = feeVisita + procedimientos + recargos`.
5. (Opcional) **asignación / emails** — ampliar cobertura sobre visitas sembradas
   (incluidas las "sin asignar").

## Invariantes recomendados (robustos ante cambios del seed)
- Para toda visita sembrada: `costo == recompute(calcularCostoVisitaPersistida)`.
- `montoDescuento <= montoVisitaOriginal`; `montoDescuentoProcedimientos <= Σ precio procs`.
- Resumen mensual de pagos: `base == montoVisitas + montoProcs + montoRecargos`.

## Verificación
- `pnpm test:integration` (o `pnpm test`) verde.
- Correr 2 veces seguidas → mismos resultados (determinismo).

## Definition of done
- Tests nuevos de dashboard, visitas, cotizaciones y pagos ampliados, verdes contra BD de test.
- Al menos un test que valida el invariante `costo == recompute(...)` sobre el seed.
