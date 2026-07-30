# Plan: Seed completo/determinista + base de tests íntegra

Este directorio divide el trabajo en **pasos ejecutables por separado**. Cada archivo
`0X-*.md` es autocontenido (incluye el contexto necesario) para poder ejecutarse en una
sesión nueva sin re-explorar el código. Ejecutar en orden.

| Paso | Archivo | Depende de |
|---|---|---|
| 1 | `01-seed-split-catalogos.md` — dividir seed en módulos + catálogos prod-safe | — |
| 2 | `02-seed-operacion.md` — operación determinista con features nuevas | 1 |
| 3 | `03-bd-test-dedicada.md` — BD de test + globalSetup | 1, 2 |
| 4 | `04-tests-integracion.md` — tests de integración Vitest | 3 |
| 5 | `05-e2e-playwright.md` — E2E Playwright desde cero | 3 |

## Por qué

Features recientes (descuento en visita de enfermería, descuento por procedimiento, cobro
de insumos, recargos) **no se poblan** en `src/db/seed.ts`: quedan en su default. El seed
tampoco es determinista (`Math.random()` + fechas ancladas a "hoy") y no siembra
cotizaciones, `examenes_isapre_visitas` ni `telefonos_pacientes`. Los tests de BD mutan la
base de **desarrollo**. No hay config de Playwright.

## Decisiones tomadas (fijas)

- **Fechas**: PRNG con semilla + fecha de referencia configurable. Dev usa hoy (dashboard
  vivo); tests pasan fecha fija (`'2026-03-15'`, seed `42`) ⇒ BD reproducible byte a byte.
- **BD de test**: dedicada (`HOMELAB_TEST_DATABASE_URL`), migrada + sembrada en `globalSetup`.
- **Catálogos = "de verdad" / prod-safe** (idempotentes, no truncan): previsiones,
  residencias, procedimientos, exámenes, talleres, recargos, precios de visita, orígenes de
  contacto, usuarios. **Operación = test** (destructiva): pacientes, teléfonos, direcciones,
  visitas+items, cotizaciones+items, asignaciones. Pagos de enfermeras = calculados (no se siembran).

---

## Referencia compartida (datos que necesitan varios pasos)

### Fórmula de costo de visita — `src/lib/pricing/visitas.ts` `calcularCostoVisitaPersistida`
```
subtotalProcedimientosOriginal = Σ visitProcedures.precio
montoDescuentoProcedimientos   = Σ min(max(0, proc.descuento), proc.precio)
subtotalProcedimientos         = original − descuentoProcs
subtotalExamenes               = Σ visitExams.precio + Σ visitIsapreExams.valorPagar
subtotalTalleres               = Σ visitWorkshops.precio
subtotalRecargos               = Σ visitSurcharges.precio
costoVisitaEnfermeriaOriginal  = getPrecioVisitaEnfermeria(comuna) si cobraVisita, si no 0
montoDescuento                 = resolverMontoDescuento(feeOriginal, descuentoTipo, descuentoValor)   // SOLO afecta el fee de enfermería
costoVisitaEnfermeria          = max(0, feeOriginal − montoDescuento)
total = subtotalProcedimientos + subtotalExamenes + subtotalTalleres + costoVisitaEnfermeria + subtotalRecargos + montoInsumos
```
`resolverMontoDescuento(orig, tipo, valor)` (`descuento.ts`): `porcentaje` → `round(orig*min(valor,100)/100)`, `monto` → `valor`; siempre acotado a `[0, orig]`. `DescuentoTipo = 'monto' | 'porcentaje'`.

**Regla de oro del seed**: tras insertar los items de una visita, llamar
`actualizarCostoVisitaPersistida(idVisita, tx)` para que `costo`, `montoDescuento`,
`montoVisitaOriginal`, `montoDescuentoProcedimientos` se calculen con la MISMA lógica que la
app (no re-derivar la fórmula a mano en el seed).

### Pago a enfermeras (calculado) — `src/lib/pricing/nurse-payment.ts`
`base = costo − examSum − workshopSum − insumosSum + (descuentoAfectaPagoEnfermera ? 0 : montoDescuento)`; `pago = round(base * porcentajePago/100)`. Excluye exámenes, talleres e insumos.

### Columnas nuevas (migraciones 0010–0012) — en `visitas` y `cotizaciones`
- `monto_insumos` int NN def 0 (0010)
- `descuento_tipo` varchar(20) NN def `'monto'`, `descuento_valor` int NN def 0,
  `monto_descuento` int NN def 0, `monto_visita_original` int NN def 0,
  `descuento_afecta_pago_enfermera` bool NN def false (0011)
- `monto_descuento_procedimientos` int NN def 0,
  `descuento_procedimientos_afecta_pago_enfermera` bool NN def false (0012)
- Línea: `procedimientos_visitas.descuento` y `cotizacion_procedimientos.descuento` int NN def 0 (0012)

`visitas.idPaciente` e `visitas.idEnfermera` son **nullable** (soporta "visitas sin asignar").
NO existe tabla `laboratorios` (eliminada en migración `0007`) — hay código muerto que la referencia en el seed (líneas ~993-1042).

### Claves FormData de descuentos (para tests vía server action)
- Por procedimiento: `procedimiento_descuento_${idProcedimiento}` (ver `src/lib/actions/visitas.ts:667,808` y `cotizaciones.ts:449,696`).
- Nivel visita: consultar `src/lib/actions/visitas.ts` + `src/lib/validation.ts` para los nombres exactos de `descuento_tipo`/`descuento_valor`/`monto_insumos`/`descuento_afecta_pago_enfermera`/`descuento_procedimientos_afecta_pago_enfermera`.

### Infra actual
- Seed: `src/db/seed.ts` (monolito ~1079 líneas). Script `db:seed` = `tsx --env-file=.env.local src/db/seed.ts`.
- DB: `src/db/index.ts` lee `HOMELAB_DATABASE_URL` en import; driver por `process.env.VERCEL` (Vercel→Neon Pool, local→postgres.js). Migraciones en `src/db/migrations/` (últimas 0010–0012).
- Vitest: `vitest.config.ts` (`environment:'node'`, `setupFiles:['./src/test/setup.ts']`, `pool:'forks'`, `maxWorkers:1`). `src/test/setup.ts` parsea `.env.local` y mockea `@/auth`. Tests de BD usan el `db` real y limpian por IDs (`__tests__/helpers.ts` exporta `P` y `fd`). NO hay Playwright config.
- Catálogos "reales" hardcodeados hoy en `seed.ts`: previsiones (15), residencias (12), procedimientos (17), exámenes isapre (50, precio 0, grupo `'imalab isapre'`), tipos de recargos (9), orígenes de contacto (13), talleres (10), enfermeras (50). Exámenes imalab se cargan de `examenes.csv` (raíz, `process.cwd()`).
- Credenciales seed: `admin@homelab.cl`/`admin123` (admin), `usuario@homelab.cl`/`user123`.

## Verificación global (al terminar todos los pasos)
1. Correr operación 2× en BD limpia con mismos `(now, seed)` → `pg_dump --data-only` ordenado idéntico.
2. `db:seed:catalogos` 2× → sin duplicados (conteos estables).
3. `pnpm test` verde contra BD de test; **BD de dev sin cambios** tras tests.
4. `pnpm test:e2e` verde.
