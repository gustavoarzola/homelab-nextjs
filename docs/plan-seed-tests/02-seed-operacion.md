# Paso 2 — Operación determinista con features nuevas

> Contexto compartido: ver `00-overview.md` (fórmula de costo, columnas nuevas, reglas).
> Depende del paso 1 (catálogos + `rng.ts`).

## Objetivo
Crear `src/db/seed/operacion.ts` con `seedOperacion({ now, seed })`: determinista, que
puebla las features nuevas (descuentos de visita, descuento por procedimiento, insumos,
recargos, exámenes isapre), siembra cotizaciones y teléfonos, y deja visitas sin asignar.

## Firma
```ts
seedOperacion({ now = todaySantiago(), seed = 42 }: { now?: string; seed?: number }): Promise<void>
```
Usar `now` como fecha de referencia (reemplaza el uso de `new Date()`/Santiago actual del
seed, líneas ~808-822) y `seed` para el PRNG de `rng.ts` (reemplaza TODO `Math.random()`:
jitter lat/lng ~452-453, conteo diario ~830, prob. asignar enfermera ~844-845, hora/minuto
~863-864, `metodoPago`).

## Tareas
1. **Truncado acotado**: truncar SOLO tablas operacionales (visitas + items, cotizaciones +
   items, pacientes, telefonos_pacientes, direcciones). **No** truncar catálogos ni usuarios.
   Reordenar el `TRUNCATE` actual (líneas ~650-678) quitando catálogos. Respetar FK/orden.
2. **Eliminar código muerto** de `laboratorios`/`allLaboratories` (bloque comentado
   ~993-1042 y cualquier referencia).
3. **Leer IDs de catálogos** existentes por clave natural (no asumir IDs correlativos).
4. **Pacientes/direcciones/teléfonos**: conservar la distribución determinista actual
   (RUT/pasaporte, previsiones 75/20/5, edades por hash, residencias ~10%). **Agregar
   `patientPhones`** (hoy no se siembran): 1-2 por paciente vía PRNG.
5. **Visitas — poblar features nuevas** (un subconjunto de visitas para cada una):
   - `cobraVisita=true` usando **fee real por comuna** con
     `getPrecioVisitaEnfermeria(conn, comuna)` (NO el hardcode `NURSING_BASE_PRICE=30000`).
   - Descuento de visita en algunas: `descuentoTipo` ∈ `'monto'|'porcentaje'`,
     `descuentoValor`, `descuentoAfectaPagoEnfermera` (mezclar true/false).
   - Descuento por procedimiento: setear `descuento` en filas `visitProcedures` para un
     subconjunto + `descuentoProcedimientosAfectaPagoEnfermera`.
   - `montoInsumos` > 0 en un subconjunto.
   - Recargos (`visitSurcharges`) — mantener.
   - Algunas `examenes_isapre_visitas` (`valorCompleto`, `valorPagar`, `idPrevision`).
   - **Costo consistente**: tras insertar items, llamar
     `actualizarCostoVisitaPersistida(idVisita, conn)` (de `src/lib/pricing/visitas.ts`)
     para persistir `costo`/`montoDescuento`/`montoVisitaOriginal`/`montoDescuentoProcedimientos`.
     Así el seed nunca diverge de la fórmula de la app.
   - Mantener estados actuales (programada/confirmada/realizada/completada/no_realizada/
     cancelada) y sus campos (numeroBoleta, pago, traslado, motivos) relativos a `now`.
   - **Dejar un set de `programada` SIN enfermera** (`idEnfermera=null`) para el board de asignación.
6. **Cotizaciones** (hoy: cero): sembrar en `creada/enviada/aceptada/rechazada` con items
   (`quotationExams/Procedures/Workshops/Surcharges` + isapre) y los mismos campos de
   descuento/insumos. Unas con `idPaciente`, otras con destinatario suelto
   (`nombreDestinatario/emailDestinatario/...`). Setear `total` consistente.
7. **`index.ts` (CLI)** + scripts `package.json`:
   - `db:seed` → `seedCatalogos()` + `seedOperacion({ now: hoy, seed: 42 })` (dev).
   - `db:seed:catalogos` → solo `seedCatalogos()` (prod-safe).
   - Reemplazar el `src/db/seed.ts` monolítico por el nuevo flujo (o convertirlo en thin wrapper de `seed/index.ts`).

## Verificación
- Correr `seedOperacion({ now:'2026-03-15', seed:42 })` en BD limpia **dos veces** y
  comparar `pg_dump --data-only` (ordenado) → idéntico.
- Script/test ad-hoc: para una muestra de visitas, recomputar con
  `calcularCostoVisitaPersistida` y afirmar que iguala el `costo` persistido.
- Verificar en la UI (skill `run`/`verify`) que dashboard, visitas con descuento e insumos,
  cotizaciones y el board de asignación (visitas sin enfermera) se ven poblados.

## Definition of done
- `seedOperacion` determinista, sin `Math.random()`, con fecha de referencia.
- Descuentos (visita + procedimiento), insumos, recargos, isapre, teléfonos y cotizaciones poblados.
- `costo`/`montoDescuento`/etc. consistentes con la lógica de precios real.
- `pnpm db:seed` y `pnpm db:seed:catalogos` funcionan.
