# Paso 5 — Server actions y contrato de FormData

**Objetivo**: recibir la lista de archivos como un hidden JSON, reconciliarla contra la DB
dentro de la transacción existente, y sincronizar R2 después del commit.

Depende de: pasos 1, 3, 4. Habilita: paso 7.

## 5.1 Contrato de FormData

`parseFormData` hace `Object.fromEntries(formData)` → nombres repetidos colapsan. Por eso: **un
único** hidden con JSON.

```html
<input type="hidden" name="archivos"
  value='[{"key":"tmp/…","nombreOriginal":"IMG_1.jpg","contentType":"image/jpeg","tamano":231044}]' />
```

## 5.2 `src/lib/validation.ts`

```ts
const archivoItemSchema = z.object({
  key: z.string().trim().min(1).max(500),
  nombreOriginal: z.string().trim().max(255).optional().transform((v) => v || null),
  contentType: z.string().trim().max(100),
  tamano: z.coerce.number().int().min(0),
})

// dentro de `fields`:
archivos: z
  .string()
  .optional()
  .default('[]')
  .transform((raw, ctx) => {
    try { return JSON.parse(raw) } catch {
      ctx.addIssue({ code: 'custom', message: 'Archivos inválidos' }); return z.NEVER
    }
  })
  .pipe(z.array(archivoItemSchema).max(20)),
```

Exportar `archivoItemSchema` / su tipo `ArchivoItemInput` para reuso.

## 5.3 `src/lib/archivos/persist.ts` (nuevo) — reconciliación

Helper compartido, parametrizado por tabla (`visitFiles` | `patientFiles`) y columna de FK.

```ts
type ReconcileArgs = {
  tx: Transaction
  table: typeof visitFiles | typeof patientFiles
  fkColumn: 'idVisita' | 'idPaciente'
  entidadId: number
  incoming: ArchivoItemInput[]   // en orden
}

/** Devuelve las keys de R2 que quedaron huérfanas (para borrar tras el commit). */
export async function reconcileArchivos(a: ReconcileArgs): Promise<string[]>
```

Lógica:
1. `existing = select * from table where fk = entidadId` (mapa por `key`).
2. `incomingKeys = new Set(incoming.map(i => i.key))`.
3. **Borrar** de la tabla toda fila `existing` cuya `key ∉ incomingKeys`; acumular esas keys
   en `orphaned` (para R2). `delete where id in (...)`.
4. Recorrer `incoming` con índice `i`:
   - Si `item.key` empieza con `tmp/` **y** no existe fila con esa key → `insert`
     `{ [fk]: entidadId, key: item.key, nombreOriginal, contentType, tamano, orden: i+1 }`.
   - Si ya existe fila con esa key → `update set orden = i+1` (y `nombreOriginal`/`tamano` si
     cambiaron; normalmente no).
5. Devolver `orphaned`.

Nota: en este punto las filas nuevas quedan con `key = tmp/…`. El `syncArchivos*` posterior las
mueve a la key definitiva `visitas/v{id}_…`.

## 5.4 `createVisita` — `src/lib/actions/visitas.ts`

- `visitaCreateSchema` (`:776`): agregar `archivos: fields.archivos` a `visitaSharedFields` o al
  objeto. **Esto corrige el bug** de que crear una visita con orden médica perdía el archivo
  (hoy `keyOrdenMedica` no está en el create schema ni en el `insert` de `:998-1006`).
- Desestructurar `archivos` de `parsed.data`.
- Dentro de la `db.transaction` existente (`:995`), tras insertar la visita y sus items:
  `const orphaned = await reconcileArchivos({ tx, table: visitFiles, fkColumn: 'idVisita', entidadId: id, incoming: archivos })`.
  (Al crear no habrá huérfanos, pero mantiene una sola ruta.)
- Devolver `id` **y** hacer, **después** del `await db.transaction(...)`:
  ```ts
  await syncArchivosVisita(visitId)
  if (orphaned.length) await deleteManyFromR2(orphaned)
  ```
  Envolver en try/catch que loguee pero no tumbe la creación (la visita ya está commiteada; un
  fallo de R2 se recupera con el script del paso 7). `revalidatePath` como hoy.

## 5.5 `updateVisita` — `src/lib/actions/visitas.ts`

- `visitaUpdateSchema` (`:781`): **quitar** `keyOrdenMedica: fields.nullableStr`, agregar
  `archivos: fields.archivos`.
- Quitar `keyOrdenMedica` del `.set({...})` del `update(visits)` (`:837`).
- Dentro de la transacción: `reconcileArchivos(... table: visitFiles ...)`.
- Tras el commit: `await syncArchivosVisita(id)` + `deleteManyFromR2(orphaned)` (mismo try/catch).

## 5.6 `createPaciente` / `updatePaciente` — `src/lib/actions/pacientes.ts`

- `pacienteBaseSchema` (`:64`): **quitar** `keyIdentificacion: fields.nullableStr`, agregar
  `archivos: fields.archivos`.
- Quitar `keyIdentificacion` de los `insert`/`update` de `patients` (`:319`, `:395`).
- Dentro de la transacción existente: `reconcileArchivos(... table: patientFiles, fkColumn: 'idPaciente' ...)`.
- Tras el commit:
  - `createPaciente`: `await syncArchivosPaciente(id)`.
  - `updatePaciente`: `await syncArchivosPaciente(id)`; **además**, si `nombres` o
    `apellidoPaterno` cambiaron respecto a lo que había (comparar con un `select` previo dentro
    de la tx), resincronizar también las visitas del paciente:
    ```ts
    const visitasDelPaciente = await db.select({ id: visits.id }).from(visits).where(eq(visits.idPaciente, id))
    for (const v of visitasDelPaciente) await syncArchivosVisita(v.id)
    ```
  - `deleteManyFromR2(orphaned)` en ambos.

## 5.7 Tests — `src/lib/actions/__tests__/`

Hay tests de integración con DB real (`test:integration`). Agregar (o extender los de
pacientes/visitas si existen):
- Crear visita con `archivos` = 2 items `tmp/…` → 2 filas en `archivos_visitas`, `orden` 1 y 2.
  (Con `getR2Object`/`moveR2Object` de `sync` mockeados, o apuntando a un bucket de test.)
- Update quitando 1 y agregando 1 → conteo correcto, keys huérfanas devueltas.
- `reconcileArchivos` unitario con `tx` fake si se puede aislar; si no, cubrir vía la action.

## 5.8 Verificación

`pnpm build` (typecheck) verde: ya no quedan referencias a `keyOrdenMedica`/`keyIdentificacion`
salvo el correo (paso 6). `pnpm test:integration` verde.
