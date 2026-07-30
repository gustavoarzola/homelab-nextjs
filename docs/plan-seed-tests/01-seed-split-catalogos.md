# Paso 1 — Dividir el seed en módulos + catálogos prod-safe

> Contexto compartido: ver `00-overview.md`. Este paso NO cambia la generación de operación
> todavía (eso es el paso 2); solo reestructura y hace los catálogos idempotentes.

## Objetivo
Convertir el monolito `src/db/seed.ts` en módulos bajo `src/db/seed/`, extrayendo un
`seedCatalogos()` **idempotente y prod-safe** (no trunca) y un PRNG con semilla.

## Estructura destino
```
src/db/seed/
  rng.ts             # PRNG con semilla + helpers
  data/              # datos "reales" de catálogos (mover tal cual desde seed.ts, sin cambiar contenido)
    previsiones.ts, residencias.ts, procedimientos.ts, examenes-isapre.ts,
    tipos-recargos.ts, origenes-contacto.ts, talleres.ts, precios-visita.ts, enfermeras.ts,
    examenes-csv.ts  # loader de examenes.csv (lógica actual líneas ~321-338)
  catalogos.ts       # seedCatalogos(conn)
  index.ts           # CLI (se completa en paso 2)
```

## Tareas
1. **`rng.ts`**: implementar PRNG determinista (p.ej. `mulberry32(seed)`), exponiendo
   `int(min,max)`, `pick(arr)`, `chance(p)`, `shuffle(arr)`. Sustituirá a `Math.random()`
   y complementará el `pick()` hash existente. (Se usa en el paso 2.)

2. **`data/*.ts`**: mover los arrays hardcodeados actuales (`previsionesData`,
   `residenciasData`, `procedimientosData`, `examenesIsapreData`, `tiposRecargosData`,
   `origenesContactoData`, `talleresData`, `nurseData`, `buildNursingVisitPrices`) y el
   loader de `examenes.csv` a archivos propios. **No alterar el contenido** (son los datos
   "de verdad").

3. **`catalogos.ts` → `seedCatalogos(conn)`**:
   - Inserta usuarios (admin/usuario, bcrypt) + todos los catálogos anteriores.
   - **Idempotente / NO trunca**: usar `onConflictDoNothing()` sobre índices únicos
     naturales. `exams` ya tiene unique (nombre,codigo,grupoExamen). Para el resto, definir
     el target de conflicto por su clave natural:
     - `procedures`, `workshops` → `codigo`
     - `healthInsurances`, `elderlyResidences`, `contactOrigins`, `surchargeTypes` → `nombre`
     - `nursingVisitPrices` → `comuna` (incluye fila base `comuna=null`)
     - `users` → `correo` (ya es unique)
   - **Si falta el índice único** para alguna de esas claves en `src/db/schema.ts`: agregarlo
     y generar migración (`pnpm db:generate`). Verificar antes con `\d <tabla>` o revisando
     `schema.ts`. (Nota: hay pacientes/visitas que referencian catálogos por FK; el unique
     es sobre el catálogo mismo, sin riesgo.)
   - Devolver los IDs/keys necesarios o nada (el paso 2 los re-lee por clave natural).

4. Dejar `src/db/seed.ts` temporalmente funcionando (puede re-exportar desde `seed/` o
   quedar hasta el paso 2, que reescribe el flujo completo). No romper `pnpm db:seed` entre pasos.

## Verificación
- `pnpm db:seed:catalogos` (agregar script temporal si hace falta, o correr un pequeño tsx
  que llame `seedCatalogos(db)`) **dos veces** → conteos de cada catálogo estables (sin
  duplicados). Ej: `SELECT count(*) FROM procedimientos;` igual tras 2 corridas.
- `pnpm exec tsc --noEmit` sin errores nuevos.

## Definition of done
- Existe `src/db/seed/catalogos.ts` con `seedCatalogos()` idempotente y prod-safe.
- Datos de catálogos movidos a `src/db/seed/data/` sin cambios de contenido.
- `rng.ts` listo. Migración de índices únicos creada si fue necesaria.
