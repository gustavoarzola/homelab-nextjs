# Paso 3 — BD de test dedicada + globalSetup

> Contexto compartido: ver `00-overview.md`. Depende de pasos 1 y 2 (seedCatalogos + seedOperacion).

## Objetivo
Que los tests dejen de mutar la BD de desarrollo. Base de test dedicada, migrada y sembrada
de forma determinista una sola vez en `globalSetup` de Vitest.

## Tareas
1. **Env**: agregar `HOMELAB_TEST_DATABASE_URL` a `.env.local` y `.env.example`. Crear una
   2ª base en el Postgres local de Docker (p.ej. `homelab_test`). La URL debe contener el
   substring `test` (se usa como salvaguarda abajo).
2. **Redirección de la conexión en tests**: `src/db/index.ts` lee `HOMELAB_DATABASE_URL`
   en el momento del import. En `src/test/setup.ts` (que corre en `setupFiles`, ANTES de que
   el test importe `@/db`), tras cargar `.env.local`:
   ```ts
   if (process.env.VITEST && process.env.HOMELAB_TEST_DATABASE_URL) {
     if (!/test/i.test(process.env.HOMELAB_TEST_DATABASE_URL)) {
       throw new Error('HOMELAB_TEST_DATABASE_URL no parece de test — abortando por seguridad')
     }
     process.env.HOMELAB_DATABASE_URL = process.env.HOMELAB_TEST_DATABASE_URL
   }
   ```
   (Salvaguarda anti-dev: nunca apuntar a la BD de desarrollo.)
3. **`src/test/global-setup.ts`** (nuevo) + registrar en `vitest.config.ts`
   (`globalSetup: './src/test/global-setup.ts'`):
   - Conectar a `HOMELAB_TEST_DATABASE_URL` con postgres.js.
   - Migrar programáticamente: `migrate(db, { migrationsFolder: './src/db/migrations' })`
     (`drizzle-orm/postgres-js/migrator`).
   - `await seedCatalogos(db)` + `await seedOperacion({ now: '2026-03-15', seed: 42 })`.
   - Correr una sola vez (globalSetup ya es único por run).
   - Nota: `globalSetup` corre en el proceso principal; asegurar que ahí también
     `HOMELAB_DATABASE_URL` apunte a la de test (setearla al inicio del global-setup, no
     depender de `setup.ts` que es por-worker).
4. **Scripts** `package.json` (opcional pero recomendado): separar
   - `test:unit` → tests puros (pricing, with-action, rut) sin BD.
   - `test:integration` → tests que tocan BD.
   - `test` → ambos. Mantener `pool:'forks'`, `maxWorkers:1`.
5. **Migrar los tests de BD existentes** a la nueva base: no requieren cambio de código (usan
   `@/db`), pero validar que corran verdes contra la BD de test y que su limpieza por IDs
   siga funcionando sin chocar con los datos sembrados (usan prefijo `P` aleatorio + fechas
   lejanas, así que conviven).

## Verificación
- `pnpm test` corre y **la BD de dev no cambia** (revisar conteos antes/después en dev).
- `globalSetup` deja la BD de test migrada + sembrada (verificar con un `SELECT count(*)` en `homelab_test`).
- Un test read-only sencillo lee un dato conocido del seed y pasa.

## Definition of done
- `HOMELAB_TEST_DATABASE_URL` documentada y en uso; salvaguarda anti-dev activa.
- `global-setup.ts` migra + siembra la BD de test.
- `pnpm test` verde contra BD de test, sin tocar dev.
