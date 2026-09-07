# Paso 3 — Nombres legibles y sincronización en R2

**Objetivo**: generar la key física legible y tener una función que, dado el estado en DB de
los archivos de una entidad, deje los objetos de R2 con la key correcta.

Depende de: pasos 1, 2. Habilita: pasos 5, 6, 7.

## 3.1 `src/lib/slug.ts` (nuevo)

```ts
/** Quita diacríticos: 'Ñuñoa' → 'Nunoa', 'José' → 'Jose'. */
export function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Slug para nombres de archivo: minúsculas, ascii, solo [a-z0-9], separador '-'. */
export function slugify(s: string): string {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

Refactor: `src/lib/comunas.ts:8-16` `normalizeComuna` debe usar `stripDiacritics` en vez de
repetir `.normalize('NFD').replace(/[̀-ͯ]/g, '')`. Mantener el resto de su lógica
(`.trim().replace(/\s+/g,' ').toLowerCase()`) y su JSDoc — sigue siendo la normalización para
comparar contra el catálogo, no un slug.

## 3.2 `src/lib/archivos/nombres.ts` (nuevo)

```ts
import { slugify } from '@/lib/slug'

export type ArchivoTipo = 'visita' | 'paciente'

type BuildKeyArgs = {
  tipo: ArchivoTipo
  entidadId: number       // idVisita o idPaciente
  nombres: string         // paciente.nombres (de la visita: el de su paciente)
  apellidoPaterno: string | null
  orden: number           // 1-based
  ext: string             // 'jpg' | 'pdf' | derivada de la key existente
}

export function buildArchivoKey(a: BuildKeyArgs): string {
  const folder = a.tipo === 'visita' ? 'visitas' : 'pacientes'
  const prefix = a.tipo === 'visita' ? 'v' : 'p'
  const primerNombre = slugify(a.nombres.split(/\s+/)[0] ?? '') || 'x'
  const apellido = slugify(a.apellidoPaterno ?? '') || 'x'
  return `${folder}/${prefix}${a.entidadId}_${primerNombre}_${apellido}_${a.orden}.${a.ext}`
}

/** Extensión a partir de una key o content-type; default 'jpg'. */
export function extFromKeyOrType(key: string, contentType?: string | null): string {
  const fromKey = key.includes('.') ? key.split('.').pop()!.toLowerCase() : ''
  if (fromKey) return fromKey
  if (contentType === 'application/pdf') return 'pdf'
  return 'jpg'
}

export function basename(key: string): string {
  return key.split('/').pop() ?? key
}
```

## 3.3 `src/lib/r2.ts` — helpers nuevos

Junto a `uploadToR2` / `getSignedUrl` / `getR2Object`:

```ts
import { CopyObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3'

export async function copyR2Object(fromKey: string, toKey: string): Promise<void> {
  await client.send(new CopyObjectCommand({
    Bucket: BUCKET, Key: toKey, CopySource: `${BUCKET}/${encodeURIComponent(fromKey)}`,
  }))
}

export async function deleteFromR2(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

export async function deleteManyFromR2(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  await client.send(new DeleteObjectsCommand({
    Bucket: BUCKET, Delete: { Objects: keys.map((Key) => ({ Key })) },
  }))
}

export async function moveR2Object(fromKey: string, toKey: string): Promise<void> {
  if (fromKey === toKey) return
  await copyR2Object(fromKey, toKey)
  await deleteFromR2(fromKey)
}
```

## 3.4 `src/lib/archivos/sync.ts` (nuevo)

### `planRenames` — función pura (lo testeable)

```ts
export type ArchivoRow = { id: number; key: string; contentType: string | null }
export type RenameMove = { id: number; from: string; to: string }

/**
 * Dada la lista ordenada de filas y su key esperada (misma longitud, mismo orden),
 * devuelve los movimientos necesarios. Filas ya en su sitio se omiten.
 */
export function planRenames(rows: ArchivoRow[], expectedKeys: string[]): RenameMove[]
```

Devuelve `{ id, from: row.key, to: expectedKeys[i] }` para cada fila con `key !== expected`.

### Aplicación en dos fases (evita colisiones)

Al borrar el archivo 1 de 3, el 2 pasa a `orden` 1 y su key esperada es la que ocupaba otra
fila viva → colisión si se mueve directo. Solución:

```ts
async function applyRenames(moves: RenameMove[], updateRowKey: (id: number, key: string) => Promise<void>) {
  // Fase 1: todo lo que se mueve va primero a tmp/ (destino libre garantizado)
  const staged = moves.map((m) => ({ ...m, tmp: `tmp/${randomUUID()}.${extFromKeyOrType(m.to)}` }))
  for (const m of staged) await moveR2Object(m.from, m.tmp)
  // Fase 2: de tmp/ a la key final
  for (const m of staged) {
    await moveR2Object(m.tmp, m.to)
    await updateRowKey(m.id, m.to)
  }
}
```

### Entradas de alto nivel

```ts
export async function syncArchivosVisita(idVisita: number): Promise<void>
export async function syncArchivosPaciente(idPaciente: number): Promise<void>
```

Cada una:
1. `select` de la entidad para `nombres` + `apellidoPaterno` (para visita: join a `patients`
   por `visits.idPaciente`; si la visita no tiene paciente, no hay nada que sincronizar).
2. `select` de `visitFiles` / `patientFiles` `where idX = ?` `order by orden, id`.
3. `expectedKeys[i] = buildArchivoKey({ tipo, entidadId, nombres, apellidoPaterno, orden: i+1, ext: extFromKeyOrType(row.key, row.contentType) })`.
4. `applyRenames(planRenames(rows, expectedKeys), (id, key) => db.update(table).set({ key, updatedAt: new Date() }).where(eq(table.id, id)))`.

**Regla**: `syncArchivos*` corre **fuera** de la transacción de DB del server action, después
del commit (paso 5). Si la transacción hiciera rollback tras un `copy`, quedarían huérfanos.

## 3.5 Tests — `src/lib/__tests__/slug.test.ts`, `src/lib/archivos/__tests__/nombres.test.ts`, `.../sync.test.ts`

- `slugify`: `'José'→'jose'`, `'Ñuñoa'→'nunoa'`, `'María José'→'maria-jose'` (solo se usa el
  primer token en `buildArchivoKey`, pero probar el slug completo), `'  '→''`, `'O\'Brien'→'o-brien'`.
- `buildArchivoKey`: visita vs paciente (prefijo `v`/`p`, folder), `apellidoPaterno` null → `x`,
  `nombres` `'Juan Pablo'` → `juan`, orden 1..n, ext `pdf`.
- `planRenames`: (a) todas las keys ya correctas → `[]`; (b) insertar al medio (orden 2 nuevo)
  → mover 2→3, insertar en 2; (c) borrar el primero de 3 → mover 2→1, 3→2; (d) reordenar
  completo (invertir) → todos se mueven. Verificar que `applyRenames` sobre esos planes no
  intenta escribir dos veces la misma key final (se puede testear con un `moveR2Object`
  mockeado que registre destinos y falle si un destino se usa 2×).
